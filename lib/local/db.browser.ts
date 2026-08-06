/**
 * The local database: the browser's copy of the corpus.
 *
 * Everything the excerpt panel answers, it answers from here. The server is asked
 * only what changed (see sync.browser.ts) — which is the only way a study of 1000
 * documents and ~100M words can be queried while typing, and the only way it can be
 * queried AT ALL for an end-to-end encrypted study, whose text the server cannot
 * read.
 *
 * Four stores, three purposes:
 *
 *  - `documents` — one row per document: what we hold and how fresh it is. The
 *    `updatedAt` we last indexed is the whole sync protocol; comparing it with the
 *    server's tells us, per document, whether anything needs fetching at all.
 *  - `phrases` + `phraseCodes` — the coded-passage index (see phrase-index.ts).
 *  - `docState` — Yjs document state, in clear, for the documents actually opened.
 *    This is the offline-mode foundation: a returning reader gets the transcript
 *    from disk, with its marks and its item ids intact, instead of a blank editor
 *    waiting on a socket.
 *
 * **The database is per user.** Its content is plaintext — that is the point, since
 * an index you cannot read is an index you cannot query — so a shared device must
 * not let the next person open the previous one's corpus by loading the app. The
 * user id is in the database NAME rather than in a column: a wrong query cannot
 * cross accounts if the accounts are not in the same database.
 *
 * Written against raw IndexedDB rather than a wrapper, like the two stores that came
 * before it (`lib/encryption/encryption.ts`, the waveform cache): the API is small,
 * and a dependency that ships its own transaction semantics is not worth it for five
 * object stores.
 */

import type { PhraseCodeRow, PhraseRow } from "./phrase-index";

const DB_VERSION = 3;

export const STORE_DOCUMENTS = "documents";
export const STORE_PHRASES = "phrases";
export const STORE_PHRASE_CODES = "phraseCodes";
export const STORE_DOC_STATE = "docState";
/**
 * How big each cached document state is and when it was written — WITHOUT the
 * blob.
 *
 * Split out because eviction has to read every entry to decide what goes, and
 * reading every entry of the store that holds the transcripts means pulling
 * hundreds of megabytes into memory to compare two numbers. Metadata you scan,
 * blobs you fetch by key.
 */
export const STORE_DOC_STATE_META = "docStateMeta";
export const STORE_META = "meta";

/**
 * IndexedDB indexes skip records whose key is null or undefined, so a document
 * filed in no study would be invisible to a study-scoped cursor. Studies are keyed
 * by the empty string instead, and converted back at the boundary — the pure layer
 * keeps `null`, which is what the rest of the app means by "no study".
 */
const NO_STUDY = "";

export function studyKeyOf(projectId: string | null | undefined): string {
  return projectId ?? NO_STUDY;
}

function projectIdOf(studyKey: string): string | null {
  return studyKey === NO_STUDY ? null : studyKey;
}

/** What we hold for a document, and how fresh it is. */
export type LocalDocumentRow = {
  id: string;
  studyKey: string;
  title: string;
  /**
   * The server's `updatedAt` at the moment this document was indexed. The sync
   * cursor: a document whose server value still equals this one is not fetched.
   */
  indexedUpdatedAt: string;
  /**
   * Fingerprint of the codings that produced the index. The transcript's
   * `updatedAt` does NOT move when a code is applied — coding writes a `Coding`
   * row and an anchor the save leader may persist much later — so freshness needs
   * both halves, or a study coded but not edited would never reindex.
   */
  indexedCodingSignature: string;
  /** When this device last rebuilt the index, for diagnostics and eviction. */
  indexedAt: number;
  phraseCount: number;
};

type PhraseRecord = Omit<PhraseRow, "projectId"> & { studyKey: string };
type PhraseCodeRecord = Omit<PhraseCodeRow, "projectId"> & { studyKey: string };

export type LocalDocStateRow = {
  id: string;
  /** `Y.encodeStateAsUpdate` of the document, in clear. */
  update: ArrayBuffer;
  /** The server `updatedAt` this state was known to include. */
  serverUpdatedAt: string;
  savedAt: number;
};

/** What eviction reads: everything about a cached state except the state. */
export type LocalDocStateMeta = {
  id: string;
  savedAt: number;
  bytes: number;
};

export function isLocalDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

const DB_PREFIX = "humanlogs-local-";

function dbName(userId: string): string {
  return `${DB_PREFIX}${userId}`;
}

/**
 * The users whose local database exists on this device.
 *
 * Kept because wiping an untrusted device happens when nobody is logged in — there
 * is no user id to ask for by then — and `indexedDB.databases()` is not implemented
 * everywhere. Ids only; the same class of thing a session cookie already holds.
 */
