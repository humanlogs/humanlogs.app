/**
 * Expand the seed pillars into scored keyword candidates.
 *
 *   npm run keywords            # uses pipeline/seeds/fr.json
 *
 * Writes pipeline/data/candidates.json and prints the top 25.
 *
 * pipeline/data/ is COMMITTED to the repo (unlike pipeline/out/) so that
 * CI runs reuse the previous expansion instead of paying DataForSEO again:
 * the workflow commits the refreshed data back after each run.
 */
import "dotenv/config";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  keywordSuggestions,
  relatedKeywords,
  type KeywordMetric,
} from "./dataforseo.js";
import seeds from "./seeds/fr.json" with { type: "json" };

const __dir = dirname(fileURLToPath(import.meta.url));

export interface Candidate extends KeywordMetric {
  pillar: string;
  score: number;
}

const INTENT_WEIGHT: Record<string, number> = {
  transactional: 1.5,
  commercial: 1.4,
  informational: 1.0,
  navigational: 0.4,
};

export function score(k: KeywordMetric, productFit: number): number {
  const value = k.searchVolume / (k.difficulty + 10);
  const intent = INTENT_WEIGHT[k.intent ?? "informational"] ?? 1.0;
  return +(value * intent * productFit).toFixed(2);
}

/**
 * Product-relevance filter per pillar.
 * `comptabilite` is broad (cours de compta, BTS, formation...) — only keep keywords
 * that connect back to running a business: logiciel, gestion, trésorerie, TPE/PME,
 * auto-entrepreneur, freelance. Other pillars are already specific enough.
 */
const PILLAR_FILTERS: Record<string, RegExp | null> = {
  comptabilite:
    /logiciel|gestion|trésorerie|tresorerie|tableau de bord|tpe|pme|auto.?entrepreneur|freelance|ind[ée]pendant|en ligne|facture|outil|application|app/i,
  facturation: null,
  "facturation-electronique": null,
  devis: null,
  "gestion-stock": null,
  "crm-tpe": null,
  "open-source-auto-heberge": null,
};

function isProductRelevant(keyword: string, pillarName: string): boolean {
  const filter = PILLAR_FILTERS[pillarName];
  if (!filter) return true;
  return filter.test(keyword);
}

const CANDIDATES_PATH = join(__dir, "data", "candidates.json");
const REFRESH_AFTER_DAYS = 7;
const MIN_UNUSED_THRESHOLD = 20;

/**
 * Load persisted candidates. The file stores `{ generatedAt, candidates }`;
 * the legacy bare-array format is still accepted (treated as undated).
 */
export async function loadCandidates(): Promise<{
  generatedAt: number;
  candidates: Candidate[];
}> {
  try {
    const parsed = JSON.parse(await readFile(CANDIDATES_PATH, "utf8"));
    if (Array.isArray(parsed)) return { generatedAt: 0, candidates: parsed };
    return {
      generatedAt: Date.parse(parsed.generatedAt) || 0,
      candidates: parsed.candidates ?? [],
    };
  } catch {
    return { generatedAt: 0, candidates: [] };
  }
}

/**
 * Returns true when keyword expansion should run:
 * - candidates.json missing or generated more than REFRESH_AFTER_DAYS ago
 * - fewer than MIN_UNUSED_THRESHOLD unused keywords remain
 *
 * The timestamp lives INSIDE the file (not mtime): a fresh git checkout in CI
 * resets mtime, which would otherwise make the data look new forever.
 */
export async function needsRefresh(
  usedKeywords: Set<string>,
): Promise<boolean> {
  const { generatedAt, candidates } = await loadCandidates();
  if (!candidates.length) return true;
  if (Date.now() - generatedAt > REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000)
    return true;
  const unused = candidates.filter(
    (c) => !usedKeywords.has(c.keyword.toLowerCase()),
  );
  return unused.length < MIN_UNUSED_THRESHOLD;
}

export async function main() {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  for (const pillar of seeds.pillars) {
    for (const seed of pillar.seeds) {
      // Run suggestions + related in parallel for each seed
      process.stdout.write(`Expanding "${seed}" (${pillar.name})... `);
      try {
        const [suggestions, related] = await Promise.all([
          keywordSuggestions(seed, 80),
          relatedKeywords(seed, 80),
        ]);
        const all = [...suggestions, ...related];
        let added = 0;
        for (const k of all) {
          const key = k.keyword.toLowerCase();
          if (seen.has(key) || k.searchVolume <= 0) continue;
          if (!isProductRelevant(k.keyword, pillar.name)) continue;
          seen.add(key);
          candidates.push({
            ...k,
            pillar: pillar.name,
            score: score(k, pillar.productFit),
          });
          added++;
        }
        console.log(`${added} new`);
      } catch (err) {
        console.log(`skipped (${(err as Error).message})`);
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  await mkdir(dirname(CANDIDATES_PATH), { recursive: true });
  await writeFile(
    CANDIDATES_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), candidates },
      null,
      2,
    ),
  );

  console.log(`\nTotal candidates: ${candidates.length}\n`);
  console.log("Top 25 opportunities:");
  console.table(
    candidates.slice(0, 25).map((c) => ({
      keyword: c.keyword,
      vol: c.searchVolume,
      KD: c.difficulty,
      intent: c.intent,
      pillar: c.pillar,
      score: c.score,
    })),
  );
}

const isMain =
  process.argv[1]?.endsWith("keywords.ts") ||
  process.argv[1]?.endsWith("keywords.js");
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
