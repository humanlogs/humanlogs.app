"use client";

import * as React from "react";
import { useTranslations } from "@/components/locale-provider";
import type { Analysis } from "@/hooks/use-analyses";
import {
  analysisKey,
  extraFacets,
  facetsOfView,
  isNarrowerThan,
  type AnalysisView,
} from "@/lib/analysis/analysis-facets";
import { useUserProfile } from "@/hooks/use-api";
import {
  downloadBlob,
  excerptTableBlob,
  exportFileName,
  formatTimecode,
  type ExcerptExportFormat,
  type ExcerptTable,
  type ExcerptTableRow,
} from "@/lib/codebooks/excerpt-export";
import {
  queryStudy,
  readPhraseRows,
  type StudyQuery,
} from "@/lib/local/query-store.browser";
import type { ExcerptLabels } from "./use-excerpt-query";

/**
 * Turning what the panel is showing into a file.
 *
 * **Always grouped by code**, whatever the panel is grouped by, because a
 * Thème / Phrases / Analyse table is a thematic table by definition — the first
 * column is a theme or the document is something else. Everything the researcher
 * *filtered* is respected; only the grouping is fixed.
 *
 * **It is not an export of what is on screen.** The panel keeps a few pages of each
 * group and counts the rest, which is what makes it fast; exporting that would
 * silently drop most of a large theme. So this runs its own pass, deeper
 * ({@link EXPORT_PER_GROUP}), and fetches the passages in chunks. Deeper is still
 * bounded: the dialog shows how many passages the file will hold against how many
 * matched, so a truncation is visible BEFORE the download rather than discovered in
 * the file.
 */

/**
 * Passages kept per theme.
 *
 * A theme with more than two thousand supporting quotes is not a table anyone reads;
 * it is a signal that the filter is too wide. Large enough that no real thematic
 * table hits it, small enough that the export cannot materialise a corpus.
 */
export const EXPORT_PER_GROUP = 2000;

/** Passages fetched per transaction. Bounded for the same reason the walk is. */
const HYDRATE_CHUNK = 250;

export type ExcerptExportProgress = {
  format: ExcerptExportFormat;
  done: number;
  total: number;
};

export function useExcerptExport({
  request,
  labels,
  title,
  caption,
  enabled,
  analyses,
  analysisView,
}: {
  /** The panel's question. Its grouping is replaced; its filter is kept. */
  request: Omit<StudyQuery, "signal">;
  labels: ExcerptLabels;
  title: string;
  caption?: string;
  enabled: boolean;
  /**
   * Every analysis written on this study. Resolved per theme below rather than
   * ahead of time, because the export regroups by code and only then knows which
   * themes there are.
   */
  analyses?: Analysis[];
  /** The filter half of the slice — see `lib/analysis/analysis-facets.ts`. */
  analysisView?: Omit<AnalysisView, "groupKey">;
}) {
  const t = useTranslations("codebook.excerpts");
  const { data: profile } = useUserProfile();
  const userId = profile?.id;
  const [progress, setProgress] = React.useState<ExcerptExportProgress | null>(
    null,
  );
  const [error, setError] = React.useState(false);

  const run = React.useCallback(
    async (format: ExcerptExportFormat) => {
      if (!userId || !enabled) return;
      setError(false);
      setProgress({ format, done: 0, total: 0 });
      try {
        const result = await queryStudy(userId, {
          ...request,
          groupBy: "code",
          perGroup: EXPORT_PER_GROUP,
        });

        // Deduplicated: a passage read as two things belongs to two themes and is
        // quoted under both, but it is one row to fetch.
        const ids: string[] = [];
        const seen = new Set<string>();
        for (const group of result.groups) {
          for (const ref of group.refs) {
            if (seen.has(ref.id)) continue;
            seen.add(ref.id);
            ids.push(ref.id);
          }
        }
        setProgress({ format, done: 0, total: ids.length });

        const texts = new Map<
          string,
          {
            text: string;
            documentId: string;
            speakerId: string | null;
            startTime?: number;
          }
        >();
        for (let i = 0; i < ids.length; i += HYDRATE_CHUNK) {
          const chunk = ids.slice(i, i + HYDRATE_CHUNK);
          const { rows } = await readPhraseRows(userId, chunk);
          for (const [id, row] of rows) {
            texts.set(id, {
              text: row.text,
              documentId: row.documentId,
              speakerId: row.speakerId,
              startTime: row.startTime,
            });
          }
          setProgress({
            format,
            done: Math.min(i + HYDRATE_CHUNK, ids.length),
            total: ids.length,
          });
        }

        const rows: ExcerptTableRow[] = result.groups.map((group) => ({
          theme:
            group.label.type === "code"
              ? labels.codeLabel(group.label).label
              : t("groupBy.none"),
          analysis: analysisFor(
            analyses,
            analysisView,
            group.key,
            labels.facetLabel,
          ),
          passages: group.refs.flatMap((ref) => {
            const row = texts.get(ref.id);
            // A passage the store no longer has is dropped rather than exported
            // as an empty quote — the index was rebuilt while the pass ran.
            if (!row) return [];
            return [
              {
                text: row.text,
                speaker: labels.speakerName(row.documentId, row.speakerId),
                document: labels.documentTitle(row.documentId),
                // A quote is checkable only if the reader can get back to the
                // tape; absent on a transcript that was never aligned.
                ...(row.startTime !== undefined
                  ? { timecode: formatTimecode(row.startTime) }
                  : {}),
              },
            ];
          }),
        }));

        const table: ExcerptTable = {
          title,
          caption,
          columns: [
            t("export.theme"),
            t("export.passages"),
            t("export.analysis"),
          ],
          rows,
        };
        downloadBlob(
          await excerptTableBlob(table, format),
          exportFileName(title, format),
        );
      } catch (cause) {
        console.warn("[excerpts] export failed", cause);
        setError(true);
      } finally {
        setProgress(null);
      }
    },
    [userId, enabled, request, labels, title, caption, t],
  );

  return { run, progress, error };
}

/**
 * The analysis column of one theme, as text.
 *
 * The note written about exactly this slice, then the narrower ones under it,
 * each prefixed by what makes it narrower. A file that left the tool holding only
 * the widest note would drop the most specific work in the study — and it is
 * precisely the specific notes a reader wants next to the quotes.
 */
function analysisFor(
  analyses: Analysis[] | undefined,
  view: Omit<AnalysisView, "groupKey"> | undefined,
  groupKey: string,
  describe: (facet: string) => string,
): string | undefined {
  if (!analyses?.length) return undefined;
  const facets = facetsOfView({ ...(view ?? {}), groupKey });
  const own = analyses.find((note) => note.key === analysisKey(facets));
  const narrower = analyses
    .filter((note) => isNarrowerThan(note.facets, facets))
    .map((note) => ({ note, extra: extraFacets(note.facets, facets) }))
    .sort((a, b) => a.extra.length - b.extra.length);

  const parts: string[] = [];
  if (own) parts.push(own.body);
  for (const { note, extra } of narrower) {
    parts.push(`${extra.map(describe).join(" · ")} — ${note.body}`);
  }
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}
