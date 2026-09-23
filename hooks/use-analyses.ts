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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGateway } from "./fetch";

export type Analysis = {
  id: string;
  key: string;
  facets: AnalysisFacet[];
  body: string;
  updatedAt: string;
};

/**
 * Every analysis written on a study, held in one place.
 *
 * All of them, not a page: what a group needs is "the note for this slice, and
 * every note narrower than it", which is a containment test over facet sets. No
 * index answers that, and a study holds tens to hundreds of notes — so the whole
 * set is fetched once and intersected in memory, the same trade the local index
 * makes for a very different reason.
 */
export function useAnalyses(projectId: string | null | undefined) {
  return useQuery<Analysis[]>({
    queryKey: ["analyses", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const response = await fetchGateway(
        `/api/analysis?projectId=${encodeURIComponent(projectId!)}`,
      );
      if (!response.ok) throw new Error("Failed to load analyses");
      const data = (await response.json()) as { analyses: Analysis[] };
      return data.analyses;
    },
  });
}

export function useSaveAnalysis(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { facets: AnalysisFacet[]; body: string }) => {
      const response = await fetchGateway("/api/analysis", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...input }),
      });
      if (!response.ok) throw new Error("Failed to save the analysis");
      return (await response.json()) as { analysis: Analysis | null };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analyses", projectId] });
    },
  });
}

/** What one group shows in its analysis column. */
export type GroupAnalysis = {
  /** The facets this group's own note is keyed on. */
  facets: AnalysisFacet[];
  /** The note for exactly this slice, if one has been written. */
  own: Analysis | null;
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
  view: Omit<AnalysisView, "groupKey">,
  groupKeys: readonly string[],
): Map<string, GroupAnalysis> {
  const out = new Map<string, GroupAnalysis>();
  const rows = analyses ?? [];
  for (const groupKey of groupKeys) {
    const facets = facetsOfView({ ...view, groupKey });
    const key = analysisKey(facets);
    const own = rows.find((row) => row.key === key) ?? null;
    const narrower = rows
      .filter((row) => isNarrowerThan(row.facets, facets))
      .map((analysis) => ({
        analysis,
        extra: extraFacets(analysis.facets, facets),
      }))
      .sort((a, b) => a.extra.length - b.extra.length);
    out.set(groupKey, { facets, own, narrower });
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
