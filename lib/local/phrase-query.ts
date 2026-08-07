/**
 * Querying the coded-passage index: filtering it, and grouping what comes back.
 *
 * This is the whole behaviour of the excerpt panel, kept as a pure function of its
 * rows so it can be tested without a browser and reused wherever the rows come from
 * (IndexedDB for the corpus, the live editor for the document being coded).
 *
 * **Facet semantics.** Every dimension is OR-ed inside itself and AND-ed with the
 * others — the shape of the question researchers actually ask: *the passages of the
 * speakers coded «cadre» OR «direction», in the documents coded «hôpital», that I
 * read as «violence» OR one of its sub-themes*. Widening one dimension never
 * narrows another, which is what makes the filter bar feel like a set of dials
 * rather than a query language.
 *
 * The document/speaker halves are resolved FIRST, from the codes carried by the
 * documents themselves ({@link documentsMatchingCodes},
 * {@link speakersMatchingCodes}) — a small in-memory pass over the study's document
 * list, which the app already holds. Only then does the index get touched, with the
 * resulting ids. That is the "première recherche simple" the model was designed
 * around: it turns a question about people into a question about ids, and leaves the
 * link table to answer only what it alone can.
 */

import {
  flattenCodes,
  type Code,
  type CodeRef,
  type SpeakerCodeRef,
} from "@/lib/codebooks/codebook";
import type { PhraseCodeRow, PhraseRow } from "./phrase-index";

/**
 * A speaker is only identified WITHIN a document — `speaker_1` of one interview has
 * nothing to do with `speaker_1` of the next — so a set of speakers is a set of
 * (document, speaker) pairs.
 */
export function speakerKey(
  documentId: string,
  speakerId: string | null | undefined,
): string {
  return `${documentId}:${speakerId ?? ""}`;
}

export function codeRefKey(ref: CodeRef): string {
  return `${ref.codebookId}:${ref.codeId}`;
}

export type PhraseFilter = {
  /** The study. `undefined` keeps every study, `null` the documents filed in none. */
  projectId?: string | null;
  /** Documents to keep. `undefined` keeps them all; an EMPTY array keeps none. */
  documentIds?: readonly string[];
  /** Speakers to keep, as {@link speakerKey} values. Same empty-array rule. */
  speakerKeys?: readonly string[];
  /** Verbatim codes to keep. Same empty-array rule. */
  codes?: readonly CodeRef[];
  /** Authors whose readings to keep — how "my codes" vs "everyone's" is expressed. */
  userIds?: readonly string[];
  /** Free text, matched case- and accent-insensitively against the passage. */
  search?: string;
};

export type PhraseGroupBy =
  | "none"
  | "code"
  | "codebook"
  | "document"
  | "speaker";

export const PHRASE_GROUP_BY: PhraseGroupBy[] = [
  "none",
  "code",
  "codebook",
  "document",
  "speaker",
];

export const DEFAULT_PHRASE_GROUP_BY: PhraseGroupBy = "code";

/** What a group header stands for; the component turns it into a label. */
export type PhraseGroupLabel =
  | { type: "all" }
  | { type: "code"; codebookId: string; codeId: string }
  | { type: "codebook"; codebookId: string }
  | { type: "document"; documentId: string }
  | { type: "speaker"; documentId: string; speakerId: string | null };

export type PhraseGroup = {
  key: string;
  label: PhraseGroupLabel;
  phrases: PhraseRow[];
};

export type PhraseQueryResult = {
  phrases: PhraseRow[];
  /**
   * The codes a kept phrase carries, in a stable order — the row's chips.
   *
   * A lookup rather than a materialised map of display objects: the grouping
   * needs every phrase's codes, but only the sixty rows on screen need them
   * turned into anything. Building that for the whole result was, at a study's
   * scale, hundreds of thousands of arrays allocated for rows nobody will scroll
   * to.
   */
  codesOf: (phraseId: string) => PhraseCodeRow[];
  groups: PhraseGroup[];
};

