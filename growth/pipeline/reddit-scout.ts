/**
 * Reddit Scout — analyse un subreddit.
 *
 * En prod (avec credentials OAuth Reddit) :
 *   REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=... REDDIT_USERNAME=... REDDIT_PASSWORD=...
 *   SUBREDDIT=qualitativeresearch npx tsx pipeline/reddit-scout.ts
 *
 * Sans credentials → mode simulation avec données réalistes.
 *
 * Sortie : growth/posts/scouted/<subreddit>.json
 */

import fs from "fs/promises";
import path from "path";

const SUBREDDIT = process.env.SUBREDDIT ?? "AskAcademia";
const OUT_DIR = path.join(process.cwd(), "posts", "scouted");

// ── Reddit OAuth ──────────────────────────────────────────────────────────────

async function getRedditToken(): Promise<string | null> {
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET || !REDDIT_USERNAME || !REDDIT_PASSWORD) return null;

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString("base64")}`,
      "User-Agent": `linux:humanlogs-scout:1.0 (by /u/${REDDIT_USERNAME})`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "password", username: REDDIT_USERNAME, password: REDDIT_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Reddit OAuth failed: ${await res.text()}`);
  return ((await res.json()) as any).access_token;
}

async function redditGet(path: string, token: string): Promise<any> {
  const res = await fetch(`https://oauth.reddit.com${path}`, {
    headers: {
      Authorization: `bearer ${token}`,
      "User-Agent": `linux:humanlogs-scout:1.0 (by /u/${process.env.REDDIT_USERNAME})`,
    },
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}: ${path}`);
  await new Promise(r => setTimeout(r, 600));
  return res.json();
}

// ── Live fetch ────────────────────────────────────────────────────────────────

async function scoutLive(sub: string) {
  const token = await getRedditToken();
  if (!token) throw new Error("No token");

  const [about, rulesData, hot, topMonth] = await Promise.all([
    redditGet(`/r/${sub}/about`, token),
    redditGet(`/r/${sub}/about/rules`, token),
    redditGet(`/r/${sub}/hot?limit=25`, token),
    redditGet(`/r/${sub}/top?t=month&limit=25`, token),
  ]);

  const d = about.data;
  const rules: string[] = (rulesData.rules ?? []).map((r: any) =>
    `[${r.short_name}] ${(r.description ?? "").slice(0, 150).replace(/\n/g, " ")}`
  );

  const toPost = (p: any) => {
    const pd = p.data;
    const title: string = pd.title ?? "";
    return {
      title,
      score: pd.score,
      comments: pd.num_comments,
      type: pd.is_self ? "text" : "link",
      flair: pd.link_flair_text ?? undefined,
      url: `https://reddit.com${pd.permalink}`,
      isQuestion: /\?/.test(title) || /^(how|what|which|why|is|are|can|should|does|do)\b/i.test(title),
    };
  };

  const hotPosts = (hot.data?.children ?? []).map(toPost);
  const topPosts = (topMonth.data?.children ?? []).map(toPost);

  return buildResult(sub, {
    about: { name: d.display_name, title: d.title, subscribers: d.subscribers, description: (d.public_description ?? "").slice(0, 300) },
    rules,
    hotPosts,
    topPosts,
  });
}

// ── Simulation data ───────────────────────────────────────────────────────────

