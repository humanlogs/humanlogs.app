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

import type { CodeRef, SpeakerCodeRef } from "@/lib/codebooks/codebook";
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

export type PhraseGroupBy = "none" | "code" | "codebook" | "document" | "speaker";

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
  /** The codes each kept phrase carries, in a stable order — the row's chips. */
  codesByPhrase: Map<string, PhraseCodeRow[]>;
  groups: PhraseGroup[];
};

/** Fold accents and case so «Violence» and «violencé» both match a search for "viol". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
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
 * The (document, speaker) pairs carrying any of `codes`.
 *
 * A code put on the DOCUMENT counts for every speaker in it: coding an interview
 * «hôpital» says something about everyone speaking in it, and a filter that ignored
 * that would silently drop the documents coded as a whole. `speakerIdsOf` supplies
 * the roster, which lives in the document list's speaker cache.
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
      if (wanted.has(codeRefKey(ref))) keys.push(speakerKey(doc.id, ref.speakerId));
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
    if (speakerKeys && !speakerKeys.has(speakerKey(link.documentId, link.speakerId)))
      continue;
    if (userIds && !userIds.has(link.userId)) continue;

    // Every link of a kept phrase is shown, including those of codes the filter did
    // not ask for: an excerpt that also carries «institution» must not be displayed
    // as if «violence» were all it said.
    const bucket = kept.get(link.phraseId);
    if (bucket) bucket.push(link);
    else kept.set(link.phraseId, [link]);

    if (!wantedCodes || wantedCodes.has(codeRefKey(link))) matched.add(link.phraseId);
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
  out.sort((a, b) => a.documentId.localeCompare(b.documentId) || a.offset - b.offset);

  return {
    phrases: out,
    codesByPhrase,
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
