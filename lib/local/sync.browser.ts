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
import { codingSignature, type CodingManifestEntry } from "./manifest";
import {
  buildPhraseIndex,
  type CodingRef,
  type PhraseIndex,
} from "./phrase-index";

export { codingSignature, type CodingManifestEntry };

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
const CONCURRENCY = 2;

/**
 * How many documents this may rebuild per minute.
 *
 * Not a performance knob — a courtesy one. Each rebuild is two authenticated
 * requests, and the API allows 120 a minute PER USER across everything they are
 * doing. A background job that spends that budget is a background job that breaks
 * the app it is running behind, so it takes a quarter of it and leaves the rest to
 * the person actually working.
 *
 * The consequence is that a first sync of a large study takes a while. That is the
 * right trade: the manifest cursor is on disk, so the pass picks up where it left
 * off on the next load rather than starting over, and the panel is usable from the
 * first document indexed.
 */
const DOCUMENTS_PER_MINUTE = 30;

/** Backoff when the server says we are going too fast anyway. */
const THROTTLED_RETRY_MS = 20_000;
const MAX_THROTTLE_RETRIES = 3;

/**
 * Thrown by a `fetchDocument` that hit the API's rate limit. Distinguished from a
 * failure because it is not one: the document is perfectly readable, we simply
 * asked too often, and marking it failed would leave a permanent hole in an index
 * that only needed us to wait.
 */
export class SyncThrottledError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs?: number) {
    super("Rate limited");
    this.name = "SyncThrottledError";
    // The API sends `Retry-After`; the fallback is for anything that does not.
    this.retryAfterMs = retryAfterMs ?? THROTTLED_RETRY_MS;
  }
}

/** A cancellable sleep — an aborted sync should not sit in a backoff for 20s. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

export async function syncStudyIndex({
  userId,
  projectId,
  manifest,
  fetchDocument,
  onProgress,
  signal,
  documentsPerMinute = DOCUMENTS_PER_MINUTE,
}: {
  userId: string;
  /** The study being synced. `undefined` means the whole corpus. */
  projectId?: string | null;
  manifest: CodingManifestEntry[];
  /**
   * Fetch + decrypt one document. Returning null skips it (no key on this device);
   * throwing {@link SyncThrottledError} asks for a pause rather than a failure.
   */
  fetchDocument: (id: string) => Promise<FetchedDocument | null>;
  onProgress?: (progress: SyncProgress) => void;
  signal?: AbortSignal;
  /**
   * The pace, overridable so tests do not have to sit through it. Policy, not
   * mechanism: what the app passes is {@link DOCUMENTS_PER_MINUTE}.
   */
  documentsPerMinute?: number;
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

  // The pace, as a moving "not before" mark shared by the workers.
  const minInterval = documentsPerMinute > 0 ? 60_000 / documentsPerMinute : 0;
  let nextSlot = 0;
  const waitForSlot = async () => {
    const now = Date.now();
    const slot = Math.max(now, nextSlot);
    nextSlot = slot + minInterval;
    await sleep(slot - now, signal);
  };

  let next = 0;
  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const index = next++;
      if (index >= stale.length) return;
      const entry = stale[index];
      let throttled = 0;

      for (;;) {
        await waitForSlot();
        if (signal?.aborted) return;
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
          if (
            error instanceof SyncThrottledError &&
            throttled < MAX_THROTTLE_RETRIES
          ) {
            throttled++;
            // Hold the whole pass back, not just this worker: the limit is per user,
            // so the other worker is exactly as unwelcome right now as this one.
            nextSlot = Math.max(nextSlot, Date.now() + error.retryAfterMs);
            continue;
          }
          console.warn("[local-sync] failed to index", entry.id, error);
          progress.failed++;
        }
        break;
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
 * A fingerprint of a derived index — what changed, from the panel's point of view.
 *
 * The open document is re-derived on every projection change, which the editor emits
 * a few times a second while someone types. Almost none of those change a coded
 * passage, and rewriting a document's whole index to store the same rows again is a
 * transaction for nothing. Comparing this first is what makes transcription-phase
 * typing cost no writes at all.
 *
 * Text is included, not only ids: editing INSIDE a coded passage leaves its anchors
 * (hence its id) untouched while changing the excerpt the table shows.
 */
export function phraseIndexSignature(index: PhraseIndex): string {
  return index.phrases
    .map(
      (phrase) =>
        `${phrase.id}\u0000${phrase.text}\u0000${phrase.startTime ?? ""}`,
    )
    .join("\u0001");
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
 *
 * Takes an already-built index rather than the raw material, so the caller can
 * decide from {@link phraseIndexSignature} whether the write is worth making.
 */
export async function writeDocumentIndex({
  userId,
  documentId,
  projectId,
  title,
  index,
  stamp,
}: {
  userId: string;
  documentId: string;
  projectId: string | null;
  title: string;
  index: PhraseIndex;
  stamp?: { updatedAt: string; signature: string } | null;
}): Promise<void> {
  await putDocumentIndex(userId, {
    document: {
      id: documentId,
      studyKey: studyKeyOf(projectId),
      title,
      indexedUpdatedAt: stamp?.updatedAt ?? "",
      indexedCodingSignature: stamp?.signature ?? "",
    },
    phrases: index.phrases,
    links: index.links,
  });
}