/** Stable empty result, so a phrase with no codes never allocates. */
const NO_CODES: PhraseCodeRow[] = [];

/** Fold accents and case so «Violence» and «violencé» both match a search for "viol". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Whether a phrase is one of the excerpts a set of anchors points at.
 *
 * The editor can say WHICH ANCHORS are under the caret, but not which row they
 * belong to: a phrase is identified by the anchors covering its EXACT span, and two
 * overlapping codings put a different set on each of their runs than either one
 * spans. So it publishes anchors, and the rows recognise themselves — which is also
 * why selecting an overlapped passage lights up every excerpt covering it rather
 * than none.
 *
 * An exact row id short-circuits it: when the table is the one pointing, it knows
 * the row it means.
 */
export function phraseMatchesAnchors(
  phrase: { id: string; documentId: string; codingIds: readonly string[] },
  anchors: {
    documentId: string;
    phraseId?: string;
    codingIds: readonly string[];
  } | null,
): boolean {
  if (!anchors || anchors.documentId !== phrase.documentId) return false;
  if (anchors.phraseId) return anchors.phraseId === phrase.id;
  return phrase.codingIds.some((id) => anchors.codingIds.includes(id));
}

/**
 * Drop the links whose code no longer exists.
 *
 * Deleting a code leaves its codings behind on purpose — cleaning every document on
 * every delete would be a large write — so filtering is what makes them invisible,
 * exactly as `sanitizeCodings` does everywhere else.
 *
 * A link to a codebook that is NOT in `codebooks` is kept: that is a colleague
 * coding through a prism this account cannot read, not a deletion, and hiding it
 * would quietly under-report a shared study. An empty `codebooks` therefore filters
 * nothing, which is also the right answer while they are still loading.
 */
export function sanitizeLinks(
  links: readonly PhraseCodeRow[],
  codebooks: ReadonlyArray<{ id: string; codes: Code[] }>,
): PhraseCodeRow[] {
  if (codebooks.length === 0) return [...links];
  const known = new Map(
    codebooks.map((codebook) => [
      codebook.id,
      new Set(flattenCodes(codebook.codes).map(({ code }) => code.id)),
    ]),
  );
  return links.filter((link) => {
    const codes = known.get(link.codebookId);
    return !codes || codes.has(link.codeId);
  });
}

/**
 * The documents carrying any of `codes`.
 *
 * Document-level and speaker-level refs both count, for the same reason the sidebar's
 * grouping counts both: a speaker codebook codes the interview and the people in it,
 * and "the documents coded «hôpital»" means the ones where that is true of either.
 */
export function documentsMatchingCodes(
  documents: ReadonlyArray<{
    id: string;
    codes?: CodeRef[] | null;
    speakerCodes?: SpeakerCodeRef[] | null;
  }>,
  codes: readonly CodeRef[],
): string[] {
  if (codes.length === 0) return documents.map((d) => d.id);
  const wanted = new Set(codes.map(codeRefKey));
  return documents
    .filter((doc) =>
      [...(doc.codes ?? []), ...(doc.speakerCodes ?? [])].some((ref) =>
        wanted.has(codeRefKey(ref)),
      ),
    )
    .map((doc) => doc.id);
}

/**
 * The (document, speaker) pairs carrying any of `codes`, WITHIN each document.
 *
 * A code put on the DOCUMENT counts for every speaker in it: coding an interview
 * «hôpital» says something about everyone speaking in it, and a filter that ignored
 * that would silently drop the documents coded as a whole. `speakerIdsOf` supplies
 * the roster, which lives in the document list's speaker cache.
 *
 * **Not what the panel uses.** A code on a person is a claim about the person, so
 * it has to follow them into the other interviews of the study — see
 * `speakersMatchingCodesByPerson` in speaker-identity.ts, which is this rule plus
 * the name-based link. This one stays as the per-document rule it always was, and
 * as the thing that version is tested against.
 */
