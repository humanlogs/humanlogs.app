/**
 * Reading the local index in pages: the half of the query that touches IndexedDB.
 *
 * `phrase-stream.ts` can count a study without holding it, but only if something
 * feeds it one phrase at a time. This is that something.
 *
 * **Why not `getAll` any more.** The panel used to read a study whole and filter the
 * array. At the scale this is built for — 200k coded passages, 400k links — that was
 * ~6s and ~350MB before a single row was drawn, and it grew with the corpus rather
 * than with what was on screen. Here the rows come out in batches, each batch is fed
 * to the accumulator and dropped, and what survives the pass is a count per group
 * plus the references of the first page. Memory is O(page); the text of the sixty
 * rows actually rendered is fetched afterwards by id ({@link readPhraseRows}).
 *
 * **Why batches rather than a cursor.** A cursor is one round trip through the event
 * loop per record — measurably slower over hundreds of thousands of rows than a bulk
 * read — and its whole advantage, stopping early, is not available to a query that
 * has to COUNT what it does not show. `getAll(range, n)` is the bulk read with a
 * bound on it. The composite `[scope, phraseId]` index is what makes it resumable:
 * "the rows of this study after this phrase" is a key range, and a phrase's links
 * land together, so no phrase is ever split across two batches.
 *
 * One transaction per batch, deliberately. A transaction dies the moment control
 * returns to the event loop, and yielding between batches — which is what keeps
 * typing responsive while a study is counted — does exactly that.
 */

import type { CodeRef } from "@/lib/codebooks/codebook";
import {
  idbRequest,
  INDEX_DOCUMENT_PHRASE,
  INDEX_STUDY_PHRASE,
  MAX_PHRASE_KEY,
  openLocalDb,
  projectIdOf,
  studyKeyOf,
  STORE_PHRASE_CODES,
  STORE_PHRASES,
} from "./db.browser";
import type { PhraseCodeRow, PhraseRow } from "./phrase-index";
import type { PhraseFilter, PhraseGroupBy } from "./phrase-query";
import {
  createPhraseStream,
  type KnownCodebooks,
  type PhraseStreamResult,
} from "./phrase-stream";

/**
 * Rows per read.
 *
 * Large enough that the per-transaction cost disappears into it, small enough that
 * a batch and its structured clones are a few hundred kilobytes — the number that
 * replaces "the whole study" as the query's memory footprint.
 */
export const SCAN_BATCH = 4000;

/** How often the pass hands the main thread back. Every batch would be needless. */
const YIELD_EVERY = 4;

export type StudyQuery = {
  /** The study. `null` is the documents filed in none — a real scope, not "any". */
  projectId: string | null;
  filter?: PhraseFilter;
  groupBy?: PhraseGroupBy;
  codeOrder?: readonly CodeRef[];
  perGroup?: number;
  sanitize?: KnownCodebooks;
  /** Pair key → person, so grouping by speaker groups by person. */
  speakerPersons?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  /**
   * Rows per read. Only ever set by the tests, which need batches small enough
   * that a phrase actually straddles one — the boundary logic below is the part
   * that cannot be reasoned about on paper.
   */
  batchSize?: number;
};

const EMPTY: PhraseStreamResult = { total: 0, groups: [] };

/**
 * Answer the panel's question against the rows on disk.
 *
 * The result names its rows; it does not carry them. {@link readPhraseRows} turns
 * the page being rendered into text and chips.
 */
