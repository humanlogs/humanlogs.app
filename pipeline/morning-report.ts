/**
 * Morning report — runs at 05:00 via GitHub Actions.
 *
 *   npm run morning
 *
 * 1. Expand keywords (DataForSEO) → candidates.json
 * 2. Select today's topic + PAA + SERP competitors
 * 3. Research the topic on Reddit (questions, themes, recent posts)
 * 4. Write a human-readable Markdown report to pipeline/out/morning-report.md
 */

import "dotenv/config";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  main as expandKeywords,
  needsRefresh,
  loadCandidates,
} from "./keywords.js";
import { selectTopic, publishedKeywords } from "./select-topic.js";
import { redditInsightReport } from "./reddit.js";
import { quickWins, topQueries } from "./gsc.js";
import seeds from "./seeds/fr.json" with { type: "json" };
import type { Candidate } from "./keywords.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, "out");

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mdTable(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "_none_";
  const keys = Object.keys(rows[0]);
  const header = `| ${keys.join(" | ")} |`;
  const sep = `| ${keys.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((r) => `| ${keys.map((k) => String(r[k])).join(" | ")} |`)
    .join("\n");
  return [header, sep, body].join("\n");
}

async function main() {
  // DataForSEO is optional: without credentials (or with an unpaid account that
  // returns "Payment Required"), we simply skip keyword research and fall back
  // to seed-based topics. The pipeline never blocks on it.
  const hasDataForSeo =
    !!process.env.DATAFORSEO_BASE64 ||
    (!!process.env.DATAFORSEO_LOGIN && !!process.env.DATAFORSEO_PASSWORD);

  const today = fmt(new Date());
  console.log(`\n=== Morning report ${today} ===\n`);

  // 1. Expand keywords (skipped when candidates.json is fresh and has enough unused keywords)
  const used = await publishedKeywords();
  if (!hasDataForSeo) {
    console.log(
      "Step 1/3 — Skipping keyword expansion (no DataForSEO credentials). Using seed topics.",
    );
  } else {
    const refresh = await needsRefresh(used);
    if (refresh) {
      console.log("Step 1/3 — Expanding keywords (DataForSEO)...");
      await expandKeywords();
    } else {
      console.log(
        "Step 1/3 — Skipping keyword expansion (candidates.json is fresh and has ≥20 unused keywords).",
      );
    }
  }

  console.log("\nStep 2/3 — Selecting topic...");
  let topic: Awaited<ReturnType<typeof selectTopic>>;
  try {
    topic = await selectTopic();
  } catch (err) {
    console.error("Topic selection failed:", (err as Error).message);
    process.exit(1);
  }

  // 3. GSC quick wins
  console.log("\nStep 3/4 — Google Search Console quick wins...");
  let gscWins: Awaited<ReturnType<typeof quickWins>> = [];
  let gscTop: Awaited<ReturnType<typeof topQueries>> = [];
  const hasGscAuth =
    !!process.env.GOOGLE_JSON ||
    (!!process.env.GSC_CLIENT_ID &&
      !!process.env.GSC_CLIENT_SECRET &&
      !!process.env.GSC_REFRESH_TOKEN);
  const hasGsc = hasGscAuth && !!process.env.GSC_SITE_URL;
  if (hasGsc) {
    try {
      [gscWins, gscTop] = await Promise.all([quickWins(), topQueries()]);
    } catch (err) {
      console.warn("GSC failed (non-fatal):", (err as Error).message);
    }
  } else {
    console.log("  (skipped — GSC credentials not set)");
  }

  // 4. Reddit research on the target keyword
  console.log(`\nStep 4/4 — Reddit research for "${topic.keyword}"...`);
  let reddit: Awaited<ReturnType<typeof redditInsightReport>> | null = null;
  try {
    reddit = await redditInsightReport(topic.keyword, seeds.subreddits);
  } catch (err) {
    console.warn("Reddit research failed (non-fatal):", (err as Error).message);
  }

  // 5. Build the Markdown report
  console.log("\nWriting report...");

  const lines: string[] = [];

  lines.push(`# Morning Report — ${today}`);
  lines.push("");
  lines.push(`## Target keyword: \`${topic.keyword}\``);
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Search volume | ${topic.searchVolume} / mo |`);
  lines.push(`| Keyword difficulty | ${topic.difficulty} / 100 |`);
  lines.push(`| CPC | $${topic.cpc} |`);
  lines.push(`| Intent | ${topic.intent ?? "—"} |`);
  lines.push(`| Pillar | ${topic.pillar} |`);
  lines.push(`| Opportunity score | ${topic.score} |`);
  lines.push("");

  lines.push("## People Also Ask");
  lines.push("");
  if (topic.paa?.length) {
    for (const q of topic.paa) lines.push(`- ${q}`);
  } else {
    lines.push("_No PAA data available._");
  }
  lines.push("");

  // Load all candidates to show related keyword opportunities
  const { candidates } = await loadCandidates();

  const relatedKeywords = candidates
    .filter(
      (c) =>
        c.pillar === topic.pillar &&
        c.keyword.toLowerCase() !== topic.keyword.toLowerCase(),
    )
    .slice(0, 20);

  const clusterKeywords = candidates
    .filter((c) => c.pillar !== topic.pillar)
    .slice(0, 10);

  lines.push("## Keyword opportunities — same pillar");
  lines.push("");
  lines.push(
    `_Top candidates in the **${topic.pillar}** pillar to build a content cluster._`,
  );
  lines.push("");
  if (relatedKeywords.length) {
    lines.push(
      mdTable(
        relatedKeywords.map((c) => ({
          keyword: c.keyword,
          vol: c.searchVolume,
          KD: c.difficulty,
          intent: c.intent ?? "—",
          score: c.score,
        })),
      ),
    );
  } else {
    lines.push("_No related candidates found._");
  }
  lines.push("");

  lines.push("## Keyword opportunities — other pillars");
  lines.push("");
  lines.push(
    "_Top candidates across other pillars — potential future topics._",
  );
  lines.push("");
  if (clusterKeywords.length) {
    lines.push(
      mdTable(
        clusterKeywords.map((c) => ({
          keyword: c.keyword,
          vol: c.searchVolume,
          KD: c.difficulty,
          intent: c.intent ?? "—",
          pillar: c.pillar,
          score: c.score,
        })),
      ),
    );
  } else {
    lines.push("_No candidates found._");
  }
  lines.push("");

  if (gscWins.length || gscTop.length) {
    lines.push("## GSC — Quick wins (position 5–20)");
    lines.push("");
    lines.push(
      "_Keywords already ranking but leaving clicks on the table. Optimise the existing page or write a supporting article._",
    );
    lines.push("");
    if (gscWins.length) {
      lines.push(
        mdTable(
          gscWins.map((r) => ({
            keyword: r.keyword,
            page: r.page.replace("https://" + process.env.DOMAIN, ""),
            pos: r.position,
            impr: r.impressions,
            clicks: r.clicks,
            "CTR%": r.ctr,
          })),
        ),
      );
    } else {
      lines.push("_No quick wins found (site may be too new)._");
    }
    lines.push("");

    if (gscTop.length) {
      lines.push("### Top queries (by clicks)");
      lines.push("");
      lines.push(
        mdTable(
          gscTop.map((r) => ({
            keyword: r.keyword,
            pos: r.position,
            clicks: r.clicks,
            impr: r.impressions,
          })),
        ),
      );
      lines.push("");
    }
  }

  if (reddit) {
    lines.push("## Reddit insights");
    lines.push("");
    lines.push(
      `**${reddit.totalPosts} posts** found across ${seeds.subreddits.length} subreddits.`,
    );
    lines.push("");

    lines.push("### Top questions");
    lines.push("");
    if (reddit.topQuestions.length) {
      for (const q of reddit.topQuestions) lines.push(`- ${q}`);
    } else {
      lines.push("_None found._");
    }
    lines.push("");

    lines.push("### Recurring themes");
    lines.push("");
    lines.push(reddit.recurringThemes.join(", ") || "_None detected._");
    lines.push("");

    lines.push("### Most upvoted posts");
    lines.push("");
    lines.push(
      mdTable(
        reddit.notablePostsByScore.map((p) => ({
          score: p.score,
          comments: p.numComments,
          subreddit: `r/${p.subreddit}`,
          title: p.title.slice(0, 80),
          url: p.url,
        })),
      ),
    );
    lines.push("");

    lines.push("### Most recent posts");
    lines.push("");
    lines.push(
      mdTable(
        reddit.recentPosts.map((p) => ({
          date: fmt(p.created),
          subreddit: `r/${p.subreddit}`,
          title: p.title.slice(0, 80),
          url: p.url,
        })),
      ),
    );
    lines.push("");
  }

  lines.push("## Decision");
  lines.push("");
  lines.push(
    `**Recommended action:** Write an article targeting \`${topic.keyword}\` (pillar: ${topic.pillar}).`,
  );
  lines.push("");
  lines.push(
    "Run the \`daily-blog\` skill in Claude Code to generate the article:",
  );
  lines.push("```");
  lines.push(
    `/daily-blog   # will use today's topic from pipeline/out/today-topic.json`,
  );
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push(`_Generated at ${new Date().toISOString()}_`);

  const report = lines.join("\n");

  await mkdir(outDir, { recursive: true });
  const reportPath = join(outDir, "morning-report.md");
  await writeFile(reportPath, report);

  // Also write a machine-readable summary for the GitHub Actions step summary
  const summary = {
    date: today,
    keyword: topic.keyword,
    volume: topic.searchVolume,
    difficulty: topic.difficulty,
    intent: topic.intent,
    pillar: topic.pillar,
    score: topic.score,
    redditPosts: reddit?.totalPosts ?? 0,
    topQuestions: reddit?.topQuestions.slice(0, 5) ?? [],
  };
  await writeFile(
    join(outDir, "morning-summary.json"),
    JSON.stringify(summary, null, 2),
  );

  console.log(`\nReport written to pipeline/out/morning-report.md`);
  console.log("\n" + "=".repeat(60));
  console.log(report);
  console.log("=".repeat(60));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
