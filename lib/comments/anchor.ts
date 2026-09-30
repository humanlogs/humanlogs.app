/**
 * What a note is attached to.
 *
 * A comment and an analysis turned out to be the same act at two scales: a
 * researcher saying what they make of something. The first was anchored to a
 * passage, the second to a slice of the corpus — a difference in what the anchor
 * NAMES, not in what the row is. So there is one kind of row, and this module is
 * the vocabulary of its keys.
 *
 * Two kinds today, and the shape is meant to take more:
 *
 * - `passage` — `anchorId` is the `commentId` of a `comment` mark in a transcript.
 *   The range moves with the text through the CRDT, is versioned with the
 *   document, and survives a reseed. This is the original kind and nothing about
 *   it changed.
 *
 * - `slice` — `anchorId` is the canonical facet key of a question the excerpt
 *   table was asked: the group crossed with the filters
 *   (`lib/analysis/analysis-facets.ts`). Not about any one interview, so the note
 *   hangs off the STUDY instead.
 *
 * The consequence of them being one table is that everything the comment side
 * already had comes to the analysis side for free: end-to-end encryption of the
 * body (the separate `Analysis` table stored it in clear), threads, so a
 * colleague can answer a reading rather than write a second one beside it, and
 * one API, one query, one decryption path.
 */

import { analysisKey, type AnalysisFacet } from "@/lib/analysis/analysis-facets";

export const ANCHOR_TYPES = ["passage", "slice"] as const;

export type AnchorType = (typeof ANCHOR_TYPES)[number];

export function isAnchorType(value: unknown): value is AnchorType {
  return (
    typeof value === "string" && (ANCHOR_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Where a note lives, as one value.
 *
 * A passage note names an interview; a slice note names a study and the facets
 * that make up its question. Both always carry an `anchorId`, which is what a
 * thread is keyed on.
 */
export type NoteAnchor =
  | { type: "passage"; transcriptionId: string; anchorId: string }
  | {
      type: "slice";
      projectId: string;
      anchorId: string;
      facets: AnalysisFacet[];
    };

/** The thread key of a slice: the canonical facet key, and nothing else. */
export function sliceAnchorId(facets: readonly AnalysisFacet[]): string {
  return analysisKey(facets);
}

/**
 * A slice anchor from a study and a set of facets.
 *
 * The facets are stored canonically AND separately from the key, because the two
 * are read for different things: the key identifies the thread, the list answers
 * "is this note narrower than the slice on screen", which is a containment test
 * over sets that no key comparison can do.
 */
export function sliceAnchor(
  projectId: string,
  facets: readonly AnalysisFacet[],
): Extract<NoteAnchor, { type: "slice" }> {
  const canonical = Array.from(new Set(facets)).sort();
  return {
    type: "slice",
    projectId,
    anchorId: analysisKey(canonical),
    facets: canonical,
  };
}

export function passageAnchor(
  transcriptionId: string,
  anchorId: string,
): Extract<NoteAnchor, { type: "passage" }> {
  return { type: "passage", transcriptionId, anchorId };
}

/** The row's columns, from an anchor — what the API writes. */
export function anchorColumns(anchor: NoteAnchor): {
  anchorType: AnchorType;
  anchorId: string;
  transcriptionId: string | null;
  projectId: string | null;
  facets: AnalysisFacet[] | null;
} {
  return anchor.type === "passage"
    ? {
        anchorType: "passage",
        anchorId: anchor.anchorId,
        transcriptionId: anchor.transcriptionId,
        projectId: null,
        facets: null,
      }
    : {
        anchorType: "slice",
        anchorId: anchor.anchorId,
        transcriptionId: null,
        projectId: anchor.projectId,
        facets: anchor.facets,
      };
}

/**
 * The anchor a stored row stands for, or null when it stands for nothing this
 * build understands.
 *
 * Null rather than a throw, and rather than a guess: a row written by a newer
 * build with a third kind of key must be skipped by an older reader, not
 * rendered as a passage note pointing at a mark that does not exist.
 */
export function anchorOf(row: {
  anchorType?: string | null;
  anchorId: string;
  transcriptionId?: string | null;
  projectId?: string | null;
  facets?: unknown;
}): NoteAnchor | null {
  // Absent means the original kind: every row written before there was a second.
  const type = row.anchorType ?? "passage";
  if (type === "passage") {
    return row.transcriptionId
      ? passageAnchor(row.transcriptionId, row.anchorId)
      : null;
  }
  if (type === "slice") {
    if (!row.projectId) return null;
    const facets = Array.isArray(row.facets)
      ? (row.facets as unknown[]).filter(
          (facet): facet is string => typeof facet === "string",
        )
      : [];
    return {
      type: "slice",
      projectId: row.projectId,
      anchorId: row.anchorId,
      facets,
    };
  }
  return null;
}
