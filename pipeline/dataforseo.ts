/**
 * Minimal DataForSEO client (Node 18+, global fetch).
 *
 * Docs: https://docs.dataforseo.com/v3/
 * Auth: HTTP Basic. Provide EITHER a ready-made base64 token
 *       (`DATAFORSEO_BASE64` = base64("login:password")) OR the raw
 *       `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` pair.
 * Find credentials at https://app.dataforseo.com/api-access
 */

const BASE = "https://api.dataforseo.com";

const BASE64 = process.env.DATAFORSEO_BASE64 ?? "";
const LOGIN = process.env.DATAFORSEO_LOGIN ?? "";
const PASSWORD = process.env.DATAFORSEO_PASSWORD ?? "";
const LOCATION = process.env.DFS_LOCATION_NAME ?? "United States";
const LANGUAGE = process.env.DFS_LANGUAGE_NAME ?? "English";

if (!BASE64 && (!LOGIN || !PASSWORD)) {
  console.warn(
    "[dataforseo] No credentials set. Provide DATAFORSEO_BASE64 " +
      "(base64 of \"login:password\") or DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD. " +
      "Copy .env.example to .env and fill it in.",
  );
}

function authHeader(): string {
  const token = BASE64 || Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");
  return "Basic " + token;
}

async function post<T = any>(path: string, task: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ location_name: LOCATION, language_name: LANGUAGE, ...task }]),
  });

  if (!res.ok) {
    throw new Error(`DataForSEO HTTP ${res.status}: ${await res.text()}`);
  }

  const json: any = await res.json();
  if (json.status_code !== 20000) {
    throw new Error(`DataForSEO error ${json.status_code}: ${json.status_message}`);
  }
  const taskResult = json.tasks?.[0];
  if (taskResult?.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${taskResult?.status_code}: ${taskResult?.status_message}`,
    );
  }
  return taskResult.result as T;
}

export interface KeywordMetric {
  keyword: string;
  searchVolume: number;
  difficulty: number;  // 0-100 KD
  cpc: number;         // USD
  competition: number; // 0-1 paid competition
  intent: string | null;
}

/**
 * Keyword suggestions — semantic variations around a seed.
 * https://docs.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live/
 */
export async function keywordSuggestions(
  seed: string,
  limit = 100,
): Promise<KeywordMetric[]> {
  const result = await post<any[]>(
    "/v3/dataforseo_labs/google/keyword_suggestions/live",
    { keyword: seed, limit, include_serp_info: false },
  );
  const items: any[] = result?.[0]?.items ?? [];
  return items.map(mapItem).filter((k) => k.keyword);
}

/**
 * Related keywords — broader associations including questions and comparisons.
 * Tends to surface "how to X", "X vs Y", "best X for Y" patterns.
 * https://docs.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live/
 */
export async function relatedKeywords(
  seed: string,
  limit = 100,
): Promise<KeywordMetric[]> {
  const result = await post<any[]>(
    "/v3/dataforseo_labs/google/related_keywords/live",
    { keyword: seed, limit, include_serp_info: false },
  );
  const items: any[] = result?.[0]?.items ?? [];
  // related_keywords wraps each item in a { keyword_data: {...} } shell
  return items
    .map((it) => mapItem(it.keyword_data ?? it))
    .filter((k) => k.keyword);
}

/**
 * Bulk keyword difficulty for an explicit list of keywords.
 * https://docs.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live/
 */
export async function bulkDifficulty(keywords: string[]): Promise<Record<string, number>> {
  const result = await post<any[]>(
    "/v3/dataforseo_labs/google/bulk_keyword_difficulty/live",
    { keywords },
  );
  const items: any[] = result?.[0]?.items ?? [];
  const out: Record<string, number> = {};
  for (const it of items) out[it.keyword] = it.keyword_difficulty ?? 0;
  return out;
}

/**
 * SERP organic + PAA (depth 100 to catch multiple PAA blocks).
 * https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/
 */
export async function serpInsights(
  keyword: string,
): Promise<{ paa: string[]; topResults: { title: string; url: string }[] }> {
  const result = await post<any[]>("/v3/serp/google/organic/live/advanced", {
    keyword,
    depth: 100,
  });
  const items: any[] = result?.[0]?.items ?? [];
  const paa: string[] = [];
  const topResults: { title: string; url: string }[] = [];
  for (const it of items) {
    if (it.type === "people_also_ask") {
      for (const q of it.items ?? []) if (q.title) paa.push(q.title);
    }
    if (it.type === "organic" && it.title && it.url) {
      topResults.push({ title: it.title, url: it.url });
    }
  }
  return { paa, topResults };
}

/**
 * Dedicated PAA endpoint — expands the question tree (up to ~40 cascaded questions).
 * Run this in parallel with serpInsights for richer FAQ coverage.
 * https://docs.dataforseo.com/v3/serp/google/people_also_ask/live/
 */
export async function peopleAlsoAsk(keyword: string): Promise<string[]> {
  try {
    const result = await post<any[]>("/v3/serp/google/people_also_ask/live/advanced", {
      keyword,
      depth: 4,
    });
    const items: any[] = result?.[0]?.items ?? [];
    const questions: string[] = [];
    function extract(nodes: any[]) {
      for (const node of nodes) {
        if (node.title) questions.push(node.title);
        if (node.items?.length) extract(node.items);
      }
    }
    extract(items);
    return [...new Set(questions)];
  } catch {
    return [];
  }
}

function mapItem(it: any): KeywordMetric {
  const info = it.keyword_info ?? {};
  const props = it.keyword_properties ?? {};
  const search = it.search_intent_info ?? {};
  return {
    keyword: it.keyword ?? "",
    searchVolume: info.search_volume ?? 0,
    difficulty: props.keyword_difficulty ?? 0,
    cpc: info.cpc ?? 0,
    competition: info.competition ?? 0,
    intent: search.main_intent ?? null,
  };
}
