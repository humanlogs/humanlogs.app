import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createSocketToken } from "@/lib/auth/utils";
import {
  ROOM_GRANT_TTL_SECONDS,
  createRoomGrant,
  roomRoleCanWrite,
  verifyRoomGrant,
  type RoomRole,
} from "@/lib/sockets/room-grant";
import { checkAccess, type SharedRole } from "@/lib/transcriptions/access";

/**
 * Room grants replace the socket server's database lookup, so what this token
 * says — and refuses to say — IS the authorization model. These are the unit-level
 * guarantees; `tests/integration/collab-authorization.test.ts` then proves the
 * relay actually acts on them.
 */

const ALICE = "user-alice";
const DOC = "transcription-42";

const mint = (over: Partial<Parameters<typeof createRoomGrant>[0]> = {}) =>
  createRoomGrant({
    userId: ALICE,
    transcriptionId: DOC,
    role: "write",
    ...over,
  });

describe("createRoomGrant", () => {
  it("round-trips the role for the user and document it was minted for", async () => {
    const { token } = await mint({ role: "read+listen" });
    const claims = await verifyRoomGrant(token, {
      userId: ALICE,
      transcriptionId: DOC,
    });

    expect(claims).toEqual({
      userId: ALICE,
      transcriptionId: DOC,
      role: "read+listen",
      canWrite: false,
    });
  });

  it("reports an expiry the holder can refresh against", async () => {
    const before = Date.now();
    const { expiresAt } = await mint();

    // Milliseconds, in the future, and within a second of the declared lifetime —
    // the browser store compares this against Date.now() to decide when to renew,
    // so seconds-vs-milliseconds would silently mean "always expired".
    expect(expiresAt).toBeGreaterThan(before);
    expect(Math.abs(expiresAt - (before + ROOM_GRANT_TTL_SECONDS * 1000))).
      toBeLessThan(1500);
  });

  it("marks only owner and write as able to change the document", () => {
    expect(roomRoleCanWrite("owner")).toBe(true);
    expect(roomRoleCanWrite("write")).toBe(true);
    expect(roomRoleCanWrite("read+listen")).toBe(false);
    expect(roomRoleCanWrite("read")).toBe(false);
  });
});

describe("verifyRoomGrant", () => {
  it("refuses a grant presented by another user", async () => {
    const { token } = await mint();
    expect(
      await verifyRoomGrant(token, {
        userId: "user-mallory",
        transcriptionId: DOC,
      }),
    ).toBeNull();
  });

  it("refuses a grant used on another transcription", async () => {
    const { token } = await mint();
    expect(
      await verifyRoomGrant(token, {
        userId: ALICE,
        transcriptionId: "transcription-99",
      }),
    ).toBeNull();
  });

  it("refuses an expired grant", async () => {
    const { token } = await mint({ ttlSeconds: -1 });
    expect(
      await verifyRoomGrant(token, { userId: ALICE, transcriptionId: DOC }),
    ).toBeNull();
  });

  it("refuses a token signed with a different secret", async () => {
    const forged = await new SignJWT({ type: "room", tid: DOC, role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(ALICE)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("not-the-session-secret"));

    expect(
      await verifyRoomGrant(forged, { userId: ALICE, transcriptionId: DOC }),
    ).toBeNull();
  });

  it("refuses a socket token replayed as a grant", async () => {
    // Same secret, same algorithm — only `type` separates authentication from
    // authorization, so this is the check that keeps them apart.
    const token = await createSocketToken(ALICE);
    expect(
      await verifyRoomGrant(token, { userId: ALICE, transcriptionId: DOC }),
    ).toBeNull();
  });

  it("refuses a grant carrying a role that is not one", async () => {
    const { token } = await mint({ role: "superuser" as RoomRole });
    expect(
      await verifyRoomGrant(token, { userId: ALICE, transcriptionId: DOC }),
    ).toBeNull();
  });

  it("refuses anything that is not a token", async () => {
    for (const value of [undefined, null, "", 42, {}, "not-a-jwt"]) {
      expect(
        await verifyRoomGrant(value, { userId: ALICE, transcriptionId: DOC }),
      ).toBeNull();
    }
  });
});

describe("grant roles and sharing roles", () => {
  // room-grant.ts declares its own role vocabulary so the socket server pulls in
  // no Prisma (see the comment there). Duplication is only safe while the two
  // agree, which is what this asserts: same names, same meaning of "may write".
  const SHARED_ROLES: SharedRole[] = ["read", "read+listen", "write"];

  it("agrees with checkAccess on who may write", () => {
    for (const role of SHARED_ROLES) {
      const transcription = {
        userId: "user-owner",
        shared: [{ userId: ALICE, role }],
      };

      const access = checkAccess(transcription, ALICE);
      expect(access.role).toBe(role);
      expect(checkAccess(transcription, ALICE, "write").hasAccess).toBe(
        roomRoleCanWrite(role as RoomRole),
      );
    }
  });

  it("treats the owner as able to write, as checkAccess does", () => {
    const transcription = { userId: ALICE, shared: [] };
    expect(checkAccess(transcription, ALICE).isOwner).toBe(true);
    expect(roomRoleCanWrite("owner")).toBe(true);
  });
});
