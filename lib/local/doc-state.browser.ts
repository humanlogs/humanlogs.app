/**
 * The local copy of a document's Yjs state.
 *
 * Until now the CRDT was purely in-memory: the seeding authority rebuilt it from the
 * transcript JSON on every session, and everyone else pulled it from that authority.
 * That works, and it is still the fallback — but it means a reader who opens the same
 * interview twice a day downloads and re-parses it twice a day, and it means the app
 * has nothing at all to show without a socket.
 *
 * Keeping the state on disk fixes both, and is the foundation the offline mode will
 * stand on. What it stores is a `Y.encodeStateAsUpdate` blob, in clear — the same
 * decision the coded-passage index makes, and for the same reason: a local copy you
 * cannot read is a local copy that cannot be used. The database is per user
 * (db.browser.ts), which is what keeps that from being a leak on a shared machine.
 *
 * **Freshness is all-or-nothing, and deliberately so.** A stored state is used only
 * when the server's `updatedAt` for the document still equals the one it was stored
 * against. Anything else — a colleague's edit, a revert, our own save landing after
 * the cache was written — and we throw the local copy away and seed from the server
 * as before. Merging the two is exactly what a CRDT cannot do here: a doc seeded from
 * the transcript JSON gets fresh item ids, so applying our stored state on top would
 * not reconcile the two readings of the same sentence, it would show both.
 */

import * as Y from "yjs";
import {
  deleteDocState,
  isLocalDbAvailable,
  pruneDocStates,
  putDocState,
  readDocState,
} from "./db.browser";

/**
 * How much of the corpus keeps a cached state.
 *
 * The coded-passage index is worth holding whole — it is short rows. Transcripts
 * are not: a thousand interviews is on the order of a gigabyte, which no browser
 * will give us and no user asked us to take. So this is a cache of what has been
 * READ recently, evicted oldest-first.
 *
 * The real bound is the BYTE one. A browser that runs out of storage quota evicts
 * the whole origin, index included, so a transcript cache that can grow to the
 * quota is a transcript cache that can delete the thing it was helping. The count
 * is only a second guard, for a corpus of documents too small to reach the bytes.
 */
const MAX_CACHED_BYTES = 128 * 1024 * 1024;
const MAX_CACHED_DOCUMENTS = 40;

/** How long the document must sit still before its state is written. */
const WRITE_DEBOUNCE_MS = 2500;

/**
 * The floor between two writes.
 *
 * The debounce alone is not enough: `doc.on("update")` fires for REMOTE changes
 * too, so a room where a colleague is typing steadily never goes quiet long enough
 * to be idle but never goes a second without a change either. Each write encodes
 * the whole document, which for a two-hour interview is hundreds of kilobytes —
 * worth paying every half minute, not every three seconds.
 */
const MIN_WRITE_INTERVAL_MS = 30_000;

/**
 * The stored state for a document, or null when there is none or it is stale.
 *
 * `serverUpdatedAt` is the value the app currently believes the server holds. Pass
 * what the document query returned; passing null (unknown) declines the cache, which
 * is the safe direction.
 */
export async function loadFreshDocState(
  userId: string,
  documentId: string,
  serverUpdatedAt: string | null | undefined,
): Promise<Uint8Array | null> {
  if (!isLocalDbAvailable() || !serverUpdatedAt) return null;
  try {
    const row = await readDocState(userId, documentId);
    if (!row) return null;
    if (row.serverUpdatedAt !== serverUpdatedAt) {
      // Stale beyond repair — drop it now rather than let it sit as a copy that
      // will never be used and will keep failing this test on every open.
      await deleteDocState(userId, documentId);
      return null;
    }
    return new Uint8Array(row.update);
  } catch (error) {
    console.warn("[local-doc-state] read failed", error);
    return null;
  }
}

/**
 * Persist a document's state as it changes, until the returned function is called.
 *
 * Writes are debounced and always encode the WHOLE state rather than appending
 * updates: a full encode of a long interview is a few hundred kilobytes and one
 * `put`, whereas an append-only log would need its own compaction and would hand a
 * reader a blob whose size depends on how much editing happened rather than on how
 * long the document is.
 *
 * `serverUpdatedAt()` is read at write time, not at attach time, so a state written
 * after a save is stamped with the version it actually includes.
 */
export function persistDocState({
  userId,
  documentId,
  doc,
  serverUpdatedAt,
}: {
  userId: string;
  documentId: string;
  doc: Y.Doc;
  serverUpdatedAt: () => string | null | undefined;
}): (options?: { flush?: boolean }) => void {
  if (!isLocalDbAvailable()) return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  let detached = false;
  let dirty = false;
  let lastWrite = 0;

  const write = () => {
    timer = null;
    const stamp = serverUpdatedAt();
    // Without a version to stamp it with, a stored state can never be proven fresh
    // and would only ever be read to be thrown away.
    if (!stamp) return;
    // An empty document is what a failed seed looks like. Storing it would turn a
    // transient failure into a cached one.
    if (doc.getXmlFragment("default").length === 0) return;
    lastWrite = Date.now();
    dirty = false;
    const update = Y.encodeStateAsUpdate(doc);
    void putDocState(userId, {
      id: documentId,
      // `.slice()` detaches the bytes from Yjs's buffer before they cross into
      // IndexedDB's structured clone.
      update: update.buffer.slice(
        update.byteOffset,
        update.byteOffset + update.byteLength,
      ) as ArrayBuffer,
      serverUpdatedAt: stamp,
    })
      .then(() =>
        pruneDocStates(userId, {
          maxBytes: MAX_CACHED_BYTES,
          maxDocuments: MAX_CACHED_DOCUMENTS,
        }),
      )
      .catch((error) => console.warn("[local-doc-state] write failed", error));
  };

  const onUpdate = () => {
    if (detached) return;
    dirty = true;
    if (timer) clearTimeout(timer);
    timer = setTimeout(
      write,
      Math.max(
        WRITE_DEBOUNCE_MS,
        MIN_WRITE_INTERVAL_MS - (Date.now() - lastWrite),
      ),
    );
  };

  doc.on("update", onUpdate);

  /**
   * Stop persisting. Closing the editor flushes first — it is the one moment worth
   * an unconditional encode, since it is the state the next visit wants and no
   * later change is coming to trigger the debounce.
   *
   * `flush: false` is for the cases where the state is about to be deleted anyway
   * (a revert), where writing it would race the delete and could win.
   */
  return ({ flush = true }: { flush?: boolean } = {}) => {
    detached = true;
    doc.off("update", onUpdate);
    if (timer) clearTimeout(timer);
    timer = null;
    if (flush && dirty) write();
  };
}

/** Forget one document's cached state — after a revert, or a share being revoked. */
export async function forgetDocState(
  userId: string,
  documentId: string,
): Promise<void> {
  if (!isLocalDbAvailable()) return;
  try {
    await deleteDocState(userId, documentId);
  } catch (error) {
    console.warn("[local-doc-state] delete failed", error);
  }
}
