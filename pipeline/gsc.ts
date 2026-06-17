/**
 * Google Search Console client — read-only search analytics.
 *
 * Auth (either one):
 *   - `GOOGLE_JSON` containing either:
 *       a service-account key (client_email + private_key; the service
 *       account email must be added as a user on the GSC property), or
 *       an OAuth bundle: {"refresh_token", "oauth_client_id",
 *       "oauth_client_secret"}.
 *   - OAuth 2.0 refresh token flow via separate env vars:
 *     GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN.
 * Always requires `GSC_SITE_URL`
 */

import crypto from "node:crypto";

const GOOGLE_JSON = process.env.GOOGLE_JSON ?? "";
const CLIENT_ID = process.env.GSC_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GSC_CLIENT_SECRET ?? "";
const REFRESH_TOKEN = process.env.GSC_REFRESH_TOKEN ?? "";
const SITE_URL = process.env.GSC_SITE_URL ?? "";

const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export interface GscRow {
  keyword: string;
  page: string;
  position: number;
  impressions: number;
  clicks: number;
  ctr: number;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Service account → access token via a signed JWT (RS256), no extra deps.
async function serviceAccountToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: GSC_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${base64url(signer.sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`GSC service-account token error ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  if (!json.access_token) throw new Error("No access_token in GSC service-account response");
  return json.access_token;
}

async function refreshTokenFlow(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`GSC token error ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  if (!json.access_token) throw new Error("No access_token in GSC response");
  return json.access_token;
}

async function getAccessToken(): Promise<string> {
  if (GOOGLE_JSON) {
    let creds: any;
    try {
      creds = JSON.parse(GOOGLE_JSON);
    } catch {
      throw new Error("GOOGLE_JSON is not valid JSON");
    }
    if (creds.client_email && creds.private_key) return serviceAccountToken(creds);
    if (creds.refresh_token) {
      return refreshTokenFlow(
        creds.oauth_client_id ?? creds.client_id ?? CLIENT_ID,
        creds.oauth_client_secret ?? creds.client_secret ?? CLIENT_SECRET,
        creds.refresh_token,
      );
    }
    throw new Error(
      `GOOGLE_JSON has keys [${Object.keys(creds).join(", ")}] — expected either ` +
        "a service-account key (client_email + private_key) or an OAuth bundle " +
        "(refresh_token + oauth_client_id + oauth_client_secret).",
    );
  }
  return refreshTokenFlow(CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN);
}

async function searchAnalytics(
  token: string,
  body: Record<string, unknown>,
): Promise<any[]> {
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`GSC API error ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  return json.rows ?? [];
}

/**
 * Keywords ranking 5–20 with decent impressions but low CTR — the quick wins.
 * Sorted by impressions desc so the highest-traffic opportunities come first.
 */
export async function quickWins(days = 28, limit = 20): Promise<GscRow[]> {
  const token = await getAccessToken();
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const rows = await searchAnalytics(token, {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: ["query", "page"],
    rowLimit: 500,
  });

  return rows
    .filter((r: any) => {
      const p: number = r.position;
      return p >= 5 && p <= 20 && r.impressions >= 20;
    })
    .sort((a: any, b: any) => b.impressions - a.impressions)
    .slice(0, limit)
    .map((r: any) => ({
      keyword: r.keys[0],
      page: r.keys[1],
      position: +r.position.toFixed(1),
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: +(r.ctr * 100).toFixed(1),
    }));
}

/**
 * Queries with PROVEN demand for the feedback loop: every query Google
 * already shows the site for (≥ minImpressions over the window), excluding
 * the top-3 positions (those don't need a new article). Aggregated per
 * query (page dimension omitted). Free API — safe to call on every run.
 */
export async function provenQueries(days = 28, minImpressions = 3): Promise<GscRow[]> {
  const token = await getAccessToken();
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const rows = await searchAnalytics(token, {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: ["query"],
    rowLimit: 1000,
  });

  return rows
    .filter((r: any) => r.impressions >= minImpressions && r.position > 3)
    .map((r: any) => ({
      keyword: r.keys[0],
      page: "",
      position: +r.position.toFixed(1),
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: +(r.ctr * 100).toFixed(1),
    }));
}

/**
 * Top queries overall — useful for spotting what's already driving traffic.
 */
export async function topQueries(days = 28, limit = 10): Promise<GscRow[]> {
  const token = await getAccessToken();
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const rows = await searchAnalytics(token, {
    startDate: fmt(startDate),
    endDate: fmt(endDate),
    dimensions: ["query", "page"],
    rowLimit: limit,
    orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
  });

  return rows.map((r: any) => ({
    keyword: r.keys[0],
    page: r.keys[1],
    position: +r.position.toFixed(1),
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: +(r.ctr * 100).toFixed(1),
  }));
}
