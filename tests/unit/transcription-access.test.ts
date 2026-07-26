import { describe, expect, it } from "vitest";
import {
  checkAccess,
  type SharedRole,
  type SharedUser,
} from "@/lib/transcriptions/access";

/**
 * The permission model behind collaboration. Every API route that a collaborator
 * touches funnels through this function, so the whole matrix is pinned here —
 * silently widening a role is the kind of regression nobody notices until a
 * read-only participant edits an interview.
 */

const transcription = (shared: SharedUser[] | null) => ({
  userId: "owner-id",
  shared: shared as never,
});

const OWNED = transcription(null);

describe("checkAccess — owner", () => {
  it("grants the owner full access", () => {
    expect(checkAccess(OWNED, "owner-id")).toEqual({
      hasAccess: true,
      isOwner: true,
      role: "owner",
    });
  });

  it("grants the owner every required role", () => {
    for (const role of ["read", "read+listen", "write"] as SharedRole[]) {
      expect(checkAccess(OWNED, "owner-id", role).hasAccess).toBe(true);
    }
  });
});

describe("checkAccess — strangers", () => {
  it("denies a user who is not the owner and not shared with", () => {
    expect(checkAccess(OWNED, "stranger")).toEqual({
      hasAccess: false,
      isOwner: false,
      role: null,
    });
  });

  it("denies a user when the shared list exists but does not include them", () => {
    const t = transcription([{ userId: "someone-else", role: "write" }]);
    expect(checkAccess(t, "stranger").hasAccess).toBe(false);
  });

  it("denies a stranger for every required role", () => {
    for (const role of ["read", "read+listen", "write"] as SharedRole[]) {
      expect(checkAccess(OWNED, "stranger", role).hasAccess).toBe(false);
    }
  });
});

describe("checkAccess — role hierarchy", () => {
  const matrix: [SharedRole, SharedRole, boolean][] = [
    // granted, required, expected
    ["read", "read", true],
    ["read", "read+listen", false],
    ["read", "write", false],
    ["read+listen", "read", true],
    ["read+listen", "read+listen", true],
    ["read+listen", "write", false],
    ["write", "read", true],
    ["write", "read+listen", true],
    ["write", "write", true],
  ];

  it.each(matrix)(
    "a %s collaborator asked for %s → %s",
    (granted, required, expected) => {
      const t = transcription([{ userId: "guest", role: granted }]);
      expect(checkAccess(t, "guest", required).hasAccess).toBe(expected);
    },
  );

  it("reports the collaborator's own role, not the required one", () => {
    const t = transcription([{ userId: "guest", role: "read" }]);
    expect(checkAccess(t, "guest", "write")).toEqual({
      hasAccess: false,
      isOwner: false,
      role: "read",
    });
  });

  it("grants bare access (no required role) to any collaborator", () => {
    const t = transcription([{ userId: "guest", role: "read" }]);
    expect(checkAccess(t, "guest")).toEqual({
      hasAccess: true,
      isOwner: false,
      role: "read",
    });
  });
});

describe("checkAccess — malformed data", () => {
  it("treats an unknown role as insufficient rather than granting access", () => {
    const t = transcription([{ userId: "guest", role: "admin" as SharedRole }]);
    expect(checkAccess(t, "guest", "read").hasAccess).toBe(false);
  });

  it("survives null entries in the shared array", () => {
    const t = transcription([null as unknown as SharedUser, { userId: "guest", role: "write" }]);
    expect(checkAccess(t, "guest", "write").hasAccess).toBe(true);
    expect(checkAccess(t, "stranger").hasAccess).toBe(false);
  });

  it("uses the first matching entry when a user appears twice", () => {
    const t = transcription([
      { userId: "guest", role: "read" },
      { userId: "guest", role: "write" },
    ]);
    expect(checkAccess(t, "guest", "write").hasAccess).toBe(false);
  });
});
