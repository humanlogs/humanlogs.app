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
 * How many documents keep a cached state.
 *
 * The index is worth holding for the whole corpus — it is short rows. Transcripts
 * are not: a thousand interviews is on the order of a gigabyte, which no browser
 * will give us and no user asked us to take. So this is a cache of what has been
 * READ recently, evicted by age.
 */
const MAX_CACHED_DOCUMENTS = 40;

/** How long the document must sit still before its state is written. */
const WRITE_DEBOUNCE_MS = 2500;

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
}): () => void {
  if (!isLocalDbAvailable()) return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;
  let detached = false;

  const write = () => {
    timer = null;
    if (detached) return;
    const stamp = serverUpdatedAt();
    // Without a version to stamp it with, a stored state can never be proven fresh
    // and would only ever be read to be thrown away.
    if (!stamp) return;
    const update = Y.encodeStateAsUpdate(doc);
    // An empty document is what a failed seed looks like. Storing it would turn a
    // transient failure into a cached one.
    if (doc.getXmlFragment("default").length === 0) return;
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
      .then(() => pruneDocStates(userId, MAX_CACHED_DOCUMENTS))
      .catch((error) => console.warn("[local-doc-state] write failed", error));
  };

  const onUpdate = () => {
    if (detached) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(write, WRITE_DEBOUNCE_MS);
  };

  doc.on("update", onUpdate);

  return () => {
    detached = true;
    doc.off("update", onUpdate);
    if (timer) clearTimeout(timer);
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