export async function queryStudy(
  userId: string,
  {
    projectId,
    filter = {},
    groupBy = "none",
    codeOrder,
    perGroup,
    sanitize,
    speakerPersons,
    signal,
    batchSize = SCAN_BATCH,
  }: StudyQuery,
): Promise<PhraseStreamResult> {
  // An explicitly empty dimension keeps nothing — the same rule the pure query has,
  // answered here without opening a transaction.
  if (
    filter.documentIds?.length === 0 ||
    filter.speakerKeys?.length === 0 ||
    filter.codes?.length === 0
  ) {
    return EMPTY;
  }

  const db = await openLocalDb(userId);
  const scope = scopeOf(projectId, filter);

  // The text pass runs first and alone, because matching text needs the phrase
  // rows and the counting pass reads only the links. It keeps ids, not rows.
  const { search, ...rest } = filter;
  const needle = search?.trim() ? fold(search.trim()) : "";
  const only = needle
    ? await matchingPhraseIds(db, scope, needle, batchSize, signal)
    : undefined;
  if (only && only.size === 0) return EMPTY;

  const stream = createPhraseStream({
    filter: rest,
    groupBy,
    codeOrder,
    perGroup,
    only,
    sanitize,
    speakerPersons,
  });

  const study = projectIdOf(studyKeyOf(projectId));
  let batches = 0;
  for await (const rows of pagesOf<StoredLink>(
    db,
    STORE_PHRASE_CODES,
    scope,
    (row) => row.phraseId,
    false,
    batchSize,
    signal,
  )) {
    // The stored rows carry `studyKey`, the pure layer speaks `projectId`. Written
    // onto the batch in place: these were just minted by the structured clone, so
    // nobody else holds a reference, and this is the one place the two vocabularies
    // meet.
    for (const row of rows) {
      (row as unknown as PhraseCodeRow).projectId =
        scope.kind === "study" ? study : projectIdOf(row.studyKey);
    }
    feed(rows as unknown as PhraseCodeRow[], (row) => row.phraseId, stream);
    if (++batches % YIELD_EVERY === 0) await yieldToMain();
  }

  return stream.result();
}

/** What the page being rendered needs: the passages themselves, and their codes. */
export type HydratedPhrases = {
  rows: Map<string, PhraseRow>;
  codes: Map<string, PhraseCodeRow[]>;
};

/**
 * Fetch the named phrases and their links.
 *
 * By id, one page at a time — sixty-odd rows — which is the point of the whole
 * redesign: a study is counted, a screenful is loaded. All the requests are issued
 * into a single transaction and awaited together, so this is one round trip's worth
 * of latency rather than one per row.
 */
export async function readPhraseRows(
  userId: string,
  ids: readonly string[],
): Promise<HydratedPhrases> {
  const rows = new Map<string, PhraseRow>();
  const codes = new Map<string, PhraseCodeRow[]>();
  if (ids.length === 0) return { rows, codes };

  const db = await openLocalDb(userId);
  const tx = db.transaction([STORE_PHRASES, STORE_PHRASE_CODES], "readonly");
  const phrases = tx.objectStore(STORE_PHRASES);
  const links = tx.objectStore(STORE_PHRASE_CODES).index("phraseId");

  // Every request issued before the first is awaited, so the transaction serves
  // them in one go instead of being kept alive across a hundred round trips.
  const pending = Array.from(new Set(ids)).map((id) => ({
    id,
    row: idbRequest<StoredPhrase | undefined>(phrases.get(id)),
    links: idbRequest<StoredLink[]>(links.getAll(id)),
  }));
  const fetched = await Promise.all(
    pending.map(async (entry) => ({
      id: entry.id,
      row: await entry.row,
      links: await entry.links,
    })),
  );

  for (const { id, row, links: found } of fetched) {
    // A row can vanish between the count and the render — the document was
    // reindexed while the reader scrolled. Skipping it is right: the list shows one
    // fewer excerpt until the query re-runs, rather than an empty card.
    if (row) {
      (row as unknown as PhraseRow).projectId = projectIdOf(row.studyKey);
      rows.set(id, row as unknown as PhraseRow);
    }
    for (const link of found) {
      (link as unknown as PhraseCodeRow).projectId = projectIdOf(link.studyKey);
    }
    // Stable chip order, whatever order the store handed them back in.
    found.sort(
      (a, b) =>
        a.codebookId.localeCompare(b.codebookId) ||
        a.codeId.localeCompare(b.codeId) ||
        a.userId.localeCompare(b.userId),
    );
    codes.set(id, found as unknown as PhraseCodeRow[]);
  }
  return { rows, codes };
}

// ---------------------------------------------------------------------------
// The scan
// ---------------------------------------------------------------------------

type StoredPhrase = Omit<PhraseRow, "projectId"> & { studyKey: string };
type StoredLink = Omit<PhraseCodeRow, "projectId"> & { studyKey: string };

/**
 * Which index the walk runs on, and with what key.
 *
 * Scoped to ONE document when that is what is being asked for — the panel's default
 * while coding — because reading a study to display one interview is the same
 * mistake at a smaller scale. Any wider question walks the study.
 */
type Scope = { kind: "study" | "document"; index: string; key: string };

