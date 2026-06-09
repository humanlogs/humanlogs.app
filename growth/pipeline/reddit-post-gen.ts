/**
 * Reddit Post Generator — génère des drafts à partir d'une analyse de subreddit.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... SUBREDDIT=AskAcademia npx tsx pipeline/reddit-post-gen.ts
 *
 * Lit : growth/posts/scouted/<subreddit>.json
 * Écrit : growth/posts/drafts/<date>-<subreddit>-<format>.md
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";

const SUBREDDIT = process.env.SUBREDDIT ?? "AskAcademia";
const SCOUT_DIR = path.join(process.cwd(), "posts", "scouted");
const DRAFTS_DIR = path.join(process.cwd(), "posts", "drafts");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Post formats ──────────────────────────────────────────────────────────────

const FORMATS = [
  {
    id: "honest-comparison",
    name: "Comparaison honnête",
    description: "Mentionne 3-4 outils dont HumanLogs et des concurrents. Répond à une vraie question. Pas de lien dans le corps.",
    rules: [
      "Mentionne Otter.ai, Good Tape, et HumanLogs (dans cet ordre ou similaire) — jamais en premier",
      "Corps = comparaison neutre et factuelle, pas de superlative pour HumanLogs",
      "Ajoute 1-2 critères objectifs (GDPR, prix, langue, précision)",
      "Termine par une question ouverte pour encourager la discussion",
      "Pas de lien dans le corps du post",
      "Le commentaire séparé indique: 'I work on HumanLogs — happy to answer questions' + lien",
    ],
  },
  {
    id: "practitioner-tip",
    name: "Tip praticien",
    description: "Guide court sur un aspect du workflow de transcription. Mentionne HumanLogs une fois naturellement.",
    rules: [
      "Titre = conseil actionnable (ex: 'How to cut interview transcription time by 60%')",
      "3-4 étapes concrètes basées sur une vraie expérience",
      "HumanLogs mentionné une fois comme 'the tool I use' — pas de lien direct",
      "Inclure des alternatives pour crédibilité (Whisper local, Rev, etc.)",
      "Ton = praticien partageant son expérience, pas marketing",
      "Commentaire séparé avec lien si quelqu'un demande plus d'info",
    ],
  },
  {
    id: "answer-thread",
    name: "Réponse à thread",
    description: "Format réponse à une question existante. Plus safe pour nouveaux comptes.",
    rules: [
      "Pas de post parent — c'est une réponse à une question du scout",
      "200-350 mots max",
      "Répondre d'abord à la vraie question posée, HumanLogs en dernier",
      "Citer la question originale au début",
      "Format: 'Replying to: [question]' en header du draft",
      "Lien dans la réponse directe si la question demande explicitement un outil",
    ],
  },
];

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(format: typeof FORMATS[0], scoutData: any): string {
  const questions = [
    ...scoutData.hot.topQuestions.map((q: any) => `  • [${q.score}↑] "${q.title}"`),
    ...scoutData.topMonth.topQuestions.map((q: any) => `  • [${q.score}↑ this month] "${q.title}"`),
  ].slice(0, 10).join("\n");

  const topPosts = scoutData.topMonth.topByScore
    .map((p: any) => `  • [${p.score}↑] "${p.title}"`)
    .join("\n");

  return `Tu génères un draft de post Reddit pour r/${SUBREDDIT} pour promouvoir HumanLogs — une app de transcription audio pour chercheurs, open source, end-to-end chiffrée, conforme GDPR, avec un éditeur audio-lié.

## Contexte subreddit
- Abonnés: ${scoutData.about.subscribers.toLocaleString()}
- Politique auto-promo: ${scoutData.selfPromoPolicy}
- Top posts du mois:
${topPosts}

## Questions qui performent en ce moment:
${questions}

## Format à utiliser: ${format.name}
${format.description}

## Règles strictes:
${format.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## Instructions:
1. Choisis la question du scout qui a le plus fort potentiel de réponse (engagement + pertinence HumanLogs)
2. Génère UN post complet avec:
   - TITLE: (titre du post)
   - BODY: (corps complet)
   - FIRST_COMMENT: (premier commentaire à poster juste après, avec le lien https://humanlogs.app)
3. Écris en anglais, ton Reddit naturel (pas corporatif)
4. Le post doit apporter une vraie valeur même si HumanLogs n'existait pas

Génère maintenant.`;
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function generateDraft(format: typeof FORMATS[0], scoutData: any): Promise<string> {
  const prompt = buildPrompt(format, scoutData);

  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return (msg.content[0] as any).text;
}

function formatDraft(format: typeof FORMATS[0], content: string, subreddit: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `# Draft — r/${subreddit} — ${format.name}
_Generated: ${date}_
_Format: ${format.id}_
_Status: DRAFT — review before posting_

---

${content}

---
_HumanLogs URL: https://humanlogs.app_
_First comment strategy: post immediately after the main post_
`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const scoutFile = path.join(SCOUT_DIR, `${SUBREDDIT.toLowerCase()}.json`);
  let scoutData: any;
  try {
    scoutData = JSON.parse(await fs.readFile(scoutFile, "utf-8"));
  } catch {
    console.error(`❌ No scout data found for r/${SUBREDDIT}. Run reddit-scout.ts first.`);
    process.exit(1);
  }

  console.log(`\n✍️  Generating drafts for r/${SUBREDDIT}...\n`);
  await fs.mkdir(DRAFTS_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);

  for (const format of FORMATS) {
    console.log(`   Generating: ${format.name}...`);
    const content = await generateDraft(format, scoutData);
    const draft = formatDraft(format, content, SUBREDDIT);
    const filename = `${date}-${SUBREDDIT.toLowerCase()}-${format.id}.md`;
    await fs.writeFile(path.join(DRAFTS_DIR, filename), draft);
    console.log(`   ✅ posts/drafts/${filename}`);

    // Preview title
    const titleMatch = content.match(/TITLE:\s*(.+)/);
    if (titleMatch) console.log(`      → "${titleMatch[1].trim()}"`);
  }

  console.log(`\n📁 All drafts saved to growth/posts/drafts/\n`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