const KNOWN_USERS_KEY = "hl-local-users";

function rememberUser(userId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(KNOWN_USERS_KEY);
    const users: string[] = raw ? JSON.parse(raw) : [];
    if (users.includes(userId)) return;
    localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify([...users, userId]));
  } catch {
    localStorage.setItem(KNOWN_USERS_KEY, JSON.stringify([userId]));
  }
}

function knownUsers(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KNOWN_USERS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

let cached: { userId: string; db: Promise<IDBDatabase> } | null = null;

export function openLocalDb(userId: string): Promise<IDBDatabase> {
  if (!isLocalDbAvailable()) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (cached?.userId === userId) return cached.db;

  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName(userId), DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;

      // Everything here is DERIVED — the transcripts and the `Coding` rows are the
      // truth, and the sync rebuilds all of it. So a schema change drops the
      // stores and lets them refill rather than migrating row by row: the code
      // that reads them then only ever has one shape to understand.
      for (const store of [
        STORE_DOCUMENTS,
        STORE_PHRASES,
        STORE_PHRASE_CODES,
        STORE_DOC_STATE,
        STORE_DOC_STATE_META,
      ]) {
        if (database.objectStoreNames.contains(store)) {
          database.deleteObjectStore(store);
        }
      }

      const documents = database.createObjectStore(STORE_DOCUMENTS, {
        keyPath: "id",
      });
      documents.createIndex("studyKey", "studyKey");

      const phrases = database.createObjectStore(STORE_PHRASES, {
        keyPath: "id",
      });
      phrases.createIndex("documentId", "documentId");
      phrases.createIndex("studyKey", "studyKey");

      // Keyed on the pair rather than on a concatenation of it: the same
      // identity, without storing it twice on every row.
      const links = database.createObjectStore(STORE_PHRASE_CODES, {
        keyPath: ["phraseId", "codingId"],
      });
      links.createIndex("documentId", "documentId");
      links.createIndex("studyKey", "studyKey");
      links.createIndex("phraseId", "phraseId");
      // The one composite index worth having: "every passage coded X in this
      // study" is the question the panel opens on.
      links.createIndex("studyCode", ["studyKey", "codebookId", "codeId"]);

      database.createObjectStore(STORE_DOC_STATE, { keyPath: "id" });

      const meta = database.createObjectStore(STORE_DOC_STATE_META, {
        keyPath: "id",
      });
      meta.createIndex("savedAt", "savedAt");

      // The only store that is NOT derived: it holds cursors and preferences, so
      // it is created once and left alone.
      if (!database.objectStoreNames.contains(STORE_META)) {
        database.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    request.onsuccess = () => {
      // Another tab running a newer build needs this connection out of the way,
      // otherwise its upgrade blocks forever behind ours.
      request.result.onversionchange = () => {
        request.result.close();
        if (cached?.userId === userId) cached = null;
      };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });

  rememberUser(userId);
  cached = { userId, db };
  return db;
}

function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Every record an index matches.
 *
 * `getAll` rather than a cursor: a cursor is one round trip through the event
 * loop PER RECORD, which on a study's whole index is measurably slower — 2.4× on
 * 100k rows — for a result we materialise into an array either way. Cursors earn
 * their keep when you can stop early or when the result would not fit in memory,
 * and neither is true here.
 */
function collect<T>(
  store: IDBIndex | IDBObjectStore,
  key?: IDBValidKey,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = key === undefined ? store.getAll() : store.getAll(key);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

/** Delete every record an index matches, in the caller's transaction. */
function deleteBy(index: IDBIndex, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = index.openCursor(key);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// The coded-passage index
// ---------------------------------------------------------------------------

/**
 * Replace a document's index — its metadata, its phrases and its links — in ONE
 * transaction.
 *
 * Replacement rather than merge, because the index is derived: the transcript and
 * the `Coding` rows are the truth, and a passage that no longer carries a code has
 * no row to update, only a row to be gone. Doing it atomically is what keeps the
 * panel from ever showing a document half-reindexed.
 */
export async function putDocumentIndex(
  userId: string,
  {
    document,
    phrases,
    links,
  }: {
    document: Omit<LocalDocumentRow, "indexedAt" | "phraseCount">;
    phrases: PhraseRow[];
    links: PhraseCodeRow[];
  },
): Promise<void> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(
    [STORE_DOCUMENTS, STORE_PHRASES, STORE_PHRASE_CODES],
    "readwrite",
  );
  const documents = tx.objectStore(STORE_DOCUMENTS);
  const phraseStore = tx.objectStore(STORE_PHRASES);
  const linkStore = tx.objectStore(STORE_PHRASE_CODES);

  await deleteBy(phraseStore.index("documentId"), document.id);
  await deleteBy(linkStore.index("documentId"), document.id);

  for (const phrase of phrases) {
    const { projectId, ...rest } = phrase;
    phraseStore.put({
      ...rest,
      studyKey: studyKeyOf(projectId),
    } as PhraseRecord);
  }
  for (const link of links) {
    const { projectId, ...rest } = link;
    linkStore.put({
      ...rest,
      studyKey: studyKeyOf(projectId),
    } as PhraseCodeRecord);
  }
  documents.put({
    ...document,
    indexedAt: Date.now(),
    phraseCount: phrases.length,
  } satisfies LocalDocumentRow);

  await done(tx);
}

/** Forget a document entirely — deleted, unshared, or moved out of reach. */
export async function deleteDocumentIndex(
  userId: string,
  documentId: string,
): Promise<void> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(
    [
      STORE_DOCUMENTS,
      STORE_PHRASES,
      STORE_PHRASE_CODES,
      STORE_DOC_STATE,
      STORE_DOC_STATE_META,
    ],
    "readwrite",
  );
  await deleteBy(tx.objectStore(STORE_PHRASES).index("documentId"), documentId);
  await deleteBy(
    tx.objectStore(STORE_PHRASE_CODES).index("documentId"),
    documentId,
  );
  tx.objectStore(STORE_DOCUMENTS).delete(documentId);
  tx.objectStore(STORE_DOC_STATE).delete(documentId);
  tx.objectStore(STORE_DOC_STATE_META).delete(documentId);
  await done(tx);
}

export async function readDocumentRows(
  userId: string,
): Promise<LocalDocumentRow[]> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(STORE_DOCUMENTS, "readonly");
  return collect<LocalDocumentRow>(tx.objectStore(STORE_DOCUMENTS));
}

