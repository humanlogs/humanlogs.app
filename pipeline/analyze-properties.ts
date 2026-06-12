/**
 * Cross-property analytics report — GSC + GA4.
 *
 * Reads credentials from environment variables:
 *   GOOGLE_JSON  — JSON string: { refresh_token, oauth_client_id, oauth_client_secret }
 *   DATAFORSEO_BASE64 — base64 of "login:password" (optional, for future DataForSEO calls)
 *   GSC_SITE_URL  — override default site (optional)
 */

const googleJson = JSON.parse(process.env.GOOGLE_JSON ?? "{}");
const CLIENT_ID = googleJson.oauth_client_id ?? "";
const CLIENT_SECRET = googleJson.oauth_client_secret ?? "";
const REFRESH_TOKEN = googleJson.refresh_token ?? "";

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error("Missing GOOGLE_JSON or incomplete fields (oauth_client_id, oauth_client_secret, refresh_token)");
  process.exit(1);
}

const endDate = new Date();
const s28 = new Date(endDate); s28.setDate(s28.getDate() - 28);
const s7  = new Date(endDate); s7.setDate(s7.getDate() - 7);
const s7p = new Date(s7);     s7p.setDate(s7p.getDate() - 7);
const fmt = (d: Date) => d.toISOString().slice(0, 10);

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token error: ${await res.text()}`);
  return ((await res.json()) as any).access_token;
}

// ── GSC ──────────────────────────────────────────────────────────────────────

async function gscQuery(token: string, site: string, body: any): Promise<any[]> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  if (!res.ok) return [];
  return ((await res.json()) as any).rows ?? [];
}

async function analyzeGSC(token: string): Promise<string> {
  const sitesRes = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sites: string[] = ((await sitesRes.json()) as any).siteEntry?.map((s: any) => s.siteUrl) ?? [];

  let md = `## Google Search Console\n\n`;
  md += `| Property | Clicks | Impressions | Avg pos | CTR |\n|---|---|---|---|---|\n`;

  const details: string[] = [];

  for (const site of sites) {
    const label = site.replace("sc-domain:", "");
    const rows = await gscQuery(token, site, {
      startDate: fmt(s28), endDate: fmt(endDate), dimensions: ["query"], rowLimit: 500,
    });
    const totals = rows.reduce((a, r) => { a.clicks += r.clicks; a.impressions += r.impressions; return a; }, { clicks: 0, impressions: 0 });
    const avgPos = rows.length
      ? (rows.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(totals.impressions, 1)).toFixed(1)
      : "–";
    const ctr = totals.impressions ? ((totals.clicks / totals.impressions) * 100).toFixed(1) : "0.0";
    md += `| **${label}** | ${totals.clicks} | ${totals.impressions} | ${avgPos} | ${ctr}% |\n`;

    const top5 = [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
    const wins = rows.filter(r => r.position >= 5 && r.position <= 20 && r.impressions >= 10)
      .sort((a, b) => b.impressions - a.impressions).slice(0, 5);

    const pageRows = await gscQuery(token, site, {
      startDate: fmt(s28), endDate: fmt(endDate), dimensions: ["page"], rowLimit: 500,
      orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
    });

    let detail = `### GSC — ${label}\n\n`;
    detail += `**28 days:** ${totals.clicks} clicks · ${totals.impressions} impressions · pos ${avgPos} · CTR ${ctr}%\n\n`;

    if (top5.length) {
      detail += `**Top queries by clicks:**\n`;
      top5.forEach(r => detail += `- \`${r.keys[0]}\` — clicks: ${r.clicks}, impr: ${r.impressions}, pos: ${r.position.toFixed(1)}\n`);
      detail += "\n";
    }
    if (wins.length) {
      detail += `**Quick wins (pos 5–20, ≥10 impressions):**\n`;
      wins.forEach(r => detail += `- \`${r.keys[0]}\` — pos: ${r.position.toFixed(1)}, impr: ${r.impressions}, clicks: ${r.clicks}\n`);
      detail += "\n";
    }
    if (pageRows.length) {
      detail += `**Top pages:**\n`;
      pageRows.slice(0, 5).forEach(r => {
        const page = r.keys[0].replace(/^https?:\/\/[^/]+/, "") || "/";
        detail += `- \`${page}\` — clicks: ${r.clicks}, impr: ${r.impressions}\n`;
      });
      detail += "\n";
    }
    details.push(detail);
  }

  return md + "\n" + details.join("\n---\n\n");
}

// ── GA4 ──────────────────────────────────────────────────────────────────────

