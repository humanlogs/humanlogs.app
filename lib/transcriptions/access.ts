import { Prisma, type Transcription } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Who may do what on a transcription — the permission model behind collaboration,
 * comments and notifications.
 *
 * Sharing is stored as a JSONB array on `Transcription.shared`; this module is the
 * single place that interprets it, so the rules stay testable and consistent
 * across the API routes and the socket server that enforce them.
 */

export type SharedRole = "read" | "read+listen" | "write";

export type SharedUser = {
  userId: string;
  role: SharedRole;
};

export type AccessResult = {
  hasAccess: boolean;
  isOwner: boolean;
  role: string | null;
};

/** Roles are cumulative: write implies read+listen implies read. */
const ROLE_HIERARCHY: Record<SharedRole, number> = {
  read: 1,
  "read+listen": 2,
  write: 3,
};

/**
 * Resolve `userId`'s access to `transcription`, optionally requiring a minimum
 * role. The owner always has full access; everyone else must appear in the
 * `shared` array with a role at least as strong as `requiredRole`.
 */
export function checkAccess(
  transcription: Pick<Transcription, "userId" | "shared">,
  userId: string,
  requiredRole?: SharedRole,
): AccessResult {
  const isOwner = transcription.userId === userId;
  if (isOwner) {
    return { hasAccess: true, isOwner: true, role: "owner" };
  }

  const shared = (transcription.shared as SharedUser[] | null) || [];
  const sharedUser = shared.find((s) => s?.userId === userId);
  if (!sharedUser) {
    return { hasAccess: false, isOwner: false, role: null };
  }

  if (requiredRole) {
    const granted = ROLE_HIERARCHY[sharedUser.role] ?? 0;
    const required = ROLE_HIERARCHY[requiredRole] ?? 0;
    return {
      hasAccess: granted >= required,
      isOwner: false,
      role: sharedUser.role,
    };
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

/**
 * Resolve a user's access to a transcription by id, straight from the database.
 *
 * Used by the socket server, which has no request context to hang a session on:
 * it authenticates the user at handshake time and then has to authorize each
 * room join on its own.
 */
export async function getTranscriptionAccessFor(
  userId: string,
  transcriptionId: string,
  requiredRole?: SharedRole,
): Promise<AccessResult> {
  const transcription = await prisma.transcription.findUnique({
    where: { id: transcriptionId },
    select: { userId: true, shared: true },
  });
  if (!transcription) {
    return { hasAccess: false, isOwner: false, role: null };
  }
  return checkAccess(transcription, userId, requiredRole);
}

/**
 * Transcriptions shared *with* `userId`.
 *
 * Prisma cannot express JSONB containment, so this is raw SQL: `shared @> [{...}]`
 * matches rows whose array contains an entry for this user, whatever their role
 * and whatever else the entry carries.
 */
export function findTranscriptionsSharedWith(
  userId: string,
  limit = 1000,
): Promise<Transcription[]> {
  return prisma.$queryRaw<Transcription[]>`
    SELECT * FROM "Transcription"
    WHERE "shared" IS NOT NULL
      AND "shared"::jsonb @> ${Prisma.sql`${JSON.stringify([{ userId }])}::jsonb`}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `;
}
