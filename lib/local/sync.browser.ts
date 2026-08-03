/**
 * Keeping the local index current — the "load what we missed, intelligently"
 * half of the local model.
 *
 * The protocol is deliberately dumb, because dumb is what survives a corpus of a
 * thousand interviews:
 *
 *   1. ask the server for a MANIFEST — one line per document, `updatedAt` plus a
 *      fingerprint of its codings (see api/codings/manifest);
 *   2. compare it with what IndexedDB says it holds;
 *   3. fetch, decrypt and reindex only the documents whose line moved;
 *   4. forget the documents that are no longer in the manifest.
 *
 * Everything expensive is behind step 3, and step 3 is empty on a normal load.
 * That is what makes opening the app on a study of 1000 documents one small
 * request instead of a corpus download, and it is why the sync is driven by
 * `updatedAt` rather than by a subscription: a client that was offline for a week
 * and one that reloaded a second ago run the same code and do proportional work.
 *
 * Two timestamps, not one, because the two halves of a coding move
 * independently — editing a transcript does not code it, and coding a passage
 * writes a row now and an anchor whenever the save leader next flushes. A document
 * is stale when EITHER moved.
 *
 * No React here: the caller injects how to fetch and decrypt a document, so this
 * module stays testable and free of hooks. See hooks/use-local-index.ts.
 */

import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import {
  deleteDocumentIndex,
  putDocumentIndex,
  readDocumentRows,
  studyKeyOf,
  type LocalDocumentRow,
} from "./db.browser";
import { buildPhraseIndex, type CodingRef } from "./phrase-index";

export type CodingManifestEntry = {
  id: string;
  updatedAt: string;
  projectId: string | null;
  codings: number;
  codingLatest: string | null;
};

/** What a document must look like to be indexed. */
export type FetchedDocument = {
  title: string;
  projectId: string | null;
  segments: TranscriptionSegment[];
  codings: CodingRef[];
};

export type SyncProgress = {
  /** Documents this pass decided to rebuild. */
  total: number;
  done: number;
  failed: number;
};

export type SyncResult = SyncProgress & {
  /** Documents dropped because the server no longer lists them. */
  removed: number;
  /** True when nothing had to be fetched — the common case. */
  upToDate: boolean;
};

/**
 * The fingerprint stored alongside a document's index. Changing its shape
 * invalidates every local index, which is the intended behaviour: a client that
 * fingerprints differently must not trust rows built by the old rule.
 */
export function codingSignature(entry: {
  codings: number;
  codingLatest: string | null;
}): string {
  return `v1:${entry.codings}:${entry.codingLatest ?? "-"}`;
}

/**
 * Decide what a pass has to do: which documents to rebuild, and which to forget.
 *
 * Exported and pure because this is the whole protocol. Everything around it is
 * plumbing — fetching, decrypting, writing rows — but a mistake HERE is silent: too
 * eager and every load re-downloads the corpus, too lazy and the panel keeps
 * answering with codes that were retracted last week.
 */
export function planSync({
  manifest,
  local,
  scope,
}: {
  manifest: readonly CodingManifestEntry[];
  local: readonly LocalDocumentRow[];
  /**
   * The study this manifest covers, as a study key, or null for the whole corpus.
   * Anything outside it is left alone: a manifest for one study says nothing about
   * the documents of the others, and treating silence as deletion would wipe them.
   */
  scope: string | null;
}): { stale: CodingManifestEntry[]; removable: LocalDocumentRow[] } {
  const rows = new Map(local.map((row) => [row.id, row]));

  const stale: CodingManifestEntry[] = [];
  for (const entry of manifest) {
    const row = rows.get(entry.id);
    // A document nobody has ever coded has nothing to index. Skipping it is what
    // keeps a corpus of transcription-phase interviews from being downloaded for an
    // index that would be empty — and if it is coded later, the manifest says so on
    // the next pass.
    if (entry.codings === 0 && !row) continue;
    if (
      row &&
      row.indexedUpdatedAt === entry.updatedAt &&
      row.indexedCodingSignature === codingSignature(entry)
    ) {
      continue;
    }
    stale.push(entry);
  }

  const listed = new Set(manifest.map((entry) => entry.id));
  const removable = local.filter(
    (row) => !listed.has(row.id) && (scope === null || row.studyKey === scope),
  );

  return { stale, removable };
}