const SIMULATION: Record<string, any> = {
  AskAcademia: {
    about: {
      name: "AskAcademia",
      title: "AskAcademia",
      subscribers: 142000,
      description: "A place to discuss academia, research, and higher education. Questions about academic life, grad school, career choices, and more.",
    },
    rules: [
      "[Be respectful] Treat others with respect. No personal attacks.",
      "[No self-promotion] Do not promote your own blog, website, tool, or product without prior mod approval.",
      "[Flairs] Please flair your post appropriately.",
      "[No survey spam] Survey requests must be pre-approved.",
    ],
    hotPosts: [
      { title: "What software do you use for qualitative data analysis?", score: 312, comments: 87, type: "text", isQuestion: true, flair: "Question" },
      { title: "How do you take notes during field interviews?", score: 280, comments: 64, type: "text", isQuestion: true, flair: "Question" },
      { title: "Best practices for transcribing interviews — do you use AI?", score: 254, comments: 92, type: "text", isQuestion: true, flair: "Question" },
      { title: "My university requires GDPR compliance for recordings. What tools are people using?", score: 198, comments: 45, type: "text", isQuestion: true, flair: "Question" },
      { title: "Just submitted my PhD thesis — 4 years of interviews transcribed manually, never again", score: 189, comments: 31, type: "text", isQuestion: false, flair: "Success" },
      { title: "Is Otter.ai actually GDPR compliant? My IRB is asking", score: 176, comments: 67, type: "text", isQuestion: true, flair: "Question" },
      { title: "How do you handle confidentiality in qualitative research?", score: 165, comments: 41, type: "text", isQuestion: true, flair: "Question" },
      { title: "Journaling your research process — worth it?", score: 142, comments: 28, type: "text", isQuestion: true, flair: "Discussion" },
      { title: "AI-generated transcripts as primary data — valid or not?", score: 137, comments: 55, type: "text", isQuestion: true, flair: "Discussion" },
      { title: "Teaching research methods to undergrads. Any good resources?", score: 128, comments: 22, type: "text", isQuestion: true, flair: "Teaching" },
    ],
    topPosts: [
      { title: "Spent 6 months transcribing 80+ hours of interviews by hand. Here's what I learned.", score: 1840, comments: 134, type: "text", isQuestion: false },
      { title: "Comparison of AI transcription tools for research: Otter.ai vs Whisper vs Gladia", score: 1320, comments: 198, type: "text", isQuestion: false },
      { title: "GDPR and interview recordings — a practical guide for EU researchers", score: 876, comments: 87, type: "text", isQuestion: false },
      { title: "What does your interview workflow look like from recording to analysis?", score: 743, comments: 164, type: "text", isQuestion: true },
      { title: "Stop using Zoom for research recordings — here's why", score: 698, comments: 112, type: "text", isQuestion: false },
    ],
  },

  qualitativeresearch: {
    about: {
      name: "qualitativeresearch",
      title: "Qualitative Research",
      subscribers: 8400,
      description: "A community for qualitative researchers to share methods, tools, dilemmas, and resources. Primarily for academics and practitioners doing interview-based or ethnographic research.",
    },
    rules: [
      "[On-topic] Posts must relate to qualitative research methods, practice, or theory.",
      "[No commercial posts] Tool recommendations are OK in context; direct promotional posts are not.",
      "[Surveys] Participant recruitment requires mod approval.",
    ],
    hotPosts: [
      { title: "Grounded theory vs thematic analysis — when do you choose?", score: 89, comments: 34, type: "text", isQuestion: true, flair: "Methods" },
      { title: "How do you handle member checking in remote interviews?", score: 76, comments: 28, type: "text", isQuestion: true, flair: "Question" },
      { title: "Tool recommendations for transcribing sensitive interviews?", score: 71, comments: 41, type: "text", isQuestion: true, flair: "Tools" },
      { title: "Positionality statements — how detailed is too detailed?", score: 68, comments: 22, type: "text", isQuestion: true, flair: "Writing" },
      { title: "Anyone using AI transcription and then doing thematic analysis directly on the transcript?", score: 62, comments: 37, type: "text", isQuestion: true, flair: "Tools" },
      { title: "Saturation in interviews — how do you know when you've reached it?", score: 58, comments: 19, type: "text", isQuestion: true, flair: "Methods" },
      { title: "End-to-end encryption for audio files — overkill or necessary?", score: 54, comments: 29, type: "text", isQuestion: true, flair: "Ethics" },
    ],
    topPosts: [
      { title: "The IRB approved my study but the recording software stores audio on US servers. EU participants — what do I do?", score: 412, comments: 76, type: "text", isQuestion: false },
      { title: "My workflow for 40 interviews: recording → transcript → Atlas.ti", score: 387, comments: 88, type: "text", isQuestion: false },
      { title: "Comparison: AI transcription tools that are actually GDPR compliant", score: 298, comments: 54, type: "text", isQuestion: false },
      { title: "Reflexivity in qualitative coding — a practical approach", score: 234, comments: 41, type: "text", isQuestion: false },
    ],
  },

  PhD: {
    about: {
      name: "PhD",
      title: "PhD — Postgraduate Research",
      subscribers: 534000,
      description: "A community for PhD students and researchers to discuss all aspects of doctoral study: research methods, supervision, mental health, career paths, and academic life.",
    },
    rules: [
      "[Be supportive] This community is for peer support. Be kind.",
      "[No self-promotion] Surveys, blogs, tools require mod pre-approval. One survey post per account.",
      "[Flair required] Use appropriate post flair.",
      "[No career/job ads] External opportunities go in the megathread.",
    ],
    hotPosts: [
      { title: "How many hours of interview audio do you have to transcribe for your PhD?", score: 1240, comments: 312, type: "text", isQuestion: true, flair: "Discussion" },
      { title: "I paid £200 for professional transcription and it was worse than free AI. Rant.", score: 987, comments: 189, type: "text", isQuestion: false, flair: "Rant" },
      { title: "What's your go-to tool for transcribing interviews? Free options?", score: 876, comments: 234, type: "text", isQuestion: true, flair: "Question" },
      { title: "My supervisor says Otter.ai isn't GDPR compliant. Is she right?", score: 754, comments: 178, type: "text", isQuestion: true, flair: "Question" },
      { title: "Finally finished transcribing 60 hours of interviews. A breakdown of what it cost me (time + money)", score: 698, comments: 145, type: "text", isQuestion: false, flair: "Discussion" },
      { title: "Best practices for anonymising qualitative data?", score: 612, comments: 167, type: "text", isQuestion: true, flair: "Question" },
      { title: "NVivo vs Atlas.ti vs free alternatives — comprehensive comparison after using all three", score: 589, comments: 201, type: "text", isQuestion: false, flair: "Resource" },
      { title: "Interview fatigue — how do you stay engaged after hour 30?", score: 534, comments: 98, type: "text", isQuestion: true, flair: "Discussion" },
    ],
    topPosts: [
      { title: "I transcribed 80 hours of interviews. Here's every tool I tried and what actually worked.", score: 4821, comments: 567, type: "text", isQuestion: false },
      { title: "Free AI transcription tools compared: accuracy, privacy, cost (tested with real research audio)", score: 3240, comments: 423, type: "text", isQuestion: false },
      { title: "GDPR for PhD students — a practical guide to data storage, consent, and recordings", score: 2187, comments: 298, type: "text", isQuestion: false },
      { title: "Your interview workflow from recording to NVivo — share yours", score: 1876, comments: 345, type: "text", isQuestion: true },
    ],
  },
};

