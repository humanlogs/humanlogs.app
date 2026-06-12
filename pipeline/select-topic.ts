/**
 * Pick today's article topic from the scored candidates, avoiding anything
 * we've already published (content/blog/*.mdx front matter `targetKeyword`).
 *
 *   npm run topic
 *
 * Enriches the chosen keyword with People-Also-Ask + top SERP results so the
 * writer (the `daily-blog` skill) has a real, data-grounded outline to start from.
 */
import "dotenv/config";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serpInsights, peopleAlsoAsk } from "./dataforseo.js";
import { loadCandidates, type Candidate } from "./keywords.js";
import { provenQueries, type GscRow } from "./gsc.js";
import seeds from "./seeds/fr.json" with { type: "json" };

const __dir = dirname(fileURLToPath(import.meta.url));

// Fallback when DataForSEO returned no candidates (e.g. unpaid account, or the
// API is unavailable): pick the first seed keyword we haven't published yet.
// No volume/difficulty data — the writer still gets a topic + pillar to work from.
function seedFallback(used: Set<string>): Candidate | null {
  for (const pillar of seeds.pillars) {
    for (const seed of pillar.seeds) {
      if (!used.has(seed.toLowerCase())) {
        return {
          keyword: seed,
          searchVolume: 0,
          difficulty: 0,
          cpc: 0,
          competition: 0,
          intent: null,
          pillar: pillar.name,
          score: 0,
        };
      }
    }
  }
  return null;
}

export async function publishedKeywords(): Promise<Set<string>> {
  const dir = join(__dir, "..", "content", "blog");
  const used = new Set<string>();
  try {
    for (const file of await readdir(dir)) {
      if (!file.endsWith(".mdx") && !file.endsWith(".md")) continue;
      const raw = await readFile(join(dir, file), "utf8");
      const m = raw.match(/targetKeyword:\s*["']?(.+?)["']?\s*$/m);
      if (m) used.add(m[1].toLowerCase());
    }
  } catch {
    /* no content dir yet */
  }
  return used;
}

export interface TopicResult extends Candidate {
  paa: string[];
  topResults: { title: string; url: string }[];
}

// ---------- GSC feedback loop ----------

// A query Google already shows us for is proven demand — worth more than
// DataForSEO estimates. Existing candidates get boosted; unknown queries
// join the pool under the "gsc-proven" pillar.
const GSC_BOOST = 1.5;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Impressions over 28 days ≈ the monthly demand we can SEE; position is the
// difficulty proxy (same shape as the DataForSEO score: vol / (KD + 10)).
function gscScore(r: GscRow): number {
  return +((r.impressions * 5) / (r.position + 10)).toFixed(2);
}

/** Merge GSC proven queries into the candidate pool. Pure — easy to test. */
export function applyGscRows(
  candidates: Candidate[],
  rows: GscRow[],
  brandTerms: string[],
): Candidate[] {
  const brand = new Set(brandTerms.map(normalize));
  const byKeyword = new Map(
    candidates.map((c) => [c.keyword.toLowerCase(), c]),
  );

  for (const r of rows) {
    if (brand.has(normalize(r.keyword))) continue;
    const existing = byKeyword.get(r.keyword.toLowerCase());
    if (existing) {
      existing.score = +Math.max(
        existing.score * GSC_BOOST,
        gscScore(r),
      ).toFixed(2);
    } else {
      candidates.push({
        keyword: r.keyword,
        searchVolume: 0,
        difficulty: 0,
        cpc: 0,
        competition: 0,
        intent: null,
        pillar: "gsc-proven",
        score: gscScore(r),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export async function selectTopic(): Promise<TopicResult> {
  const used = await publishedKeywords();

  // Persisted in pipeline/data/ — may be missing/empty when DataForSEO has
  // never run.
  let { candidates } = await loadCandidates();

  // GSC feedback loop (free API, best-effort): queries with real impressions
  // outrank or boost the DataForSEO estimates.
  try {
    const rows = await provenQueries();
    if (rows.length) {
      candidates = applyGscRows(
        candidates,
        rows,
        (seeds as any).brandTerms ?? [],
      );
      console.log(
        `  (GSC feedback: ${rows.length} proven queries merged into the pool)`,
      );
    }
  } catch (err) {
    console.warn(`  GSC feedback skipped (${(err as Error).message})`);
  }

  let pick = candidates.find((c) => !used.has(c.keyword.toLowerCase())) ?? null;
  let fromSeeds = false;
  if (!pick) {
    pick = seedFallback(used);
    fromSeeds = true;
  }
  if (!pick) {
    throw new Error(
      "No fresh topics left — every seed keyword is already published. Add new seeds to seeds/fr.json.",
    );
  }
  if (fromSeeds) {
    console.log(
      `  (no DataForSEO candidates — falling back to seed "${pick.keyword}" from pillar "${pick.pillar}")`,
    );
  }

  // SERP/PAA enrichment is best-effort: empty on any failure (cache miss + API
  // unavailable, unpaid account, etc.) so the pipeline never blocks on it.
  // The cache lives in pipeline/data/ (committed) so a keyword's SERP is
  // only ever paid for once.
  const cacheDir = join(__dir, "data", "serp-cache");
  const cacheKey = pick.keyword.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cachePath = join(cacheDir, `${cacheKey}.json`);

  let paa: string[] = [];
  let topResults: { title: string; url: string }[] = [];

  try {
    const cached = JSON.parse(await readFile(cachePath, "utf8"));
    paa = cached.paa;
    topResults = cached.topResults;
    console.log(`  (using cached SERP/PAA for "${pick.keyword}")`);
  } catch {
    try {
      // Run SERP (depth 100) and dedicated PAA endpoint in parallel
      const [{ paa: serpPaa, topResults: serpResults }, paaDedicated] =
        await Promise.all([
          serpInsights(pick.keyword),
          peopleAlsoAsk(pick.keyword),
        ]);
      paa = [...new Set([...serpPaa, ...paaDedicated])];
      topResults = serpResults;
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cachePath, JSON.stringify({ paa, topResults }, null, 2));
    } catch (err) {
      console.warn(`  SERP/PAA enrichment skipped (${(err as Error).message})`);
    }
  }

  const result: TopicResult = { ...pick, paa, topResults };

  // Persist for the daily-blog skill to pick up
  const outDir = join(__dir, "out");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    join(outDir, "today-topic.json"),
    JSON.stringify(result, null, 2),
  );

  return result;
}

async function main() {
  const topic = await selectTopic();
  console.log("\n=== TODAY'S TOPIC ===");
  console.log(
    JSON.stringify(
      { ...topic, peopleAlsoAsk: topic.paa, topResults: topic.topResults },
      null,
      2,
    ),
  );
}

const isMain =
  process.argv[1]?.endsWith("select-topic.ts") ||
  process.argv[1]?.endsWith("select-topic.js");
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
