"use client";

import {
  analysisKey,
  covers,
  extraFacets,
  facetsOfView,
  isNarrowerThan,
  type AnalysisFacet,
  type AnalysisView,
} from "@/lib/analysis/analysis-facets";
import { sliceAnchorId } from "@/lib/comments/anchor";
import {
  useDeleteSliceNote,
  useSaveSliceNote,
  useStudyComments,
  type StudyComment,
} from "./use-comments";

/**
 * The written analyses of a study — which are comments, anchored to a slice.
 *
 * There used to be a table of their own for this. There is not any more: a
 * comment and an analysis are the same act at two scales, and the only thing that
 * differed was what the anchor named (`lib/comments/anchor.ts`). Folding them
 * gave the analysis side end-to-end encryption, threads, and one query — this
 * module is what is left of the analysis side, which is the wider/narrower rule
 * and nothing else.
 *
 * All of a study's notes come back in one request: "every note narrower than this
 * slice" is a containment test over facet sets, which no index answers, and a
 * study holds tens to hundreds of them.
 */

export type Analysis = {
  id: string;
  key: string;
  facets: AnalysisFacet[];
  body: string;
  updatedAt: string;
  /** Whose reading it is. Null on a note whose author was deleted. */
  author: string | null;
  userId: string;
};

/** A study's slice notes, out of the same fetch the passage comments come from. */
export function sliceNotesOf(comments: StudyComment[] | undefined): Analysis[] {
  const out: Analysis[] = [];
  for (const note of comments ?? []) {
    if (note.anchorType !== "slice") continue;
    out.push({
      id: note.id,
      key: note.anchorId,
      facets: note.facets ?? [],
      body: note.text,
      updatedAt: note.updatedAt,
      author: note.author?.name || note.author?.email || null,
      userId: note.userId,
    });
  }
  return out;
}

/** What one group shows in its analysis column. */
export type GroupAnalysis = {
  /** The facets this group's own note is keyed on. */
  facets: AnalysisFacet[];
  /** The current reader's note on exactly this slice, if they wrote one. */
  own: Analysis | null;
  /**
   * Notes by OTHER people on exactly this slice.
   *
   * New with the merge, and the reason it was worth doing: a slice is a thread
   * now, so two researchers reading the same question see each other rather than
   * each writing into a box that only they can see.
   */
  others: Analysis[];
  /**
   * Notes written about narrower slices of the same material — the answer to
   * "show me everything grouped by code, having earlier written per speaker".
   * Each carries the facets that make it narrower.
   */
  narrower: Array<{ analysis: Analysis; extra: AnalysisFacet[] }>;
};

/**
 * Resolve the analyses for a set of groups, in one pass over the study's notes.
 *
 * The wider/narrower rule lives in `analysis-facets.ts` and is tested there; this
 * only applies it per group. Sorted shortest-first so the closest slices come
 * before the most specific ones.
 */
export function useGroupAnalyses(
  analyses: Analysis[] | undefined,
  view: Omit<AnalysisView, "groupFacets">,
  groups: ReadonlyArray<{ key: string; facets: readonly string[] }>,
  /** Whose notes go in the editable box rather than beside it. */
  userId: string | undefined,
): Map<string, GroupAnalysis> {
  const out = new Map<string, GroupAnalysis>();
  const rows = analyses ?? [];
  for (const { key: groupKey, facets: groupFacets } of groups) {
    const facets = facetsOfView({ ...view, groupFacets });
    const key = analysisKey(facets);
    const here = rows.filter((row) => row.key === key);
    const narrower = rows
      .filter((row) => isNarrowerThan(row.facets, facets))
      .map((analysis) => ({
        analysis,
        extra: extraFacets(analysis.facets, facets),
      }))
      .sort((a, b) => a.extra.length - b.extra.length);
    out.set(groupKey, {
      facets,
      own: here.find((row) => row.userId === userId) ?? null,
      others: here.filter((row) => row.userId !== userId),
      narrower,
    });
  }
  return out;
}

/** Whether a note applies to the slice on screen at all — used by the export. */
export function analysisApplies(
  analysis: Analysis,
  facets: readonly AnalysisFacet[],
): boolean {
  return covers(analysis.facets, facets);
}

export {
  sliceAnchorId,
  useDeleteSliceNote,
  useSaveSliceNote,
  useStudyComments,
};
