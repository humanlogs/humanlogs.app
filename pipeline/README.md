# Growth pipeline — L'Inventaire

SEO research stack that picks the best blog topic of the day and gathers the data
a writer needs.

## Scripts

| Command | Output | Purpose |
|---------|--------|---------|
| `npm run keywords` | `out/candidates.json` | Expand `seeds/fr.json` via DataForSEO → scored keyword candidates |
| `npm run topic` | `out/today-topic.json` | Pick today's keyword (skips already-published) + PAA + SERP |
| `npm run morning` | `out/morning-report.md` | Full daily brief: keywords + SERP + GSC quick wins + Reddit research |
| `npm run reddit` | — | Interactive Reddit search CLI |
| `npm run clean -- <file.md>` | — | Strip AI writing artefacts (em dashes, smart quotes, filler) |
| `npm run report` | — | Ad-hoc analysis script |

## Setup

```bash
cp .env.example .env   # fill in your API credentials
npm install
npm run morning        # writes out/morning-report.md + out/today-topic.json
```

### Environment variables

- `DATAFORSEO_BASE64` — required: base64 of `login:password` (or the raw
  `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` pair)
- `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` — optional (Reddit insights)
- `GOOGLE_JSON` (service-account JSON) + `GSC_SITE_URL` — optional (Search
  Console quick wins). OAuth `GSC_CLIENT_ID` / `GSC_CLIENT_SECRET` /
  `GSC_REFRESH_TOKEN` also supported as an alternative.
- `DFS_LOCATION_NAME` / `DFS_LANGUAGE_NAME` — default `France` / `French`

## How it fits together

1. `seeds/fr.json` defines content **pillars** (invoicing, e-invoicing, quotes,
   stock, accounting, CRM, open-source) and target **subreddits**.
2. `npm run morning` produces `out/today-topic.json` + `out/morning-report.md`.
3. The Claude Code **`daily-blog`** skill turns that research into a French
   article in `../content/blog/`, which the Next.js site renders at `/blog`.
4. The pipeline avoids re-targeting keywords already used: it reads
   `targetKeyword:` from the frontmatter of every published article.

This whole flow is wired into the manual GitHub Action
`.github/workflows/seo-blog.yml` (run it from the Actions tab).

## Scoring

`score = (searchVolume / (difficulty + 10)) × intentWeight × productFit`

Intent weights: transactional 1.5, commercial 1.4, informational 1.0, navigational 0.4.
