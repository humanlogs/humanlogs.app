/**
 * The index of coded passages — the local, queryable projection of "what has been
 * coded, where, by whom".
 *
 * A code applied to a passage currently lives in two halves that are useless apart:
 * the `Coding` row says WHICH code and WHOSE reading it is, the `coding` mark in the
 * transcript says WHERE. Answering the question a researcher actually asks — *show me
 * every passage coded «violence», by the participants coded «cadre», across the
 * study* — therefore means holding both halves at once, for every document of the
 * corpus. At the target scale (1000 documents, ~100M words) that is not something to
 * ask the server for on each keystroke, and for an end-to-end encrypted study the
 * server could not answer it at all: the text never reaches it in clear.
 *
 * So the join happens on the client and is cached in IndexedDB (see db.browser.ts).
 * This module is the pure half of it: given a document's flat projection and its
 * codings, produce the rows. It is deliberately free of React, of IndexedDB and of
 * `node:crypto`, so the sync engine, the panel and the tests can all import it.
 *
 * Two tables, because that is the shape of the question:
 *
 *  - a **phrase** is a passage — one span of text, in one document, from one speaker.
 *    It is what a row of the table shows.
 *  - a **phrase code** links a phrase to one code, from one codebook, applied by one
 *    author. A passage read as both «violence» and «institution» is ONE phrase with
 *    two links, which is why the two cannot be collapsed into one table.
 *
 * Both are DERIVED. Nothing here is authoritative: the transcript and the `Coding`
 * rows are, and the whole index for a document is rebuilt from them whenever it
 * changes. That is what lets it be a plain cache — wrong at worst by one resync,
 * never by a merge conflict.
 */

import type { TranscriptionSegment } from "@/hooks/use-transcriptions";

/** A coded passage. One row of the excerpt table. */
export type PhraseRow = {
  /**
   * Deterministic given the document's content: rebuilding the index for an
   * unchanged document produces the same ids, so a selected row survives a resync.
   * Derived from the anchors rather than from an offset, which every edit above the
   * passage would shift.
   */
  id: string;
  documentId: string;
  /** The study, denormalized so a study-wide query never has to join documents. */
  projectId: string | null;
  /**
   * The speaker of the passage — the transcript's speaker id (`speaker_0`, or a
   * uuid), a position rather than a name. Null on a passage that starts in the
   * spacing between two turns, which nothing selects on purpose.
   */
  speakerId: string | null;
  text: string;
  /**
   * Character offset of the passage in the document's flat projection. Not an
   * identity (it moves under any edit above it) — only the within-document sort
   * key, so excerpts read in the order they are spoken.
   */
  offset: number;
  /**
   * The coding anchors covering exactly this span: the way back into the editor
   * (`[data-coding-id~="…"]`) and the join key to {@link PhraseCodeRow}.
   */
  codingIds: string[];
};

/**
 * One code, from one codebook, applied to one phrase by one author.
 *
 * No id of its own: `(phraseId, codingId)` already identifies it, and the store
 * keys on that pair. The composite string it used to carry was the single
 * heaviest field in the whole index — a hundred-odd characters per row, read on
 * every open, referenced by nothing.
 */
export type PhraseCodeRow = {
  phraseId: string;
  /** The `Coding` row this link came from — also the anchor id in the transcript. */
  codingId: string;
  /**
   * Denormalized from the phrase. A filter on "the documents of this study, these
   * speakers, and this code" is otherwise three joins, and IndexedDB has none: an
   * index over the link rows is the only way to answer it in one pass.
   */
  documentId: string;
  projectId: string | null;
  speakerId: string | null;
  codebookId: string;
  codeId: string;
  /** Author of the coding. Two researchers read the same passage differently. */
  userId: string;
  /**
   * The phrase's position in its document, copied here.
   *
   * One number, denormalized so that a query driven by a cursor over THIS store
   * can order its results without reading the phrases. Reading order is what the
   * table shows, and needing the phrase row to know it would mean loading every
   * phrase of the study to display sixty of them.
   */
  offset: number;
};

export type PhraseIndex = {
  phrases: PhraseRow[];
  links: PhraseCodeRow[];
};

/** The half of a `Coding` row this module needs. */
export type CodingRef = {
  id: string;
  codebookId: string;
  codeId: string;
  userId: string;
};

/** A maximal contiguous run of tokens carrying one coding id. */
type Span = {
  codingId: string;
  start: number;
  end: number;
  speakerId: string | null;
  parts: string[];
};