// ── Result builder ────────────────────────────────────────────────────────────

function buildResult(sub: string, data: any) {
  const { about, rules, hotPosts, topPosts } = data;
  const selfPromoRules = rules.filter((r: string) =>
    /self.?promo|spam|advertis|commercial|market|blog|link|affiliat|promot/i.test(r)
  );
  const avgHotScore = Math.round(hotPosts.reduce((s: number, p: any) => s + p.score, 0) / hotPosts.length);
  const avgHotComments = Math.round(hotPosts.reduce((s: number, p: any) => s + p.comments, 0) / hotPosts.length);

  return {
    scoutedAt: new Date().toISOString(),
    simulated: !(process.env.REDDIT_CLIENT_ID),
    subreddit: sub,
    about,
    rules,
    selfPromoPolicy: selfPromoRules.length > 0 ? selfPromoRules.join(" | ") : "No explicit rule — infer from norms",
    hot: {
      stats: { avgScore: avgHotScore, avgComments: avgHotComments },
      topQuestions: hotPosts.filter((p: any) => p.isQuestion).slice(0, 8),
      topByScore: [...hotPosts].sort((a: any, b: any) => b.score - a.score).slice(0, 5),
    },
    topMonth: {
      topByScore: [...topPosts].sort((a: any, b: any) => b.score - a.score).slice(0, 5),
      topQuestions: topPosts.filter((p: any) => p.isQuestion).slice(0, 5),
    },
    allHotTitles: hotPosts.map((p: any) => p.title),
  };
}

async function scoutSimulated(sub: string) {
  const data = SIMULATION[sub];
  if (!data) throw new Error(`No simulation data for r/${sub}. Available: ${Object.keys(SIMULATION).join(", ")}`);
  return buildResult(sub, data);
}

// ── Pretty print ──────────────────────────────────────────────────────────────

function printResult(r: any) {
  const { about, selfPromoPolicy, hot, topMonth } = r;
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📍 r/${r.subreddit}${r.simulated ? "  [SIMULATED]" : "  [LIVE]"}`);
  console.log(`   ${about.subscribers.toLocaleString()} subscribers — ${about.description.slice(0, 100)}...`);
  console.log(`\n⚠️  Self-promo policy:\n   ${selfPromoPolicy}`);
  console.log(`\n📈 Hot — avg ${hot.stats.avgScore} score, ${hot.stats.avgComments} comments`);
  console.log(`\n❓ Questions trending:`);
  hot.topQuestions.slice(0, 5).forEach((q: any) =>
    console.log(`   [${q.score}↑ ${q.comments}💬] ${q.title}`)
  );
  console.log(`\n🏆 Top month:`);
  topMonth.topByScore.slice(0, 4).forEach((p: any) =>
    console.log(`   [${p.score}↑] ${p.title}`)
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Scouting r/${SUBREDDIT}...`);

  const hasCredentials = !!(process.env.REDDIT_CLIENT_ID);
  const result = hasCredentials ? await scoutLive(SUBREDDIT) : await scoutSimulated(SUBREDDIT);

  printResult(result);

  await fs.mkdir(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, `${SUBREDDIT.toLowerCase()}.json`);
  await fs.writeFile(outFile, JSON.stringify(result, null, 2));
  console.log(`\n✅ Saved → posts/scouted/${SUBREDDIT.toLowerCase()}.json\n`);

  return result;
}

main().catch(e => { console.error(e.message); process.exit(1); });
