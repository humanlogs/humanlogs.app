---
name: seo-research
description: Run the SEO growth pipeline (DataForSEO keyword research + SERP/PAA + Reddit insights) to pick today's blog topic. Produces pipeline/out/today-topic.json and pipeline/out/morning-report.md. Use before writing a new blog article, or whenever you need fresh keyword opportunities for L'Inventaire.
allowed-tools: Bash, Read
---

# SEO research pipeline

This skill runs the growth pipeline in `pipeline/` to choose the best blog topic
for the day and gather the research a writer needs.

## What it produces

- `pipeline/out/candidates.json` — scored keyword opportunities
- `pipeline/out/today-topic.json` — the chosen keyword + People-Also-Ask + top SERP results
- `pipeline/out/morning-report.md` — a human-readable brief (keyword metrics, PAA, related keywords, Reddit questions & themes)

## Steps

The API credentials (DataForSEO, Reddit, Google Search Console) live in the
GitHub repository secrets — they are NOT available in local or remote Claude
Code sessions. So the research must run in GitHub Actions, not locally.

1. Trigger the research-only workflow `.github/workflows/seo-research.yml`
   (`workflow_dispatch`) on the branch you are working on, via the GitHub
   MCP tools (`actions_run_trigger` with `workflow_id: seo-research.yml`) or
   the Actions tab.

2. Wait for the run to complete (`actions_list` / `actions_get`), then read
   the job logs (`get_job_logs`): the workflow prints
   `pipeline/out/morning-report.md` and `pipeline/out/today-topic.json`
   between `===== BEGIN/END =====` markers. The full `pipeline/out/`
   directory is also uploaded as the `seo-research-out` artifact.

3. Summarise the recommended keyword, its intent/difficulty/volume, the top
   People-Also-Ask questions and the Reddit themes.

(Only if you do have the secrets locally in `pipeline/.env` —
`DATAFORSEO_BASE64`, optional `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`,
optional `GOOGLE_JSON` + `GSC_SITE_URL` — you can instead run
`cd pipeline && npm install && npm run morning` and read the same files
from `pipeline/out/`.)

## Notes

- The pipeline automatically skips keywords already covered by published articles
  (it reads `targetKeyword:` from the frontmatter of every file in `content/blog/`).
- **Costs**: everything paid to DataForSEO is persisted in `pipeline/data/`
  (committed — the workflows push it back after each run). Keyword expansion
  only re-runs when `candidates.json` is older than 7 days or has fewer than
  20 unused keywords; SERP/PAA results are cached per keyword forever. Never
  delete `pipeline/data/`, and never run keyword expansion manually unless
  the data is genuinely stale. `pipeline/out/` (report + today's topic) is
  ephemeral and cheap to regenerate.
- **GSC feedback loop**: at selection time, queries the site already gets
  impressions for (Search Console, free API) are merged into the candidate
  pool — existing candidates get boosted, unknown queries join under the
  `gsc-proven` pillar. Brand queries listed in `brandTerms`
  (`pipeline/seeds/fr.json`) are excluded.
- Market is configured for France/French in `pipeline/seeds/fr.json`. Adjust the
  pillars and subreddits there to steer the topics.

Once research is ready, hand off to the `daily-blog` skill to write the article.
