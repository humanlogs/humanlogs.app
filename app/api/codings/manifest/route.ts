import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { findAccessibleDocumentStamps } from "@/lib/transcriptions/access";
import type { CodingManifestEntry } from "@/lib/local/manifest";
import { NextResponse } from "next/server";

/**
 * The manifest the local index syncs against.
 *
 * This is the whole point of the design: a study of a thousand interviews is a
 * thousand short lines here, and the client then fetches only the documents whose
 * line changed. Without it, keeping a local index current would mean pulling the
 * corpus on every load — and for an end-to-end encrypted study, the server could not
 * build the index itself even if it wanted to: it has never seen the text.
 *
 * Nothing returned is content. Ids, timestamps and counts — the same class of
 * metadata `Transcription.codes` already keeps in clear so the server can scope and
 * filter without learning what a code means.
 */
export const GET = withAuthRateLimit(async (request, user) => {
  const url = new URL(request.url);
  const study = url.searchParams.get("study");
  // Absent → every document; `none` → the ones filed in no study; otherwise that
  // study. The three cases the sidebar's own scope already distinguishes.
  const projectId =
    study === null ? undefined : study === "none" ? null : study;

  const documents = await findAccessibleDocumentStamps(user.id, projectId);
  if (documents.length === 0) {
    return NextResponse.json({ documents: [] satisfies CodingManifestEntry[] });
  }

  const ids = documents.map((d) => d.id);
  const counts = await prisma.coding.groupBy({
    by: ["transcriptionId"],
    where: { transcriptionId: { in: ids } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const byDocument = new Map(counts.map((c) => [c.transcriptionId, c]));

  return NextResponse.json({
    documents: documents.map((doc) => {
      const stat = byDocument.get(doc.id);
      return {
        id: doc.id,
        updatedAt: doc.updatedAt.toISOString(),
        projectId: doc.projectId,
        codings: stat?._count._all ?? 0,
        codingLatest: stat?._max.createdAt?.toISOString() ?? null,
      };
    }) satisfies CodingManifestEntry[],
  });
});
