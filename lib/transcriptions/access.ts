import type { Transcription } from "@prisma/client";

export type SharedUser = {
  userId: string;
  role: "read" | "read+listen" | "write";
};

const ROLE_HIERARCHY: Record<string, number> = {
  read: 1,
  "read+listen": 2,
  write: 3,
};

/**
 * Resolve a user's access to a transcription. Owner always has full access; otherwise
 * the role comes from the `shared` JSON array. When `requiredRole` is given, `hasAccess`
 * reflects whether the user's role meets that threshold. Mirrors `checkAccess` in
 * app/api/transcriptions/[id]/route.ts (kept in sync).
 */
export function checkAccess(
  transcription: Pick<Transcription, "userId" | "shared">,
  userId: string,
  requiredRole?: "read" | "read+listen" | "write",
): { hasAccess: boolean; isOwner: boolean; role: string | null } {
  const isOwner = transcription.userId === userId;
  if (isOwner) return { hasAccess: true, isOwner: true, role: "owner" };

  const shared = (transcription.shared as SharedUser[] | null) || [];
  const sharedUser = shared.find((s) => s.userId === userId);
  if (!sharedUser) return { hasAccess: false, isOwner: false, role: null };

  if (requiredRole) {
    const hasAccess =
      ROLE_HIERARCHY[sharedUser.role] >= ROLE_HIERARCHY[requiredRole];
    return { hasAccess, isOwner: false, role: sharedUser.role };
  }
  return { hasAccess: true, isOwner: false, role: sharedUser.role };
}

/** Owner + every shared user id — the set of people to notify of a change. */
export function participantIds(
  transcription: Pick<Transcription, "userId" | "shared">,
): string[] {
  const shared = (transcription.shared as SharedUser[] | null) || [];
  return [transcription.userId, ...shared.map((s) => s.userId)];
}