async function ga4Report(token: string, propertyId: string, body: any): Promise<any> {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

function totalsFrom(j: any): string[] {
  // No-dimension reports return rows[0]; with date ranges they return totals
  return j?.totals?.[0]?.metricValues?.map((m: any) => m.value)
    ?? j?.rows?.[0]?.metricValues?.map((m: any) => m.value)
    ?? [];
}

async function analyzeGA4Property(token: string, id: string, name: string): Promise<string> {
  let md = `### GA4 — ${name} (\`${id}\`)\n\n`;

  const ov = await ga4Report(token, id, {
    dateRanges: [{ startDate: fmt(s28), endDate: fmt(endDate) }],
    metrics: [{ name: "activeUsers" }, { name: "newUsers" }, { name: "sessions" },
              { name: "screenPageViews" }, { name: "bounceRate" }, { name: "averageSessionDuration" }],
  });
  const [users, newU, sess, views, bounce, dur] = totalsFrom(ov);
  if (!users) { md += "_No data for this period._\n\n"; return md; }
  md += `**28d:** users: ${users} (${newU} new) · sessions: ${sess} · views: ${views} · bounce: ${(+bounce*100).toFixed(0)}% · avg session: ${(+dur/60).toFixed(1)}min\n\n`;

  const wk = await ga4Report(token, id, {
    dateRanges: [
      { startDate: fmt(s7),  endDate: fmt(endDate), name: "cur" },
      { startDate: fmt(s7p), endDate: fmt(s7),       name: "prev" },
    ],
    metrics: [{ name: "activeUsers" }, { name: "sessions" }],
  });
  if (wk?.totals?.length === 2) {
    const [c, p] = wk.totals.map((t: any) => t.metricValues.map((m: any) => +m.value));
    md += `**7d vs prev 7d:** users ${c[0]} (${c[0]-p[0]>=0?"+":""}${c[0]-p[0]}) · sessions ${c[1]} (${c[1]-p[1]>=0?"+":""}${c[1]-p[1]})\n\n`;
  }

  const pg = await ga4Report(token, id, {
    dateRanges: [{ startDate: fmt(s28), endDate: fmt(endDate) }],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }], limit: 8,
  });
  if (pg?.rows?.length) {
    md += `**Top pages:**\n`;
    pg.rows.forEach((r: any) => md += `- \`${r.dimensionValues[0].value}\` — views: ${r.metricValues[0].value}, users: ${r.metricValues[1].value}\n`);
    md += "\n";
  }

  const ch = await ga4Report(token, id, {
    dateRanges: [{ startDate: fmt(s28), endDate: fmt(endDate) }],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [{ name: "sessions" }, { name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }], limit: 6,
  });
  if (ch?.rows?.length) {
    md += `**Channels:**\n`;
    ch.rows.forEach((r: any) => md += `- ${r.dimensionValues[0].value}: ${r.metricValues[0].value} sessions\n`);
    md += "\n";
  }

  const geo = await ga4Report(token, id, {
    dateRanges: [{ startDate: fmt(s28), endDate: fmt(endDate) }],
    dimensions: [{ name: "country" }],
    metrics: [{ name: "activeUsers" }],
    orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }], limit: 6,
  });
  if (geo?.rows?.length) {
    md += `**Countries:** ${geo.rows.map((r: any) => `${r.dimensionValues[0].value} (${r.metricValues[0].value})`).join(" · ")}\n\n`;
  }

  return md;
}

async function analyzeGA4(token: string): Promise<string> {
  const r = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json() as any;
  const accounts: any[] = j.accountSummaries ?? [];

  let md = `## Google Analytics 4\n\n`;
  for (const acc of accounts) {
    md += `### Account: ${acc.displayName}\n\n`;
    for (const prop of (acc.propertySummaries ?? [])) {
      const propId = prop.property.replace("properties/", "");
      md += await analyzeGA4Property(token, propId, prop.displayName);
      md += "---\n\n";
    }
  }
  return md;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const token = await getAccessToken();
  const dateLabel = endDate.toISOString().slice(0, 10);

  let report = `# Analytics Report — ${dateLabel}\n\n`;
  report += `_Period: ${fmt(s28)} → ${dateLabel} (28 days)_\n\n---\n\n`;
  report += await analyzeGSC(token);
  report += "\n---\n\n";
  report += await analyzeGA4(token);

  // Write to file + stdout for GitHub Step Summary
  const fs = await import("fs/promises");
  await fs.mkdir("out", { recursive: true });
  await fs.writeFile(`out/analytics-report-${dateLabel}.md`, report);
  process.stdout.write(report);
}

main().catch(e => { console.error(e.message); process.exit(1); });
