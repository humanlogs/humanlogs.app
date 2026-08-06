/**
 * Answering the panel's question without holding the study.
 *
 * **Why the filtering is in JavaScript at all.** The question is faceted — OR
 * inside a dimension, AND across them — and IndexedDB serves exactly one index
 * per query. There is no index for "the passages of these speakers, coded this,
 * by that author": the store can narrow the scan (by study, by code, by
 * document) but the intersection has to be computed by the reader. That is a
 * property of the database, not a shortcut.
 *
 * What was wrong was not the JavaScript, it was the MATERIALISING: the whole
 * study came out of IndexedDB into an array and the filter ran over the array,
 * so displaying sixty rows cost a few hundred megabytes and several seconds.
 *
 * This module is the same predicate logic, restructured so nothing is retained.
 * It is fed one phrase at a time and keeps only:
 *
 *   - a COUNT per group — integers;
 *   - the first `perGroup` references of each group, in reading order.
 *
 * Memory is therefore O(groups × page), whatever the corpus. The text of the rows
 * on screen, and their chips, are fetched afterwards by id.
 *
 * The feeding order matters and is not an accident: a cursor over the
 * `phraseCodes` store's `studyKey` index yields records sorted by index key then
 * by PRIMARY key, and the primary key is `[phraseId, codingId]` — so a phrase's
 * links arrive together, and each phrase can be decided and forgotten as it goes.
 */

import type { CodeRef } from "@/lib/codebooks/codebook";
import type { PhraseCodeRow } from "./phrase-index";
import {
  codeRefKey,
  speakerKey,
  type PhraseFilter,
  type PhraseGroupBy,
  type PhraseGroupLabel,
} from "./phrase-query";

/** Enough of a phrase to place and order it. The text is fetched by id later. */
export type PhraseRef = {
  id: string;
  documentId: string;
  offset: number;
};

export type StreamedGroup = {
  key: string;
  label: PhraseGroupLabel;
  /** Every phrase in this group, counted — not only the ones kept below. */
  count: number;
  /** The first `perGroup` of them, in reading order. */
  refs: PhraseRef[];
};

export type PhraseStreamResult = {
  /** Distinct phrases kept. A phrase under two codes is counted ONCE here. */
  total: number;
  groups: StreamedGroup[];
};

/**
 * How many rows of each group are kept.
 *
 * The list pages in sixties, so this is several pages of headroom: scrolling
 * within it costs nothing, and only a reader who goes deeper than this pays for
 * another pass.
 */
export const DEFAULT_PER_GROUP = 300;

export type PhraseStream = {
  /**
   * One phrase and every link it carries. Links of a phrase must arrive
   * together; phrases may arrive in any order.
   */
  addPhrase: (phraseId: string, links: readonly PhraseCodeRow[]) => void;
  result: () => PhraseStreamResult;
};

/**
 * The codebooks as this account can read them, for dropping links whose code no
 * longer exists — the streaming form of {@link sanitizeLinks}, which cannot be
 * applied beforehand when the rows are never all in memory at once.
 *
 * Plain data rather than a predicate, so the whole query stays serializable and can
 * be handed to a worker. Same rules as `sanitizeLinks`: an empty list filters
 * nothing, and a codebook this account does not hold is kept whole (a colleague
 * coding through a prism we cannot read is not a deletion).
 */
export type KnownCodebooks = ReadonlyArray<{
  id: string;
  codeIds: readonly string[];
}>;

