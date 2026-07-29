import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "@/lib/config";

/**
 * Room grants — the socket server's authorization, without a database.
 *
 * The socket server runs inside the custom Node server and does NOT get a working
 * Prisma client (the generated client is not part of that bundle), so it cannot
 * read the owner / shared list to decide whether a client may enter a room. But it
 * does not have to: authorization is a fact the API already establishes on every
 * request, and a signed statement of that fact travels fine.
 *
 * So an API route — which does have Prisma — mints a short-lived grant saying
 * "user U may act on transcription T with role R", the client forwards it when it
 * joins, and the socket server verifies the signature with the session secret.
 * Purely local, no I/O, no shared state between the two processes beyond the secret
 * they already share for socket tokens.
 *
 * What keeps it honest:
 *   - it is bound to a user (`sub`) AND to a transcription (`tid`), and the socket
 *     server checks BOTH against the socket's authenticated identity and the room
 *     being joined. A grant is therefore useless to anyone else, and useless for
 *     any other document — capturing one buys nothing its holder did not have.
 *   - it carries the role, so read-only stays read-only on the wire (the relay
 *     refuses `sync` messages from a read grant) rather than only in the editor.
 *   - it expires. Sharing is revocable, and a grant is a snapshot of it, so a grant
 *     must not outlive the moment anyone would still call it true by much.
 *
 * The cost of that last point is the revocation window: un-sharing a transcript
 * takes effect on the socket up to {@link ROOM_GRANT_TTL_SECONDS} later, for a
 * client that is already connected and holds a fresh grant. The database check it
 * replaces was not instant either — it ran once per join and was then cached for
 * the life of the socket, so an open session kept its access just the same.
 */

/** How long a minted grant stays valid. Short: it is a snapshot of a revocable share. */
export const ROOM_GRANT_TTL_SECONDS = 15 * 60;

/**
 * Roles a grant can carry: the sharing roles, plus `owner`.
 *
 * Deliberately declared here rather than imported from `lib/transcriptions/access`:
 * that module imports `@prisma/client`, and this one is loaded by the socket server,
 * which must pull in no Prisma at all. `tests/unit/room-grant.test.ts` asserts the
 * two vocabularies stay in step.
 */
export type RoomRole = "owner" | "write" | "read+listen" | "read";

const ROOM_ROLES: readonly RoomRole[] = [
  "owner",
  "write",
  "read+listen",
  "read",
];

/** Whether a role may change the document (as opposed to reading and being seen). */
export function roomRoleCanWrite(role: RoomRole): boolean {
  return role === "owner" || role === "write";
}

export type RoomGrantClaims = {
  userId: string;
  transcriptionId: string;
  role: RoomRole;
  canWrite: boolean;
};

/** A minted grant plus when it dies, so the holder can refresh before it does. */
export type MintedRoomGrant = {
  token: string;
  /** Expiry as a unix timestamp in MILLISECONDS (Date.now() units). */
  expiresAt: number;
  role: RoomRole;
};

function grantSecret(): Uint8Array {
  if (!authConfig.sessionSecret) {
    throw new Error(
      "Session secret is not configured. Please set AUTH_SESSION_SECRET in your environment variables.",
    );
  }
  return new TextEncoder().encode(authConfig.sessionSecret);
}

/**
 * Mint a grant. Callers must have established the access themselves — this only
 * signs what they say, it does not check anything.
 */
export async function createRoomGrant({
  userId,
  transcriptionId,
  role,
  ttlSeconds = ROOM_GRANT_TTL_SECONDS,
}: {
  userId: string;
  transcriptionId: string;
  role: RoomRole;
  ttlSeconds?: number;
}): Promise<MintedRoomGrant> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;

  const token = await new SignJWT({ type: "room", tid: transcriptionId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(grantSecret());

  return { token, expiresAt: expiresAt * 1000, role };
}

/**
 * Verify a grant against the identity and the room it is being used for.
 *
 * Returns null for anything that is not a valid, unexpired, correctly-scoped
 * grant — a forgery, a grant for another user, a grant for another transcription,
 * a socket token replayed as a grant, or nothing at all. Callers treat null as a
 * denial; there is deliberately no way to distinguish the cases from outside.
 */
export async function verifyRoomGrant(
  token: unknown,
  expected: { userId: string; transcriptionId: string },
): Promise<RoomGrantClaims | null> {
  if (typeof token !== "string" || !token) return null;

  try {
    const { payload } = await jwtVerify(token, grantSecret());

    // A socket token is signed with the same secret; it authenticates a user but
    // says nothing about any document, so it must not be usable as a grant.
    if (payload.type !== "room") return null;
    if (payload.sub !== expected.userId) return null;
    if (payload.tid !== expected.transcriptionId) return null;

    const role = payload.role as RoomRole;
    if (!ROOM_ROLES.includes(role)) return null;

    return {
      userId: expected.userId,
      transcriptionId: expected.transcriptionId,
      role,
      canWrite: roomRoleCanWrite(role),
    };
  } catch {
    // Bad signature, expired, malformed — all the same answer.
    return null;
  }
}