/**
 * Every coded passage of a study, with its codes.
 *
 * Read whole and filtered in memory ({@link queryPhrases}) rather than through a
 * cursor per filter: a study's index is tens of thousands of short rows, the filter
 * bar changes on every keystroke, and re-opening a transaction per change would be
 * slower than the pass it replaces. The composite index is there for the day a
 * corpus outgrows that — the seam is this function alone.
 */
export async function readStudyIndex(
  userId: string,
  projectId: string | null,
): Promise<{ phrases: PhraseRow[]; links: PhraseCodeRow[] }> {
  const db = await openLocalDb(userId);
  const key = studyKeyOf(projectId);
  const tx = db.transaction([STORE_PHRASES, STORE_PHRASE_CODES], "readonly");
  const [phrases, links] = await Promise.all([
    collect<PhraseRecord>(tx.objectStore(STORE_PHRASES).index("studyKey"), key),
    collect<PhraseCodeRecord>(
      tx.objectStore(STORE_PHRASE_CODES).index("studyKey"),
      key,
    ),
  ]);
  // Written onto the records rather than spread into new ones. Every row here was
  // just minted by the structured clone, so nobody else holds a reference and
  // mutating is safe — and at a study's scale the difference is hundreds of
  // thousands of allocations on a read the panel waits for.
  const study = projectIdOf(key);
  for (const row of phrases) (row as unknown as PhraseRow).projectId = study;
  for (const row of links) (row as unknown as PhraseCodeRow).projectId = study;
  return {
    phrases: phrases as unknown as PhraseRow[],
    links: links as unknown as PhraseCodeRow[],
  };
}

// ---------------------------------------------------------------------------
// Yjs document state
// ---------------------------------------------------------------------------

export async function readDocState(
  userId: string,
  documentId: string,
): Promise<LocalDocStateRow | null> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(STORE_DOC_STATE, "readonly");
  const row = await request(
    tx.objectStore(STORE_DOC_STATE).get(documentId) as IDBRequest<
      LocalDocStateRow | undefined
    >,
  );
  return row ?? null;
}

export async function putDocState(
  userId: string,
  row: Omit<LocalDocStateRow, "savedAt">,
): Promise<void> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(
    [STORE_DOC_STATE, STORE_DOC_STATE_META],
    "readwrite",
  );
  const savedAt = Date.now();
  tx.objectStore(STORE_DOC_STATE).put({ ...row, savedAt });
  tx.objectStore(STORE_DOC_STATE_META).put({
    id: row.id,
    savedAt,
    bytes: row.update.byteLength,
  } satisfies LocalDocStateMeta);
  await done(tx);
}

