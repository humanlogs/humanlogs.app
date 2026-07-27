/**
 * Server-side helpers shared by the codebook routes. Kept out of
 * `lib/codebooks/codebook.ts` so that module stays importable from the browser
 * and from tests without pulling in Prisma.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serverEncryption } from "@/lib/encryption/encryption-entities";
import type { CodebookDTO, CodebookTarget } from "./codebook";

type CodebookRow = {
  id: string;
  allStudies: boolean;
  target: string;
  preset: string | null;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
  studies?: { projectId: string }[];
};

export function formatCodebook(row: CodebookRow): CodebookDTO {
  return {
    id: row.id,
    allStudies: row.allStudies,
    target: row.target as CodebookTarget,
    preset: row.preset,
    studyIds: (row.studies ?? []).map((s) => s.projectId),
    content: row.content as CodebookDTO["content"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** True when every id is a study owned by this user. */
export async function ownsAllStudies(
  userId: string,
  studyIds: string[],
): Promise<boolean> {
  if (studyIds.length === 0) return true;
  const count = await prisma.project.count({
    where: { id: { in: studyIds }, userId },
  });
  return count === studyIds.length;
}

/**
 * How many documents of `ownerId` are still shared with `userId`, optionally
 * restricted to one study. Sharing lives in a JSONB array, so containment is
 * the only way to ask this — same approach as `findTranscriptionsSharedWith`.
 */
async function countDocumentsSharedWith(
  ownerId: string,
  userId: string,
  projectId: string | null,
): Promise<number> {
  const shared = Prisma.sql`${JSON.stringify([{ userId }])}::jsonb`;
  const rows = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM "Transcription"
    WHERE "userId" = ${ownerId}
      AND "shared" IS NOT NULL
      AND "shared"::jsonb @> ${shared}
      ${projectId ? Prisma.sql`AND "projectId" = ${projectId}` : Prisma.empty}
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Drops a user's wrapped key from the codebooks they can no longer justify
 * access to, after losing a document. A study-scoped codebook goes when no
 * document of that study is shared with them any more; an "all studies" one
 * only when nothing of the owner's is.
 *
 * Best-effort: a failure here must never fail the un-share itself.
 */
export async function revokeCodebookAccess(
  ownerId: string,
  projectId: string | null,
  userIdToRemove: string,
): Promise<void> {
  if (!serverEncryption) return;

  const [stillInStudy, stillAnywhere] = await Promise.all([
    projectId
      ? countDocumentsSharedWith(ownerId, userIdToRemove, projectId)
      : Promise.resolve(0),
    countDocumentsSharedWith(ownerId, userIdToRemove, null),
  ]);

  const scopes = [
    ...(stillAnywhere === 0 ? [{ allStudies: true }] : []),
    ...(projectId && stillInStudy === 0
      ? [{ allStudies: false, studies: { some: { projectId } } }]
      : []),
  ];
  // The user kept access elsewhere: nothing to revoke.
  if (scopes.length === 0) return;

  const codebooks = await prisma.codebook.findMany({
    where: { userId: ownerId, OR: scopes },
    select: { id: true, content: true },
  });

  for (const codebook of codebooks) {
    const content = codebook.content as {
      privateKeys?: unknown[];
      payload?: string;
    } | null;
    // Leave plaintext codebooks alone, and never strip the last key holder.
    if (!Array.isArray(content?.privateKeys) || content.privateKeys.length <= 1) {
      continue;
    }
    try {
      const next = await serverEncryption.unshare(
        content as never,
        userIdToRemove,
      );
      await prisma.codebook.update({
        where: { id: codebook.id },
        data: { content: next as never },
      });
    } catch (error) {
      console.error("Failed to unshare codebook", codebook.id, error);
    }
  }
}

/**
 * Settles the codebooks of a study being deleted:
 *  - covering other studies (or all of them) → only the link to this study goes;
 *  - scoped to this study alone → moved to `targetProjectId` when the caller
 *    moves the documents there, deleted otherwise. A codebook with no study and
 *    no "all studies" flag would be reachable from nowhere, so keeping it would
 *    just hide data.
 *
 * Call this *before* deleting the study, while the links still exist.
 */
export async function settleCodebooksForDeletedProject(
  userId: string,
  projectId: string,
  destination: { targetProjectId: string | null },
): Promise<void> {
  const codebooks = await prisma.codebook.findMany({
    where: { userId, studies: { some: { projectId } } },
    select: { id: true, allStudies: true, studies: { select: { projectId: true } } },
  });

  const toDelete: string[] = [];
  const toMove: string[] = [];

  for (const codebook of codebooks) {
    const otherStudies = codebook.studies
      .map((s) => s.projectId)
      .filter((id) => id !== projectId);

    if (codebook.allStudies || otherStudies.length > 0) continue;
    if (destination.targetProjectId) toMove.push(codebook.id);
    else toDelete.push(codebook.id);
  }

  if (toDelete.length > 0) {
    await prisma.codebook.deleteMany({ where: { id: { in: toDelete } } });
  }

  // Everything still standing simply loses its link to the study; the ones that
  // move gain the destination's.
  await prisma.codebookStudy.deleteMany({ where: { projectId } });

  if (toMove.length > 0 && destination.targetProjectId) {
    const survivors = await prisma.codebook.findMany({
      where: { id: { in: toMove } },
      select: { id: true },
    });
    await prisma.codebookStudy.createMany({
      data: survivors.map((codebook) => ({
        codebookId: codebook.id,
        projectId: destination.targetProjectId!,
      })),
      skipDuplicates: true,
    });
  }
}

export async function codebookIdsForProject(
  userId: string,
  projectId: string,
): Promise<string[]> {
  const rows = await prisma.codebook.findMany({
    where: {
      userId,
      OR: [{ allStudies: true }, { studies: { some: { projectId } } }],
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