export function createPhraseStream({
  filter = {},
  groupBy = "none",
  codeOrder,
  perGroup = DEFAULT_PER_GROUP,
  only,
  sanitize,
}: {
  /**
   * Everything but `search`: matching text needs the phrase rows, which this
   * never reads. The caller runs that pass first and passes the survivors as
   * {@link only}.
   */
  filter?: Omit<PhraseFilter, "search">;
  groupBy?: PhraseGroupBy;
  codeOrder?: readonly CodeRef[];
  perGroup?: number;
  /** When given, only these phrase ids are considered at all. */
  only?: ReadonlySet<string>;
  sanitize?: KnownCodebooks;
}): PhraseStream {
  const documentIds = filter.documentIds && new Set(filter.documentIds);
  const speakerKeys = filter.speakerKeys && new Set(filter.speakerKeys);
  const wantedCodes = filter.codes && new Set(filter.codes.map(codeRefKey));
  const userIds = filter.userIds && new Set(filter.userIds);
  const known =
    sanitize && sanitize.length > 0
      ? new Map(sanitize.map((book) => [book.id, new Set(book.codeIds)]))
      : null;
  const deleted = (link: PhraseCodeRow): boolean => {
    const codes = known?.get(link.codebookId);
    return !!codes && !codes.has(link.codeId);
  };

  const groups = new Map<string, StreamedGroup>();
  const ensure = (key: string, label: PhraseGroupLabel): StreamedGroup => {
    let group = groups.get(key);
    if (!group) {
      group = { key, label, count: 0, refs: [] };
      groups.set(key, group);
    }
    return group;
  };

  // Seeded first, so the groups read as the codebook does and the codes nobody
  // used are still visible — the same rule the materialising query had.
  if (groupBy === "code" && codeOrder) {
    for (const ref of codeOrder) {
      ensure(`code:${codeRefKey(ref)}`, {
        type: "code",
        codebookId: ref.codebookId,
        codeId: ref.codeId,
      });
    }
  }

  let total = 0;
  /** Reused across phrases so a pass over a study allocates one array, not N. */
  const keys: string[] = [];
  const labels: PhraseGroupLabel[] = [];

  const addPhrase = (phraseId: string, links: readonly PhraseCodeRow[]) => {
    if (only && !only.has(phraseId)) return;

    let matched = false;
    let ref: PhraseRef | null = null;
    keys.length = 0;
    labels.length = 0;

    for (const link of links) {
      if (deleted(link)) continue;
      if (documentIds && !documentIds.has(link.documentId)) continue;
      if (filter.projectId !== undefined && link.projectId !== filter.projectId)
        continue;
      if (
        speakerKeys &&
        !speakerKeys.has(speakerKey(link.documentId, link.speakerId))
      )
        continue;
      if (userIds && !userIds.has(link.userId)) continue;

      if (!ref) {
        ref = {
          id: phraseId,
          documentId: link.documentId,
          offset: link.offset,
        };
      }
      if (!wantedCodes || wantedCodes.has(codeRefKey(link))) matched = true;

      // A phrase belongs to a code group once, however many people applied that
      // code to it. Grouping by anything else is a partition, so one key.
      switch (groupBy) {
        case "code": {
          const key = `code:${codeRefKey(link)}`;
          if (!keys.includes(key)) {
            keys.push(key);
            labels.push({
              type: "code",
              codebookId: link.codebookId,
              codeId: link.codeId,
            });
          }
          break;
        }
        case "codebook": {
          const key = `codebook:${link.codebookId}`;
          if (!keys.includes(key)) {
            keys.push(key);
            labels.push({ type: "codebook", codebookId: link.codebookId });
          }
          break;
        }
        case "document":
          if (keys.length === 0) {
            keys.push(`document:${link.documentId}`);
            labels.push({ type: "document", documentId: link.documentId });
          }
          break;
        case "speaker":
          if (keys.length === 0) {
            keys.push(`speaker:${speakerKey(link.documentId, link.speakerId)}`);
            labels.push({
              type: "speaker",
              documentId: link.documentId,
              speakerId: link.speakerId,
            });
          }
          break;
        default:
          if (keys.length === 0) {
            keys.push("all");
            labels.push({ type: "all" });
          }
      }
    }

    if (!matched || !ref) return;
    total++;
    for (let i = 0; i < keys.length; i++) {
      const group = ensure(keys[i], labels[i]);
      group.count++;
      insert(group.refs, ref, perGroup);
    }
  };

  return {
    addPhrase,
    result: () => ({ total, groups: ordered(groups, groupBy, codeOrder) }),
  };
}

/**
 * The order the groups come back in.
 *
 * The codebook's own order wins where there is one — that is what makes a coding
 * pass read like the grille it is made with, empty codes included. Everything
 * else is sorted by size, largest first, then by key.
 *
 * Not "the order they were encountered", which is what both this and the
 * materialising query used to do: that order is a property of how the rows
 * happened to be stored, so it differed between the two implementations and
 * would shift under the reader as a study is re-indexed. Arbitrary is fine in a
 * function; it is not fine in a list someone is scanning.
 */