export async function deleteDocState(
  userId: string,
  documentId: string,
): Promise<void> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(
    [STORE_DOC_STATE, STORE_DOC_STATE_META],
    "readwrite",
  );
  tx.objectStore(STORE_DOC_STATE).delete(documentId);
  tx.objectStore(STORE_DOC_STATE_META).delete(documentId);
  await done(tx);
}

/**
 * Evict cached document states until they fit the budget, newest kept.
 *
 * Budgeted in BYTES, not in documents. A count is not a size: forty short
 * interviews are a few megabytes and forty long ones can be most of the origin's
 * storage quota — and when a browser hits that quota it does not evict the
 * offending store, it evicts the whole origin. Filling the disk with transcripts
 * would take the coded-passage index down with it, which is the one thing here
 * that is expensive to rebuild. The count cap stays as a second bound, so a
 * corpus of tiny documents cannot accumulate rows without limit.
 *
 * Reads only {@link STORE_DOC_STATE_META}, which is three numbers per document —
 * the whole reason that store exists.
 */
export async function pruneDocStates(
  userId: string,
  { maxBytes, maxDocuments }: { maxBytes: number; maxDocuments: number },
): Promise<number> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(
    [STORE_DOC_STATE, STORE_DOC_STATE_META],
    "readwrite",
  );
  const metaStore = tx.objectStore(STORE_DOC_STATE_META);
  const meta = await collect<LocalDocStateMeta>(metaStore);

  meta.sort((a, b) => b.savedAt - a.savedAt);
  const stale: LocalDocStateMeta[] = [];
  let kept = 0;
  let bytes = 0;
  for (const row of meta) {
    bytes += row.bytes;
    kept++;
    // The document just written is the newest, so it always survives — evicting
    // it would make the write pointless and the next open would find nothing.
    if (kept > 1 && (bytes > maxBytes || kept > maxDocuments)) stale.push(row);
  }

  if (stale.length === 0) {
    await done(tx);
    return 0;
  }
  const states = tx.objectStore(STORE_DOC_STATE);
  for (const row of stale) {
    states.delete(row.id);
    metaStore.delete(row.id);
  }
  await done(tx);
  return stale.length;
}

// ---------------------------------------------------------------------------
// Housekeeping
// ---------------------------------------------------------------------------

export async function readMeta<T>(
  userId: string,
  key: string,
): Promise<T | null> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(STORE_META, "readonly");
  const row = await request(
    tx.objectStore(STORE_META).get(key) as IDBRequest<
      { key: string; value: T } | undefined
    >,
  );
  return row?.value ?? null;
}

export async function writeMeta<T>(
  userId: string,
  key: string,
  value: T,
): Promise<void> {
  const db = await openLocalDb(userId);
  const tx = db.transaction(STORE_META, "readwrite");
  tx.objectStore(STORE_META).put({ key, value });
  await done(tx);
}

/**
 * Drop EVERY local copy on this device.
 *
 * What "do not trust this device" has to mean now that the transcripts and the
 * coded passages are cached in clear: the encryption key is no longer the only
 * thing worth removing on the way out. Called with nobody logged in, so it works
 * from the remembered ids rather than from a session.
 */
export async function destroyAllLocalDbs(): Promise<void> {
  if (!isLocalDbAvailable()) return;

  // Two sources, because neither alone is enough. The remembered ids work
  // everywhere but live in localStorage, which the user (or a privacy setting) can
  // clear on its own — leaving a corpus behind that nothing would ever look for
  // again. `indexedDB.databases()` cannot be cleared out from under us but is not
  // implemented by every browser. A wipe that misses is the one failure mode this
  // function must not have, so it does both.
  const users = new Set(knownUsers());
  try {
    const listed = await indexedDB.databases?.();
    for (const { name } of listed ?? []) {
      if (name?.startsWith(DB_PREFIX)) users.add(name.slice(DB_PREFIX.length));
    }
  } catch {
    // Not supported, or refused in a private window: the remembered ids stand.
  }

  for (const userId of users) await destroyLocalDb(userId);
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(KNOWN_USERS_KEY);
  }
}

/**
 * Drop this user's local copy entirely — signing out of a device that is not
 * yours, or recovering from an index nobody can explain.
 */
export async function destroyLocalDb(userId: string): Promise<void> {
  if (!isLocalDbAvailable()) return;
  if (cached?.userId === userId) {
    try {
      (await cached.db).close();
    } catch {
      // Already closed, or never opened — deleting is still the right next step.
    }
    cached = null;
  }
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(dbName(userId));
    // `onblocked` fires when another tab still holds the database. Resolving
    // anyway is deliberate: the delete stays queued and completes when that tab
    // goes, and blocking the caller forever would be worse than a late wipe.
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
