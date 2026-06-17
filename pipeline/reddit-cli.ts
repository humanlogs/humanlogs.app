/**
 * Quick CLI for ad-hoc Reddit research.
 *
 *   npm run reddit -- "logiciel de facturation"
 *   npm run reddit -- "gestion de stock" --subs=AutoEntrepreneur,vosfinances
 */
import "dotenv/config";
import { redditInsightReport } from "./reddit.js";
import seeds from "./seeds/fr.json" with { type: "json" };

const args = process.argv.slice(2);
const keyword = args.find((a) => !a.startsWith("--")) ?? "";
const subsArg = args
  .find((a) => a.startsWith("--subs="))
  ?.replace("--subs=", "");
const subreddits = subsArg ? subsArg.split(",") : seeds.subreddits;

if (!keyword) {
  console.error('Usage: npm run reddit -- "your keyword" [--subs=sub1,sub2]');
  process.exit(1);
}

console.log(`\nResearching "${keyword}" across: ${subreddits.join(", ")}\n`);
const report = await redditInsightReport(keyword, subreddits);

console.log(`\n=== REDDIT REPORT: "${report.keyword}" ===`);
console.log(`Total unique posts: ${report.totalPosts}`);

console.log("\n--- Top questions ---");
report.topQuestions.forEach((q, i) => console.log(`${i + 1}. ${q}`));

console.log("\n--- Recurring themes ---");
console.log(report.recurringThemes.join(", "));

console.log("\n--- Most upvoted posts ---");
for (const p of report.notablePostsByScore) {
  console.log(`[${p.score}↑ ${p.numComments}💬] r/${p.subreddit} — ${p.title}`);
  console.log(`  ${p.url}`);
}

console.log("\n--- Most recent posts ---");
for (const p of report.recentPosts) {
  console.log(
    `[${p.created.toISOString().slice(0, 10)}] r/${p.subreddit} — ${p.title}`,
  );
  console.log(`  ${p.url}`);
}
