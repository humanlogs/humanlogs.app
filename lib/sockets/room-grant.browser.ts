"use client";

/**
 * Client-side store for room grants (see room-grant.ts for what they are and why).
 *
 * A grant is minted by the API and handed to the client with the transcription it
 * describes, so the common path costs no extra request: opening a transcript
 * already fetched the permission to collaborate on it. This module keeps those
 * grants, hands them to whatever is about to join a socket room, and refreshes
 * them from a dedicated endpoint when they are missing or about to expire —
 * a long editing session outlives a single grant, and a socket reconnect after a
 * suspended laptop must not land on an expired one.
 *
 * Deliberately plain `fetch` rather than `fetchGateway`: this is the last thing
 * standing between a reconnect and a working editor, so it must not be able to
 * navigate the page away on a transient 401 mid-session.
 */

type CachedGrant = { token: string; expiresAt: number };

/** Refresh this long before expiry, so a grant is never presented on its last legs. */
const REFRESH_MARGIN_MS = 60_000;

const grants = new Map<string, CachedGrant>();
/** In-flight refreshes, so N joiners for one transcript make one request. */
const refreshing = new Map<string, Promise<string | null>>();

function isUsable(grant: CachedGrant | undefined): grant is CachedGrant {
  return !!grant && grant.expiresAt - REFRESH_MARGIN_MS > Date.now();
}

/**
 * Store the grant that came with a transcription payload. Called by the data
 * layer, so opening a transcript is enough to be able to join its rooms.
 */
export function primeRoomGrant(
  transcriptionId: string,
  grant: { token?: unknown; expiresAt?: unknown } | null | undefined,
): void {
  if (!transcriptionId) return;
  if (typeof grant?.token !== "string" || typeof grant?.expiresAt !== "number") {
    return;
  }
  grants.set(transcriptionId, {
    token: grant.token,
    expiresAt: grant.expiresAt,
  });
}

/** Drop a stored grant — after a refusal, or when access may have changed. */
export function clearRoomGrant(transcriptionId: string): void {
  grants.delete(transcriptionId);
  refreshing.delete(transcriptionId);
}

/** Forget everything. Used on logout, and by tests between cases. */
export function clearAllRoomGrants(): void {
  grants.clear();
  refreshing.clear();
}

/**
 * The grant to present when joining `transcriptionId`'s rooms, refreshed if need
 * be. Resolves to null when the server will not issue one — the caller joins
 * without it and is refused, which is the correct outcome: it no longer has access.
 */
export async function getRoomGrant(
  transcriptionId: string,
): Promise<string | null> {
  if (!transcriptionId) return null;

  const cached = grants.get(transcriptionId);
  if (isUsable(cached)) return cached.token;

  const pending = refreshing.get(transcriptionId);
  if (pending) return pending;

  const request = fetchRoomGrant(transcriptionId).finally(() => {
    refreshing.delete(transcriptionId);
  });
  refreshing.set(transcriptionId, request);
  return request;
}

async function fetchRoomGrant(transcriptionId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/transcriptions/${transcriptionId}/room-grant`,
    );
    if (!response.ok) {
      // 403/404 — access is gone, or never was. Drop the stale grant rather than
      // keep presenting one the server would honour until it expires.
      clearRoomGrant(transcriptionId);
      return null;
    }
    const { grant } = (await response.json()) as {
      grant?: { token: string; expiresAt: number };
    };
    primeRoomGrant(transcriptionId, grant);
    return grants.get(transcriptionId)?.token ?? null;
  } catch (error) {
    console.error("[room-grant] refresh failed", error);
    // Keep whatever we have: an expiring grant still beats none while offline,
    // and the caller retries on the next join.
    return grants.get(transcriptionId)?.token ?? null;
  }
}