function ordered(
  groups: Map<string, StreamedGroup>,
  groupBy: PhraseGroupBy,
  codeOrder?: readonly CodeRef[],
): StreamedGroup[] {
  const all = [...groups.values()];
  if (groupBy === "code" && codeOrder) {
    const rank = new Map(
      codeOrder.map((ref, i) => [`code:${codeRefKey(ref)}`, i]),
    );
    return all.sort((a, b) => {
      const ra = rank.get(a.key) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.key) ?? Number.MAX_SAFE_INTEGER;
      // Codes the codebook no longer lists still have passages under them; they
      // follow the ones it does, biggest first.
      return ra - rb || b.count - a.count || (a.key < b.key ? -1 : 1);
    });
  }
  return all.sort(
    (a, b) => b.count - a.count || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

/** Reading order: by document, then by position within it. */
function before(a: PhraseRef, b: PhraseRef): boolean {
  if (a.documentId !== b.documentId) return a.documentId < b.documentId;
  return a.offset < b.offset;
}

/**
 * Keep the `limit` earliest refs, sorted.
 *
 * An insertion sort into a bounded array rather than "collect then sort": the
 * whole point is never to hold more than a page, and a row past the end of a
 * full page is rejected on one comparison — which is what almost every row of a
 * large study is.
 */
function insert(refs: PhraseRef[], ref: PhraseRef, limit: number): void {
  if (refs.length >= limit && !before(ref, refs[refs.length - 1])) return;
  let low = 0;
  let high = refs.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (before(refs[mid], ref)) low = mid + 1;
    else high = mid;
  }
  refs.splice(low, 0, ref);
  if (refs.length > limit) refs.pop();
}

/** A page of a streamed result: what to draw, and what is behind it. */
export type PhrasePage = {
  groups: StreamedGroup[];
  /** References actually in `groups` — what is mounted. */
  shown: number;
  /** References the pass kept, across every group. The ceiling for scrolling. */
  available: number;
  /** Passages the pass COUNTED. Larger than `available` past `perGroup`. */
  total: number;
};

/**
 * The first `limit` references of a streamed result.
 *
 * Groups are kept WHOLE down to the row — an empty code group is one line and says
 * something (nothing was coded with it) — so only references are counted.
 *
 * The three numbers it returns are three different questions and the list needs all
 * of them: `shown` is what is mounted, `available` is how far scrolling can go
 * before another pass is required, and `total` is what the study actually holds.
 * Conflating the last two is how a list ends up growing forever towards rows that
 * were never fetched.
 */
export function takeRefs(
  groups: readonly StreamedGroup[],
  limit: number,
): PhrasePage {
  let budget = Math.max(0, limit);
  let shown = 0;
  let available = 0;
  let total = 0;
  const out: StreamedGroup[] = [];
  for (const group of groups) {
    available += group.refs.length;
    total += group.count;
    if (budget === 0 && group.refs.length > 0) continue;
    const take = Math.min(group.refs.length, budget);
    out.push(
      take === group.refs.length
        ? group
        : { ...group, refs: group.refs.slice(0, take) },
    );
    budget -= take;
    shown += take;
  }
  return { groups: out, shown, available, total };
}

/**
 * Drive a stream from links already in memory — the live document, and the
 * tests. Groups them by phrase itself, which the cursor gets for free.
 */
export function streamFromLinks(
  links: readonly PhraseCodeRow[],
  options: Parameters<typeof createPhraseStream>[0] = {},
): PhraseStreamResult {
  const stream = createPhraseStream(options);
  const byPhrase = new Map<string, PhraseCodeRow[]>();
  for (const link of links) {
    const bucket = byPhrase.get(link.phraseId);
    if (bucket) bucket.push(link);
    else byPhrase.set(link.phraseId, [link]);
  }
  for (const [phraseId, group] of byPhrase) stream.addPhrase(phraseId, group);
  return stream.result();
}
