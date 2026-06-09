# Analytics Report — Setup Guide

Cross-property report pulling **Google Search Console** (all verified sites) and **Google Analytics 4** (all accessible accounts) into a single Markdown report. Runs manually via GitHub Actions; results appear in the workflow's Step Summary and as a downloadable artifact.

---

## 1. Add GitHub Secrets

In your repository: **Settings → Secrets and variables → Actions → New repository secret**

### `GOOGLE_JSON`
A JSON string with the OAuth credentials:
```json
{
  "refresh_token": "...",
  "oauth_client_id": "...",
  "oauth_client_secret": "..."
}
```
The OAuth app must have these scopes granted:
- `https://www.googleapis.com/auth/webmasters.readonly`
- `https://www.googleapis.com/auth/analytics.readonly`

Also make sure the **Google Analytics Data API** is enabled in the Google Cloud project that owns the OAuth client:
> https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview

### `DATAFORSEO_BASE64` _(optional — reserved for future keyword data)_
Base64 encoding of `login:password`:
```bash
echo -n "your@email.com:yourpassword" | base64
```

---

## 2. Add files to your repository

Copy these into your repo (preserving the directory structure):

```
.github/workflows/analytics-report.yml
pipeline/analyze-properties.ts
package.json
```

Install dependencies:
```bash
npm install
```

---

## 3. Run the workflow

1. Go to **Actions → Analytics Report → Run workflow**
2. Click **Run workflow**
3. Once complete, open the run and check:
   - **Summary** tab — full Markdown report rendered inline
   - **Artifacts** — download `analytics-report-<run-id>` for the `.md` file

---

## 4. Run locally

```bash
GOOGLE_JSON='{"refresh_token":"...","oauth_client_id":"...","oauth_client_secret":"..."}' npm run report
```

Output is written to `out/analytics-report-YYYY-MM-DD.md`.

---

## What the report covers

**Google Search Console** — for every verified site:
- 28-day totals: clicks, impressions, average position, CTR
- Top 5 queries by clicks
- Quick wins: queries ranking position 5–20 with ≥10 impressions
- Top pages by clicks

**Google Analytics 4** — for every accessible account and property:
- 28-day overview: users, new users, sessions, pageviews, bounce rate, avg session duration
- 7-day vs previous 7-day trend
- Top pages by views
- Traffic channels
- Top countries