export function speakersMatchingCodes(
  documents: ReadonlyArray<{
    id: string;
    codes?: CodeRef[] | null;
    speakerCodes?: SpeakerCodeRef[] | null;
  }>,
  codes: readonly CodeRef[],
  speakerIdsOf: (documentId: string) => readonly string[],
): string[] {
  const wanted = new Set(codes.map(codeRefKey));
  const keys: string[] = [];
  for (const doc of documents) {
    const everySpeaker = () => {
      for (const speakerId of speakerIdsOf(doc.id)) {
        keys.push(speakerKey(doc.id, speakerId));
      }
    };
    if (codes.length === 0) {
      everySpeaker();
      continue;
    }
    if ((doc.codes ?? []).some((ref) => wanted.has(codeRefKey(ref)))) {
      everySpeaker();
      continue;
    }
    for (const ref of doc.speakerCodes ?? []) {
      if (wanted.has(codeRefKey(ref)))
        keys.push(speakerKey(doc.id, ref.speakerId));
    }
  }
  return Array.from(new Set(keys));
}

/**
 * Apply a filter and group the result.
 *
 * Grouping by code puts a phrase in EVERY group it belongs to — a passage read as
 * both «violence» and «institution» is listed under both, once each, because the
 * table is a reading aid and hiding one of the two readings would be a claim the
 * data does not make. Every other grouping is a partition.
 *
 * `codeOrder`, when given, fixes the order of the code groups AND keeps the empty
 * ones: opening a document grouped by the codebook in use should show the whole
 * codebook, so what has *not* been coded is as visible as what has.
 */
export function queryPhrases({
  phrases,
  links,
  filter = {},
  groupBy = "none",
  codeOrder,
}: {
  phrases: readonly PhraseRow[];
  links: readonly PhraseCodeRow[];
  filter?: PhraseFilter;
  groupBy?: PhraseGroupBy;
  codeOrder?: readonly CodeRef[];
}): PhraseQueryResult {
  const documentIds = filter.documentIds && new Set(filter.documentIds);
  const speakerKeys = filter.speakerKeys && new Set(filter.speakerKeys);
  const wantedCodes = filter.codes && new Set(filter.codes.map(codeRefKey));
  const userIds = filter.userIds && new Set(filter.userIds);
  const needle = filter.search ? fold(filter.search.trim()) : "";

  // Pass 1 — the link table. It decides which phrases survive the code and author
  // dimensions, and supplies the chips of the ones that do.
  const kept = new Map<string, PhraseCodeRow[]>();
  const matched = new Set<string>();
  for (const link of links) {
    if (documentIds && !documentIds.has(link.documentId)) continue;
    if (filter.projectId !== undefined && link.projectId !== filter.projectId)
      continue;
    if (
      speakerKeys &&
      !speakerKeys.has(speakerKey(link.documentId, link.speakerId))
    )
      continue;
    if (userIds && !userIds.has(link.userId)) continue;

    // Every link of a kept phrase is shown, including those of codes the filter did
    // not ask for: an excerpt that also carries «institution» must not be displayed
    // as if «violence» were all it said.
    const bucket = kept.get(link.phraseId);
    if (bucket) bucket.push(link);
    else kept.set(link.phraseId, [link]);

    if (!wantedCodes || wantedCodes.has(codeRefKey(link)))
      matched.add(link.phraseId);
  }

  // Pass 2 — the phrases themselves, in reading order within each document.
  const out: PhraseRow[] = [];
  const codesByPhrase = new Map<string, PhraseCodeRow[]>();
  for (const phrase of phrases) {
    if (!matched.has(phrase.id)) continue;
    if (needle && !fold(phrase.text).includes(needle)) continue;
    const codes = kept.get(phrase.id) ?? [];
    codes.sort(
      (a, b) =>
        a.codebookId.localeCompare(b.codebookId) ||
        a.codeId.localeCompare(b.codeId) ||
        a.userId.localeCompare(b.userId),
    );
    codesByPhrase.set(phrase.id, codes);
    out.push(phrase);
  }
  out.sort(
    (a, b) => a.documentId.localeCompare(b.documentId) || a.offset - b.offset,
  );

  return {
    phrases: out,
    codesOf: (phraseId) => codesByPhrase.get(phraseId) ?? NO_CODES,
    groups: groupPhrases(out, codesByPhrase, groupBy, codeOrder),
  };
}

