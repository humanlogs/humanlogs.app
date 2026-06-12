---
name: daily-blog
description: Write a new SEO blog article from the pipeline research (pipeline/out/today-topic.json + morning-report.md) and save it to content/blog/. Use after the seo-research skill has produced today's topic, or whenever you need to draft a publishable blog post that matches the site's format. Brand, audience and tone come from the brand-voice skill (brand-voice).
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
---

# Daily blog writer

Turn the day's SEO research into a polished, publishable article for the blog.
This skill covers the **process and format**; everything brand-specific
(audience, language, tone, product facts, CTA rules) lives in the brand-voice
skill — read `.claude/skills/brand-voice/SKILL.md` before writing and
follow it throughout.

## Inputs

- `pipeline/out/today-topic.json` — chosen keyword, intent, difficulty, volume,
  `paa` (People-Also-Ask questions), `topResults` (SERP competitors), `pillar`.
- `pipeline/out/morning-report.md` — fuller brief incl. Reddit questions & themes.
- `.claude/skills/brand-voice/SKILL.md` — the brand voice guide.

If the pipeline files don't exist yet, run the `seo-research` skill first.

## Output format (must match the blog engine)

Save the article to `content/blog/<slug>.md` where `<slug>` is a short,
hyphenated, accent-free version of the target keyword.

The file MUST start with this frontmatter (parsed by `src/utils/blog.ts`):

```markdown
---
title: "..."            # compelling, includes the target keyword, < 65 chars ideal
date: "YYYY-MM-DD"      # today's date
description: "..."      # 140-160 chars meta description (used as excerpt)
locale: "fr"
author: "..."           # per the brand-voice skill
tags: ["pillar", "theme"]
targetKeyword: "..."    # exact keyword from today-topic.json (used for dedup)
pillar: "..."           # pillar from today-topic.json
---
```

`title`, `date` and `description` are required — the post is skipped at build
time if any is missing.

## Writing rules

1. **Ground every section in the research.** Use the PAA questions as section
   headings or an FAQ. Address the themes surfaced from Reddit. Cover the angle
   that the top SERP results miss.
2. **Structure**: short intro that states the reader's problem, then `##`
   sections (use `###` for sub-points), and a closing section that connects to
   the product as defined by the brand-voice skill. Aim for 900-1400 words.
3. **Place the target keyword** in the title, the intro, at least one `##`
   heading and the meta description, without keyword stuffing.
4. Markdown only (the engine renders GFM: headings, lists, tables, links, bold).
5. **No invented facts, prices or legal claims.** Product claims must come from
   the brand-voice skill, nothing else.

## Steps

1. Read `.claude/skills/brand-voice/SKILL.md` (brand voice), then
   `pipeline/out/today-topic.json` and `pipeline/out/morning-report.md`.
2. Check `content/blog/` (and the `targetKeyword:` lines) to avoid duplicating an
   existing article.
3. Write `content/blog/<slug>.md` following the format above.
4. Clean AI writing artefacts (em dashes, smart quotes, filler):

   ```bash
   cd pipeline && npm install --silent && npm run clean -- ../content/blog/<slug>.md
   ```

5. Report the new file path, title and target keyword.

When run in CI, after writing the file, commit it to a new branch and open a pull
request (the workflow grants `contents: write` and `pull-requests: write`).