/**
 * How many documents to rebuild at once.
 *
 * Each one is a transcript download plus, for an encrypted study, an RSA unwrap
 * and an AES pass over the whole text — heavy enough that running the corpus in
 * parallel would freeze the tab it is supposed to be filling in the background.
 */
const CONCURRENCY = 3;

export async function syncStudyIndex({
  userId,
  projectId,
  manifest,
  fetchDocument,
  onProgress,
  signal,
}: {
  userId: string;
  /** The study being synced. `undefined` means the whole corpus. */
  projectId?: string | null;
  manifest: CodingManifestEntry[];
  /** Fetch + decrypt one document. Returning null skips it (no key on this device). */
  fetchDocument: (id: string) => Promise<FetchedDocument | null>;
  onProgress?: (progress: SyncProgress) => void;
  signal?: AbortSignal;
}): Promise<SyncResult> {
  const { stale, removable } = planSync({
    manifest,
    local: await readDocumentRows(userId),
    scope: projectId === undefined ? null : studyKeyOf(projectId),
  });

  // Documents we hold that the server no longer lists — deleted, unshared, or moved
  // to another study.
  for (const row of removable) {
    if (signal?.aborted) break;
    await deleteDocumentIndex(userId, row.id);
  }

  const progress: SyncProgress = { total: stale.length, done: 0, failed: 0 };
  onProgress?.({ ...progress });

  if (stale.length === 0) {
    return { ...progress, removed: removable.length, upToDate: true };
  }

  let next = 0;
  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const index = next++;
      if (index >= stale.length) return;
      const entry = stale[index];
      try {
        const document = await fetchDocument(entry.id);
        if (signal?.aborted) return;
        if (document) {
          const { phrases, links } = buildPhraseIndex({
            documentId: entry.id,
            projectId: document.projectId,
            segments: document.segments,
            codings: document.codings,
          });
          await putDocumentIndex(userId, {
            document: {
              id: entry.id,
              studyKey: studyKeyOf(document.projectId),
              title: document.title,
              indexedUpdatedAt: entry.updatedAt,
              indexedCodingSignature: codingSignature(entry),
            },
            phrases,
            links,
          });
          progress.done++;
        } else {
          // No key on this device, or a transcript we cannot read. Counted as a
          // failure rather than skipped silently: the panel says how much of the
          // study it is actually showing, and a study half-indexed without saying
          // so is worse than one that admits it.
          progress.failed++;
        }
      } catch (error) {
        console.warn("[local-sync] failed to index", entry.id, error);
        progress.failed++;
      }
      onProgress?.({ ...progress });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, stale.length) }, worker),
  );

  return { ...progress, removed: removable.length, upToDate: false };
}

/**
 * Reindex ONE document from what the editor currently holds.
 *
 * The background sync is about the corpus; this is about the passage just coded.
 * Coding is rapid-fire — a code every second or two — and the panel is supposed to
 * be watching, so the document being worked on writes its own rows straight from the
 * live projection instead of waiting for its `updatedAt` to move.
 *
 * The row is stamped with the version it was derived FROM, not with a marker, so a
 * document that was coded and then left alone is not downloaded again by the next
 * background pass. The client can compute the same fingerprint the manifest reports
 * because it holds the same codings the manifest counted — see
 * {@link codingSignature}. Without a stamp nothing can match, and the pass
 * re-derives from the stored transcript, which is the safe direction and the
 * correction path for anything the live projection got ahead of.
 */
export async function reindexOpenDocument({
  userId,
  documentId,
  projectId,
  title,
  segments,
  codings,
  stamp,
}: {
  userId: string;
  documentId: string;
  projectId: string | null;
  title: string;
  segments: TranscriptionSegment[];
  codings: CodingRef[];
  stamp?: { updatedAt: string; signature: string } | null;
}): Promise<void> {
  const { phrases, links } = buildPhraseIndex({
    documentId,
    projectId,
    segments,
    codings,
  });
  await putDocumentIndex(userId, {
    document: {
      id: documentId,
      studyKey: studyKeyOf(projectId),
      title,
      indexedUpdatedAt: stamp?.updatedAt ?? "",
      indexedCodingSignature: stamp?.signature ?? "",
    },
    phrases,
    links,
  });
}