function groupPhrases(
  phrases: PhraseRow[],
  codesByPhrase: Map<string, PhraseCodeRow[]>,
  groupBy: PhraseGroupBy,
  codeOrder?: readonly CodeRef[],
): PhraseGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: { type: "all" }, phrases }];
  }

  if (groupBy === "code" || groupBy === "codebook") {
    const buckets = new Map<string, PhraseGroup>();
    const ensure = (key: string, label: PhraseGroupLabel): PhraseGroup => {
      let group = buckets.get(key);
      if (!group) {
        group = { key, label, phrases: [] };
        buckets.set(key, group);
      }
      return group;
    };

    // Seed the requested order first, so the groups read as the codebook does and
    // the codes nobody used are still visible.
    if (groupBy === "code" && codeOrder) {
      for (const ref of codeOrder) {
        ensure(`code:${codeRefKey(ref)}`, {
          type: "code",
          codebookId: ref.codebookId,
          codeId: ref.codeId,
        });
      }
    }

    for (const phrase of phrases) {
      const seen = new Set<string>();
      for (const link of codesByPhrase.get(phrase.id) ?? []) {
        const key =
          groupBy === "code"
            ? `code:${codeRefKey(link)}`
            : `codebook:${link.codebookId}`;
        // The same code applied by two authors is one group, not two.
        if (seen.has(key)) continue;
        seen.add(key);
        ensure(
          key,
          groupBy === "code"
            ? { type: "code", codebookId: link.codebookId, codeId: link.codeId }
            : { type: "codebook", codebookId: link.codebookId },
        ).phrases.push(phrase);
      }
    }
    return Array.from(buckets.values());
  }

  const buckets = new Map<string, PhraseGroup>();
  for (const phrase of phrases) {
    const key =
      groupBy === "document"
        ? `document:${phrase.documentId}`
        : `speaker:${speakerKey(phrase.documentId, phrase.speakerId)}`;
    let group = buckets.get(key);
    if (!group) {
      group = {
        key,
        label:
          groupBy === "document"
            ? { type: "document", documentId: phrase.documentId }
            : {
                type: "speaker",
                documentId: phrase.documentId,
                speakerId: phrase.speakerId,
              },
        phrases: [],
      };
      buckets.set(key, group);
    }
    group.phrases.push(phrase);
  }
  return Array.from(buckets.values());
}

/**
 * The first `limit` excerpts of a grouped result, and how many are left.
 *
 * The panel renders a page at a time and grows as the reader scrolls: a study can
 * hold tens of thousands of coded passages, and mounting them all would be as slow
 * as it sounds. Groups are kept WHOLE down to the row — an empty code group is one
 * line and says something (nothing was coded with it) — so only rows are counted.
 */
export function takeGroups(
  groups: readonly PhraseGroup[],
  limit: number,
): { groups: PhraseGroup[]; remaining: number } {
  let budget = Math.max(0, limit);
  let total = 0;
  const out: PhraseGroup[] = [];
  for (const group of groups) {
    total += group.phrases.length;
    if (budget === 0 && group.phrases.length > 0) continue;
    if (group.phrases.length <= budget) {
      out.push(group);
      budget -= group.phrases.length;
    } else {
      out.push({ ...group, phrases: group.phrases.slice(0, budget) });
      budget = 0;
    }
  }
  return { groups: out, remaining: Math.max(0, total - limit) };
}