function scopeOf(projectId: string | null, filter: PhraseFilter): Scope {
  if (filter.documentIds?.length === 1) {
    return {
      kind: "document",
      index: INDEX_DOCUMENT_PHRASE,
      key: filter.documentIds[0],
    };
  }
  return {
    kind: "study",
    index: INDEX_STUDY_PHRASE,
    key: studyKeyOf(projectId),
  };
}

/**
 * The rows of a scope, in batches, each ending on a phrase boundary.
 *
 * Resuming is the whole trick: the index key is `[scope, phraseId]`, so the next
 * batch is everything from the last phrase this one saw — inclusive, since that
 * phrase's remaining links were withheld and must come back at the head of the next
 * read rather than be dropped.
 */
async function* pagesOf<T>(
  db: IDBDatabase,
  storeName: string,
  scope: Scope,
  phraseIdOf: (row: T) => string,
  /**
   * Whether one phrase is one row here. True for `phrases`, whose primary key IS
   * the phrase id: nothing can straddle a batch, so nothing is withheld.
   */
  oneRowPerPhrase: boolean,
  batch: number,
  signal?: AbortSignal,
): AsyncGenerator<T[]> {
  let from = "";
  let after = false;

  for (;;) {
    signal?.throwIfAborted();
    const store = db.transaction(storeName, "readonly").objectStore(storeName);
    const rows = await idbRequest<T[]>(
      store
        .index(scope.index)
        .getAll(
          IDBKeyRange.bound(
            [scope.key, from],
            [scope.key, MAX_PHRASE_KEY],
            after,
            false,
          ),
          batch,
        ),
    );

    if (rows.length === 0) return;
    const last = phraseIdOf(rows[rows.length - 1]);
    if (rows.length < batch) {
      yield rows;
      return;
    }

    if (oneRowPerPhrase) {
      yield rows;
      from = last;
      after = true;
      continue;
    }

    if (phraseIdOf(rows[0]) === last) {
      // One phrase filling an entire batch — implausible (a phrase has one link per
      // code applied to its exact span) but not impossible, and truncating it would
      // silently under-count. Ask for it whole, then step past it.
      yield await idbRequest<T[]>(store.index("phraseId").getAll(last));
      from = last;
      after = true;
      continue;
    }

    // Hold back the trailing phrase: its links may continue into the next batch,
    // and the accumulator is only allowed to see a phrase once, complete.
    let cut = rows.length;
    while (cut > 0 && phraseIdOf(rows[cut - 1]) === last) cut--;
    yield rows.slice(0, cut);
    from = last;
    after = false;
  }
}

/** Hand each complete run of one phrase's rows to the accumulator. */
function feed<T>(
  rows: readonly T[],
  phraseIdOf: (row: T) => string,
  stream: { addPhrase: (id: string, links: readonly PhraseCodeRow[]) => void },
): void {
  let start = 0;
  for (let i = 1; i <= rows.length; i++) {
    if (i < rows.length && phraseIdOf(rows[i]) === phraseIdOf(rows[start]))
      continue;
    stream.addPhrase(
      phraseIdOf(rows[start]),
      rows.slice(start, i) as unknown as PhraseCodeRow[],
    );
    start = i;
  }
}

/**
 * The ids whose text matches, from a pass over the phrases alone.
 *
 * Separate from the counting pass because the two read different stores, and
 * because this one is only paid when someone actually types in the search box.
 * Retains ids, never rows.
 */
async function matchingPhraseIds(
  db: IDBDatabase,
  scope: Scope,
  needle: string,
  batch: number,
  signal?: AbortSignal,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let batches = 0;
  for await (const rows of pagesOf<StoredPhrase>(
    db,
    STORE_PHRASES,
    scope,
    (row) => row.id,
    true,
    batch,
    signal,
  )) {
    for (const row of rows) {
      if (fold(row.text).includes(needle)) ids.add(row.id);
    }
    if (++batches % YIELD_EVERY === 0) await yieldToMain();
  }
  return ids;
}

/** Fold accents and case, exactly as the pure query does. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Give the browser a turn.
 *
 * `scheduler.yield` where it exists — it resumes ahead of newly queued tasks, so a
 * long pass cannot be starved by the work it lets through. A message channel
 * elsewhere, because `setTimeout(0)` is clamped to 4ms and a hundred batches of that
 * is half a second of nothing.
 */
function yieldToMain(): Promise<void> {
  const scheduler = (
    globalThis as {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}
