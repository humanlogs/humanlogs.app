import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { statsConfig } from "@/lib/config";
import { getAppStats } from "@/lib/stats/app-stats";

/**
 * Token-protected statistics export for the marketing pipeline
 * (`pipeline/stats-report.ts`, consumed via the STATS_API_URL env var).
 *
 * Unlike `/api/admin/stats` (session + admin gated, used by the in-app admin
 * dashboard), this endpoint is callable from automation without a user
 * session. It is guarded by a single shared secret (`stats.apiToken`, set via
 * the STATS_API_TOKEN env var). The token may be supplied either as an
 * `Authorization: Bearer <token>` header or a `?token=<token>` query param so
 * the whole URL-with-token can live in a single CI secret.
 *
 * When no token is configured the endpoint stays disabled (404) so a default
 * deployment never exposes internal stats by accident.
 */

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal-length buffers; a length mismatch is a
  // guaranteed non-match, so bail out early (the lengths themselves aren't secret).
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const queryToken = request.nextUrl.searchParams.get("token");
  return queryToken ? queryToken.trim() : null;
}

export async function GET(request: NextRequest) {
  const expectedToken = statsConfig.apiToken;

  // No token configured -> endpoint disabled. Behave as if it doesn't exist.
  if (!expectedToken) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providedToken = extractToken(request);
  if (!providedToken || !tokensMatch(providedToken, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await getAppStats();

    // Strip PII: the export must not carry user emails/names. Feedback
    // content (type, rating, message) is kept, but the attached user is not.
    const sanitized = {
      ...stats,
      feedback: {
        ...stats.feedback,
        recent: stats.feedback.recent.map(({ user: _user, ...rest }) => rest),
      },
    };

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error("Error fetching stats export:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    );
  }
}
