/**
 * Reddit research client — read-only, no user login required.
 *
 * Uses the "application-only" OAuth flow (client_credentials) which works
 * for all public subreddit data: posts, comments, search results.
 *
 * When no credentials are set (or OAuth fails), it falls back to the public
 * unauthenticated JSON endpoints (www.reddit.com/...*.json). Those are
 * rate-limited to ~10 requests/min per IP, so the fallback throttles itself
 * and retries once on 429.
 *
 * Env vars (all optional thanks to the fallback):
 *   REDDIT_CLIENT_ID      — from reddit.com/prefs/apps (under the app name)
 *   REDDIT_CLIENT_SECRET  — the "secret" field of your script app
 *   REDDIT_USER_AGENT     — required by Reddit TOS
 */

import "dotenv/config";

const CLIENT_ID = process.env.REDDIT_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET ?? "";
const USER_AGENT = process.env.REDDIT_USER_AGENT ?? "growth/0.1 (research bot)";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn(
    "[reddit] REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set — " +
      "falling back to the public JSON endpoints (slower, ~10 req/min).",
  );
}

// ---------- Auth ----------

let _token: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Reddit auth failed ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  _token = json.access_token;
  _tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return _token!;
}

// Once OAuth fails (bad/missing credentials), stop retrying it and use the
// public endpoints for the rest of the run.
let _publicMode = !CLIENT_ID || !CLIENT_SECRET;

// The public endpoints are rate-limited per IP (~10 req/min), so space the
// requests out. OAuth allows 100 req/min, so a much smaller gap is enough.
// Chained promise so concurrent calls (Promise.all) queue up one by one.
let _chain: Promise<void> = Promise.resolve();
let _lastRequest = 0;
function throttle(minGapMs: number): Promise<void> {
  const p = _chain.then(async () => {
    const wait = _lastRequest + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    _lastRequest = Date.now();
  });
  _chain = p.catch(() => {});
  return p;
}

async function api<T = any>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  let token: string | null = null;
  if (!_publicMode) {
    try {
      token = await getToken();
    } catch (err) {
      console.warn(`[reddit] ${(err as Error).message} — falling back to public JSON endpoints.`);
      _publicMode = true;
    }
  }

  const url = token
    ? new URL(`https://oauth.reddit.com${path}`)
    : new URL(`https://www.reddit.com${path}.json`);
  url.searchParams.set("raw_json", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (token) headers.Authorization = `Bearer ${token}`;

  await throttle(token ? 200 : 6500);
  let res = await fetch(url.toString(), { headers });
  if (res.status === 429) {
    // Rate limited — wait and retry once
    await new Promise((r) => setTimeout(r, 15_000));
    _lastRequest = Date.now();
    res = await fetch(url.toString(), { headers });
  }
  if (!res.ok) throw new Error(`Reddit API ${res.status} on ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ---------- Types ----------

export interface RedditPost {
  id: string;
  title: string;
  url: string;
  subreddit: string;
  score: number;
  numComments: number;
  created: Date;
  selftext: string;       // post body (empty for links)
  isQuestion: boolean;
  permalink: string;
  flair: string | null;
}

export interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created: Date;
  permalink: string;
}

export interface SubredditInsights {
  subreddit: string;
  keyword: string;
  hotPosts: RedditPost[];
  newPosts: RedditPost[];
  topPosts: RedditPost[];   // top of the month
  questions: RedditPost[];  // posts whose title ends with "?"
}

// ---------- Helpers ----------

function mapPost(child: any): RedditPost {
  const d = child.data;
  return {
    id: d.id,
    title: d.title,
    url: `https://reddit.com${d.permalink}`,
    permalink: d.permalink,
    subreddit: d.subreddit,
    score: d.score,
    numComments: d.num_comments,
    created: new Date(d.created_utc * 1000),
    selftext: (d.selftext ?? "").slice(0, 2000),
    isQuestion: d.title?.trim().endsWith("?") ?? false,
    flair: d.link_flair_text ?? null,
  };
}

function mapComment(child: any): RedditComment {
  const d = child.data;
  return {
    id: d.id,
    author: d.author,
    body: (d.body ?? "").slice(0, 1000),
    score: d.score,
    created: new Date(d.created_utc * 1000),
    permalink: `https://reddit.com${d.permalink}`,
  };
}

// ---------- Public API ----------

/**
 * Search a specific subreddit for a keyword.
 * sort: relevance | new | hot | top | comments
 */
export async function searchSubreddit(
  subreddit: string,
  query: string,
  opts: { sort?: "relevance" | "new" | "hot" | "top" | "comments"; limit?: number; time?: "hour" | "day" | "week" | "month" | "year" | "all" } = {},
): Promise<RedditPost[]> {
  const { sort = "relevance", limit = 25, time = "year" } = opts;
  const json: any = await api(`/r/${subreddit}/search`, {
    q: query,
    restrict_sr: 1,
    sort,
    t: time,
    limit,
  });
  return (json.data?.children ?? []).map(mapPost);
}