/**
 * Collapse the runs of whitespace a flat projection is full of (each inter-word
 * space is its own token, paragraph breaks are `"\n\n"`) into single spaces, so an
 * excerpt reads as a sentence in a table cell rather than as a transcript.
 */
function normalizeText(parts: string[]): string {
  return parts.join("").replace(/\s+/g, " ").trim();
}

/**
 * Build a document's index from its flat projection and its codings.
 *
 * The projection is the same shape whether it came from the database (the stored
 * transcript) or from the live editor (`docToSegments`), which is what lets one
 * derivation serve both the background sync and the document being coded right now.
 *
 * Spans are grouped by their EXACT range: two codes applied to the same selection
 * make one phrase carrying two codes — one row, two chips — while a code applied to
 * half of another's passage stays its own phrase, because the excerpts genuinely
 * differ. Overlap is real in coding and is not something to average away.
 *
 * Anchors with no `Coding` row (a code retracted elsewhere, a mark left behind by a
 * failed write) contribute nothing, and a phrase left with no code at all is
 * dropped: it would be a row the table could neither label nor filter.
 */
export function buildPhraseIndex({
  documentId,
  projectId = null,
  segments,
  codings,
}: {
  documentId: string;
  projectId?: string | null;
  segments: TranscriptionSegment[] | null | undefined;
  codings: CodingRef[];
}): PhraseIndex {
  const known = new Map(codings.map((c) => [c.id, c]));

  const open = new Map<string, Span>();
  const closed: Span[] = [];
  let offset = 0;

  const closeSpan = (codingId: string) => {
    const span = open.get(codingId);
    if (!span) return;
    open.delete(codingId);
    closed.push(span);
  };

  for (const token of segments ?? []) {
    const ids = token.codings ?? [];
    const present = ids.length > 0 ? new Set(ids) : null;

    // Anything not carried by this token ends here — that is what makes a span a
    // MAXIMAL run, and what keeps two codings of the same code on two passages from
    // merging into one excerpt spanning the text between them.
    for (const codingId of Array.from(open.keys())) {
      if (!present?.has(codingId)) closeSpan(codingId);
    }

    if (present) {
      for (const codingId of present) {
        // Unknown anchors are skipped rather than indexed and filtered later: they
        // are the common residue of a retracted code, and carrying them would make
        // every phrase's id depend on rows that no longer exist.
        if (!known.has(codingId)) continue;
        const existing = open.get(codingId);
        if (existing) {
          existing.end = offset + token.text.length;
          existing.parts.push(token.text);
          existing.speakerId ??=
            token.type === "word" ? (token.speakerId ?? null) : null;
        } else {
          open.set(codingId, {
            codingId,
            start: offset,
            end: offset + token.text.length,
            // A span that opens on spacing takes its speaker from the first WORD it
            // covers: the whitespace between two turns belongs to neither.
            speakerId: token.type === "word" ? (token.speakerId ?? null) : null,
            parts: [token.text],
          });
        }
      }
    }

    offset += token.text.length;
  }
  for (const codingId of Array.from(open.keys())) closeSpan(codingId);

  // Group by exact range. Sorting the ids makes the phrase id independent of the
  // order the codes were applied in.
  const byRange = new Map<string, Span[]>();
  for (const span of closed) {
    const key = `${span.start}:${span.end}`;
    const bucket = byRange.get(key);
    if (bucket) bucket.push(span);
    else byRange.set(key, [span]);
  }

  const phrases: PhraseRow[] = [];
  const links: PhraseCodeRow[] = [];

  for (const spans of byRange.values()) {
    const text = normalizeText(spans[0].parts);
    if (!text) continue; // a passage of pure whitespace codes nothing
    const codingIds = spans.map((s) => s.codingId).sort();
    const id = `${documentId}#${codingIds.join("+")}`;
    const speakerId = spans.find((s) => s.speakerId)?.speakerId ?? null;

    phrases.push({
      id,
      documentId,
      projectId,
      speakerId,
      text,
      offset: spans[0].start,
      codingIds,
    });

    for (const codingId of codingIds) {
      const coding = known.get(codingId);
      if (!coding) continue;
      links.push({
        phraseId: id,
        codingId,
        documentId,
        projectId,
        speakerId,
        codebookId: coding.codebookId,
        codeId: coding.codeId,
        userId: coding.userId,
        offset: spans[0].start,
      });
    }
  }

  phrases.sort((a, b) => a.offset - b.offset);
  return { phrases, links };
}
