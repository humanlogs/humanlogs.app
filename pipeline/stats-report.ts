/**
 * Fetch stats export and generate an HTML report.
 *
 *   STATS_API_URL=https://humanlogs.app/api/stats tsx stats-report.ts
 *
 * The endpoint is token-protected. Provide the token either by embedding it in
 * the URL (STATS_API_URL=https://humanlogs.app/api/stats?token=...) or via the
 * STATS_API_TOKEN env var, which is sent as an `Authorization: Bearer` header.
 *
 * Writes pipeline/out/stats-report.html and a plain-text summary to stdout
 * (used as GitHub Step Summary via >> $GITHUB_STEP_SUMMARY).
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "out");

const STATS_API_URL = process.env.STATS_API_URL;
if (!STATS_API_URL) {
  console.error("Missing STATS_API_URL environment variable.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchStats(): Promise<unknown> {
  const token = process.env.STATS_API_TOKEN;
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const res = await fetch(STATS_API_URL!, { headers });
  if (!res.ok) throw new Error(`API returned ${res.status} ${res.statusText}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString("en-US")
      : value.toFixed(2);
  }
  return String(value);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNumericMetric(v: unknown): v is number | string {
  return typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)));
}

/** Render a flat object whose leaf values are scalars as metric cards. */
function renderCards(data: Record<string, unknown>): string {
  const scalars = Object.entries(data).filter(([, v]) => isNumericMetric(v) || typeof v === "string");
  if (!scalars.length) return "";

  const cards = scalars
    .map(([k, v]) => {
      const label = k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const isNum = isNumericMetric(v);
      return `
      <div class="card">
        <div class="card-value ${isNum ? "numeric" : ""}">${fmt(v)}</div>
        <div class="card-label">${label}</div>
      </div>`;
    })
    .join("");

  return `<div class="cards">${cards}</div>`;
}

/** Render an array of objects as an HTML table. */
function renderTable(rows: Record<string, unknown>[], title: string): string {
  if (!rows.length) return `<p class="empty">No data for <strong>${title}</strong>.</p>`;
  const headers = Object.keys(rows[0]);
  const thead = `<tr>${headers.map((h) => `<th>${h.replace(/_/g, " ")}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((row) => `<tr>${headers.map((h) => `<td>${fmt(row[h])}</td>`).join("")}</tr>`)
    .join("");
  return `
  <section>
    <h2>${title.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h2>
    <div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>
  </section>`;
}

/** Walk the top-level keys and decide how to render each. */
function renderBody(data: unknown): string {
  if (!isPlainObject(data)) {
    return `<pre class="raw">${JSON.stringify(data, null, 2)}</pre>`;
  }

  const sections: string[] = [];
  const topScalars: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > 0 && isPlainObject(value[0])) {
      sections.push(renderTable(value as Record<string, unknown>[], key));
    } else if (isPlainObject(value)) {
      const inner = value as Record<string, unknown>;
      const innerScalars = Object.fromEntries(
        Object.entries(inner).filter(([, v]) => isNumericMetric(v) || typeof v === "string")
      );
      const innerArrays = Object.entries(inner).filter(
        ([, v]) => Array.isArray(v) && (v as unknown[]).length > 0 && isPlainObject((v as unknown[])[0])
      );
      if (Object.keys(innerScalars).length) {
        sections.push(`<section><h2>${key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h2>${renderCards(innerScalars)}</section>`);
      }
      for (const [k, v] of innerArrays) {
        sections.push(renderTable(v as Record<string, unknown>[], `${key} / ${k}`));
      }
    } else {
      topScalars[key] = value;
    }
  }

  const header = Object.keys(topScalars).length ? `<section><h2>Overview</h2>${renderCards(topScalars)}</section>` : "";
  return header + sections.join("\n");
}

// ---------------------------------------------------------------------------
// Plain-text summary for GitHub Step Summary
// ---------------------------------------------------------------------------

function buildSummary(data: unknown): string {
  const lines: string[] = ["## Stats Report\n"];
  if (!isPlainObject(data)) {
    lines.push("```json", JSON.stringify(data, null, 2), "```");
    return lines.join("\n");
  }

  function walk(obj: Record<string, unknown>, depth = 0) {
    for (const [k, v] of Object.entries(obj)) {
      const indent = "  ".repeat(depth);
      const label = k.replace(/_/g, " ");
      if (isNumericMetric(v)) {
        lines.push(`${indent}- **${label}**: ${fmt(v)}`);
      } else if (typeof v === "string") {
        lines.push(`${indent}- **${label}**: ${v}`);
      } else if (isPlainObject(v)) {
        lines.push(`${indent}### ${label}`);
        walk(v, depth + 1);
      } else if (Array.isArray(v)) {
        lines.push(`${indent}- **${label}**: ${v.length} rows`);
      }
    }
  }
  walk(data);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Full HTML page
// ---------------------------------------------------------------------------

function buildHtml(data: unknown, fetchedAt: string): string {
  const body = renderBody(data);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Stats Report ${fetchedAt}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f1117; color: #e2e8f0; padding: 2rem; }
  h1 { font-size: 1.5rem; margin-bottom: .25rem; }
  .meta { color: #64748b; font-size: .875rem; margin-bottom: 2.5rem; }
  section { margin-bottom: 2.5rem; }
  h2 { font-size: 1.1rem; font-weight: 600; color: #94a3b8; text-transform: uppercase;
       letter-spacing: .06em; margin-bottom: 1rem; border-bottom: 1px solid #1e293b; padding-bottom: .5rem; }
  .cards { display: flex; flex-wrap: wrap; gap: 1rem; }
  .card { background: #1e293b; border-radius: .75rem; padding: 1.25rem 1.5rem; min-width: 160px; flex: 1; }
  .card-value { font-size: 1.75rem; font-weight: 700; color: #f8fafc; }
  .card-value.numeric { color: #5184EC; }
  .card-label { font-size: .8rem; color: #64748b; margin-top: .25rem; text-transform: uppercase; letter-spacing: .05em; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: .875rem; }
  th { text-align: left; padding: .6rem .75rem; background: #1e293b; color: #94a3b8;
       text-transform: uppercase; font-size: .75rem; letter-spacing: .05em; white-space: nowrap; }
  td { padding: .6rem .75rem; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
  tr:hover td { background: #1e293b44; }
  .raw { background: #1e293b; padding: 1rem; border-radius: .5rem; font-size: .8rem;
         overflow-x: auto; color: #94a3b8; white-space: pre-wrap; }
  .empty { color: #475569; font-style: italic; }
</style>
</head>
<body>
<h1>Stats Report</h1>
<p class="meta">Generated ${fetchedAt} UTC</p>
${body}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const fetchedAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  console.log(`Fetching stats from API...`);

  const data = await fetchStats();

  await mkdir(OUT_DIR, { recursive: true });

  const htmlPath = join(OUT_DIR, "stats-report.html");
  await writeFile(htmlPath, buildHtml(data, fetchedAt), "utf8");
  console.log(`HTML report written to ${htmlPath}`);

  const jsonPath = join(OUT_DIR, "stats-raw.json");
  await writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
  console.log(`Raw JSON written to ${jsonPath}`);

  // GitHub Step Summary
  console.log("\n" + buildSummary(data));
}

main().catch((e) => { console.error(e); process.exit(1); });
