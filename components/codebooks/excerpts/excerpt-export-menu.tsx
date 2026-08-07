"use client";

import * as React from "react";
import { DownloadIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import {
  EXCERPT_EXPORT_FORMATS,
  type ExcerptExportFormat,
} from "@/lib/codebooks/excerpt-export";
import type { StudyQuery } from "@/lib/local/query-store.browser";
import { cn } from "@/lib/utils/utils";
import { EXPORT_PER_GROUP, useExcerptExport } from "./use-excerpt-export";
import type { ExcerptLabels } from "./use-excerpt-query";

/**
 * Take the table away: PDF, Word, CSV.
 *
 * The three columns are fixed — Thème, Phrases, Analyse — and the third is empty on
 * purpose. The table holds the evidence; the analysis is written by the person, in
 * the file, afterwards.
 *
 * The menu says out loud that the export is **grouped by code** whatever the panel
 * is grouped by, and how many passages the file will hold. Both are things you want
 * to know before the download, not after opening it.
 */
export function ExcerptExportMenu({
  request,
  labels,
  title,
  caption,
  total,
  disabled,
}: {
  request: Omit<StudyQuery, "signal">;
  labels: ExcerptLabels;
  title: string;
  caption?: string;
  /** Passages the current filter matches, for the "what will be in it" line. */
  total: number;
  disabled: boolean;
}) {
  const t = useTranslations("codebook.excerpts");
  const { run, progress, error } = useExcerptExport({
    request,
    labels,
    title,
    caption,
    enabled: !disabled,
  });

  const busy = progress !== null;

  return (
    <DropdownMenu
      align="end"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={disabled || busy}
          aria-label={t("export.label")}
        >
          {busy ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <DownloadIcon className="size-4" />
          )}
        </Button>
      }
    >
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
        {t("export.label")}
      </div>
      {EXCERPT_EXPORT_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          disabled={busy}
          onClick={() => void run(format as ExcerptExportFormat)}
          className={cn(
            "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
            busy && "opacity-50",
          )}
        >
          {t(`export.format.${format}`)}
        </button>
      ))}
      <p className="border-t px-2 pb-1 pt-1.5 text-[11px] leading-snug text-muted-foreground">
        {/* Said before the click: the export re-asks the question grouped by code,
            because the first column of a Thème/Phrases/Analyse table is a theme. */}
        {t("export.hint", { count: total })}
        {total > EXPORT_PER_GROUP && (
          <>
            {" "}
            <span className="text-amber-600 dark:text-amber-500">
              {t("export.capped", { count: EXPORT_PER_GROUP })}
            </span>
          </>
        )}
      </p>
      {progress !== null && progress.total > 0 && (
        <p className="px-2 pb-1 text-[11px] text-muted-foreground">
          {t("export.running", {
            done: progress.done,
            total: progress.total,
          })}
        </p>
      )}
      {error && (
        <p className="px-2 pb-1 text-[11px] text-destructive">
          {t("export.failed")}
        </p>
      )}
    </DropdownMenu>
  );
}