/**
 * Search across all of Reddit (not restricted to one sub).
 */
export async function searchAll(
  query: string,
  opts: { sort?: "relevance" | "new" | "hot" | "top"; limit?: number; time?: string } = {},
): Promise<RedditPost[]> {
  const { sort = "relevance", limit = 25, time = "year" } = opts;
  const json: any = await api(`/search`, { q: query, sort, t: time, limit });
  return (json.data?.children ?? []).map(mapPost);
}

/**
 * Hot / new / top posts from a subreddit (no search query needed).
 */
export async function listingSubreddit(
  subreddit: string,
  feed: "hot" | "new" | "top" | "rising" = "hot",
  opts: { limit?: number; time?: string } = {},
): Promise<RedditPost[]> {
  const { limit = 25, time = "month" } = opts;
  const params: Record<string, string | number> = { limit };
  if (feed === "top") params.t = time;
  const json: any = await api(`/r/${subreddit}/${feed}`, params);
  return (json.data?.children ?? []).map(mapPost);
}

/**
 * Full research pass on a list of subreddits for a given keyword.
 * Returns combined insights: questions, recent posts, top posts.
 */
export async function researchKeyword(
  keyword: string,
  subreddits: string[],
  opts: { postsPerSub?: number } = {},
): Promise<SubredditInsights[]> {
  const { postsPerSub = 15 } = opts;
  const results: SubredditInsights[] = [];

  for (const sub of subreddits) {
    process.stdout.write(`  Reddit r/${sub} "${keyword}"... `);
    try {
      const [relevance, recent, top] = await Promise.all([
        searchSubreddit(sub, keyword, { sort: "relevance", limit: postsPerSub, time: "all" }),
        searchSubreddit(sub, keyword, { sort: "new", limit: postsPerSub, time: "year" }),
        searchSubreddit(sub, keyword, { sort: "top", limit: postsPerSub, time: "year" }),
      ]);

      const seen = new Set<string>();
      const allPosts = [...relevance, ...recent, ...top].filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      const questions = allPosts.filter((p) => p.isQuestion);
      console.log(`${allPosts.length} posts (${questions.length} questions)`);

      results.push({
        subreddit: sub,
        keyword,
        hotPosts: relevance,
        newPosts: recent,
        topPosts: top,
        questions,
      });
    } catch (err) {
      console.log(`skipped (${(err as Error).message})`);
    }
  }

  return results;
}

/**
 * Fetch top-level comments for a post (useful to understand what people say).
 */
export async function getPostComments(
  subreddit: string,
  postId: string,
  limit = 20,
): Promise<{ post: RedditPost; topComments: RedditComment[] }> {
  const json: any = await api(`/r/${subreddit}/comments/${postId}`, {
    limit,
    depth: 1,
    sort: "top",
  });

  const post = mapPost(json[0].data.children[0]);
  const topComments = (json[1]?.data?.children ?? [])
    .filter((c: any) => c.kind === "t1")
    .map(mapComment)
    .slice(0, limit);

  return { post, topComments };
}

/**
 * Quick summary of what people ask/say about a keyword across all target subs.
 * Returns a structured object ready to be passed to the article writer.
 */
export async function redditInsightReport(
  keyword: string,
  subreddits: string[],
): Promise<{
  keyword: string;
  totalPosts: number;
  topQuestions: string[];
  recurringThemes: string[];
  notablePostsByScore: RedditPost[];
  recentPosts: RedditPost[];
}> {
  const insights = await researchKeyword(keyword, subreddits, { postsPerSub: 20 });

  const allPosts: RedditPost[] = [];
  for (const s of insights) {
    allPosts.push(...s.hotPosts, ...s.newPosts, ...s.topPosts);
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  const topQuestions = unique
    .filter((p) => p.isQuestion)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((p) => p.title);

  const notablePostsByScore = [...unique]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const recentPosts = [...unique]
    .sort((a, b) => b.created.getTime() - a.created.getTime())
    .slice(0, 10);

  // Simple theme extraction: words that appear in ≥3 titles, longer than 5 chars
  const wordFreq: Record<string, number> = {};
  const stopwords = new Set(["about", "with", "this", "that", "what", "from", "have", "been", "will", "they", "their", "there", "when", "where", "which", "would", "could", "should", "using", "anyone"]);
  for (const p of unique) {
    const words = p.title.toLowerCase().match(/\b[a-z]{5,}\b/g) ?? [];
    for (const w of new Set(words)) {
      if (!stopwords.has(w)) wordFreq[w] = (wordFreq[w] ?? 0) + 1;
    }
  }
  const recurringThemes = Object.entries(wordFreq)
    .filter(([, n]) => n >= 3)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([w]) => w);

  return {
    keyword,
    totalPosts: unique.length,
    topQuestions,
    recurringThemes,
    notablePostsByScore,
    recentPosts,
  };
}
