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

/**
 * The id and freshness of every document `userId` can read — owned or shared —
 * optionally narrowed to one study.
 *
 * Deliberately narrow: {@link findTranscriptionsSharedWith} returns whole rows,
 * transcript JSON included, which is megabytes per interview and the wrong price
 * to pay for a list of ids. The local-sync manifest asks this question about a
 * thousand documents at a time.
 */
export async function findAccessibleDocumentStamps(
  userId: string,
  projectId?: string | null,
  limit = 2000,
): Promise<Array<{ id: string; updatedAt: Date; projectId: string | null }>> {
  const studyFilter =
    projectId === undefined
      ? Prisma.empty
      : projectId === null
        ? Prisma.sql`AND "projectId" IS NULL`
        : Prisma.sql`AND "projectId" = ${projectId}`;

  const rows = await prisma.$queryRaw<
    Array<{ id: string; updatedAt: Date; projectId: string | null }>
  >`
    SELECT "id", "updatedAt", "projectId" FROM "Transcription"
    WHERE (
      "userId" = ${userId}
      OR ("shared" IS NOT NULL
          AND "shared"::jsonb @> ${Prisma.sql`${JSON.stringify([{ userId }])}::jsonb`})
    )
    ${studyFilter}
    ORDER BY "updatedAt" DESC
    LIMIT ${limit}
  `;
  return rows;
}

/**
 * The people `userId` already shares documents with, most recent first: the
 * owner and every collaborator of each document they own or were given.
 *
 * This is what the share dialog may suggest. There is deliberately no search
 * over all users — an email address is not something one researcher gets to
 * look up about another — but everyone returned here is someone `userId` can
 * already see in a document's participant list, so suggesting them discloses
 * nothing new.
 */
export async function findShareContacts(
  userId: string,
  limit = 200,
): Promise<ShareContactRow[]> {
  const mine = Prisma.sql`${JSON.stringify([{ userId }])}::jsonb`;
  const rows = await prisma.$queryRaw<
    Array<{ userId: string; lastSharedAt: Date; documents: bigint | number }>
  >`
    WITH docs AS (
      SELECT "id", "userId", "shared", "updatedAt" FROM "Transcription"
      WHERE "shared" IS NOT NULL
        AND jsonb_typeof("shared"::jsonb) = 'array'
        AND ("userId" = ${userId} OR "shared"::jsonb @> ${mine})
    ),
    people AS (
      SELECT "userId" AS uid, "id", "updatedAt" FROM docs
      UNION ALL
      SELECT entry->>'userId' AS uid, docs."id", docs."updatedAt"
      FROM docs, jsonb_array_elements(docs."shared"::jsonb) AS entry
    )
    SELECT uid AS "userId",
           MAX("updatedAt") AS "lastSharedAt",
           COUNT(DISTINCT "id") AS "documents"
    FROM people
    WHERE uid IS NOT NULL AND uid <> ${userId}
    GROUP BY uid
    ORDER BY MAX("updatedAt") DESC
    LIMIT ${limit}
  `;
  // COUNT comes back as a bigint, which JSON cannot carry.
  return rows.map((r) => ({ ...r, documents: Number(r.documents) }));
}

/**
 * Whether `otherId` is one of `userId`'s share contacts — the same relation as
 * {@link findShareContacts}, asked about one person, so it holds however many
 * contacts there are. Gates any read of another account's profile.
 */
export async function sharesDocumentWith(
  userId: string,
  otherId: string,
): Promise<boolean> {
  if (userId === otherId) return true;
  const me = Prisma.sql`${JSON.stringify([{ userId }])}::jsonb`;
  const other = Prisma.sql`${JSON.stringify([{ userId: otherId }])}::jsonb`;
  const rows = await prisma.$queryRaw<unknown[]>`
    SELECT 1 FROM "Transcription"
    WHERE "shared" IS NOT NULL
      AND jsonb_typeof("shared"::jsonb) = 'array'
      AND (
        ("userId" = ${userId} AND "shared"::jsonb @> ${other})
        OR ("userId" = ${otherId} AND "shared"::jsonb @> ${me})
        OR ("shared"::jsonb @> ${me} AND "shared"::jsonb @> ${other})
      )
    LIMIT 1
  `;
  return rows.length > 0;
}

export type ShareContactRow = {
  userId: string;
  lastSharedAt: Date;
  /** Documents you and this person both have access to. */
  documents: number;
};
