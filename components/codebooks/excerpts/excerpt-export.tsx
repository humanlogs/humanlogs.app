"use client";

import * as React from "react";
import {
  DownloadIcon,
  FileTextIcon,
  Loader2Icon,
  TagsIcon,
} from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { useBetaFeatures, useProjects, useUserProfile } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  EXCERPT_EXPORT_FORMATS,
  type ExcerptExportFormat,
} from "@/lib/codebooks/excerpt-export";
import { useExcerptDocuments } from "./use-excerpt-documents";
import { useExcerptExport } from "./use-excerpt-export";
import { useExcerptPanel } from "./excerpt-panel-context";
import { useExcerptRequest } from "./use-excerpt-query";

/**
 * "Download as, Excerpts, PDF / Word / CSV", inside the document's own menu.
 *
 * It sits there rather than on the excerpt panel because that is where every other
 * export of this document already lives, and because a researcher looking for a
 * file looks in one place. It does not need the panel open: the question is built
 * from the panel's filter state and the document list ({@link useExcerptRequest}),
 * and only running it costs anything.
 *
 * What comes out is a Thème / Phrases / Analyse table of the passages the current
 * filter keeps, always grouped by code. See `lib/codebooks/excerpt-export.ts`.
 */
/**
 * Assembling the export: the question, the labels, the file's name.
 *
 * A hook rather than a component so the two places that offer the export (the
 * document's download menu and the excerpt panel's own shortcut) share every line
 * of it and can differ only in their chrome.
 */
function useExport() {
  const t = useTranslations("codebook.excerpts");
  const betaFeatures = useBetaFeatures();
  const { data: profile } = useUserProfile();
  const { data: codebooks = [] } = useCodebooks();
  const { data: projects = [] } = useProjects();
  const documents = useExcerptDocuments();
  const panel = useExcerptPanel();

  const { request, labels } = useExcerptRequest({
    documents,
    codebooks,
    userId: profile?.id,
  });

  // The narrowest true name wins: scoped to one interview it names itself, a study
  // names the study, and the loose documents of no study fall back to the panel's
  // own title.
  const scoped =
    panel.filter.scope === "document" && panel.context.documentId
      ? documents.find((doc) => doc.id === panel.context.documentId)
      : undefined;
  const study = projects.find(
    (project) => project.id === panel.context.projectId,
  );
  const title = scoped?.title || study?.name || t("title");

  const { run, progress, error } = useExcerptExport({
    request,
    labels,
    title,
    caption: [title, new Date().toLocaleDateString()].join(" · "),
    enabled: betaFeatures,
  });

  // Codebooks are a beta surface, and there is nothing to excerpt without one.
  // Reported rather than returned early: a hook cannot bail before its own hooks
  // have run, so the callers decide whether to render.
  return { run, progress, error, available: betaFeatures };
}

/**
 * The three formats, the caveat, and the progress. Identical wherever the export
 * is offered from, which is the point of it being a component.
 */
function ExcerptExportItems({
  run,
  progress,
  error,
}: ReturnType<typeof useExport>) {
  const t = useTranslations("codebook.excerpts");
  return (
    <>
      {EXCERPT_EXPORT_FORMATS.map((format) => (
        <DropdownMenuItem
          key={format}
          onClick={() => void run(format as ExcerptExportFormat)}
        >
          <FileTextIcon className="mr-2 h-4 w-4" />
          {t(`export.format.${format}`)}
        </DropdownMenuItem>
      ))}
      <p className="border-t px-2 pb-1 pt-1.5 text-[11px] leading-snug text-muted-foreground">
        {/* Said before the click: the export re-asks the panel's question grouped
            by code, because the first column of a thematic table is a theme. */}
        {t("export.hintShort")}
      </p>
      {progress !== null && progress.total > 0 && (
        <p className="px-2 pb-1 text-[11px] text-muted-foreground">
          {t("export.running", { done: progress.done, total: progress.total })}
        </p>
      )}
      {error && (
        <p className="px-2 pb-1 text-[11px] text-destructive">
          {t("export.failed")}
        </p>
      )}
    </>
  );
}

/**
 * In the document's own download menu, under "Download as".
 *
 * Labelled "Coding" rather than "Export the table": next to TXT, Word and the
 * subtitle formats, the thing being chosen is WHICH MATERIAL, not which file. The
 * table is what coding produces.
 */
export function ExcerptExportSubmenu() {
  const t = useTranslations("codebook.excerpts");
  const state = useExport();
  if (!state.available) return null;

  return (
    <DropdownMenuSub
      trigger={
        <>
          {state.progress ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <TagsIcon className="mr-2 h-4 w-4" />
          )}
          {t("export.menuLabel")}
        </>
      }
    >
      <ExcerptExportItems {...state} />
    </DropdownMenuSub>
  );
}

/**
 * The same export, one click away on the panel that shows the table.
 *
 * A shortcut, not a second implementation: someone reading the table and deciding
 * to take it away should not have to go and find the document's menu.
 */
export function ExcerptExportButton({ disabled }: { disabled?: boolean }) {
  const t = useTranslations("codebook.excerpts");
  const state = useExport();
  if (!state.available) return null;

  return (
    <DropdownMenu
      align="end"
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={disabled || state.progress !== null}
          aria-label={t("export.label")}
          title={t("export.label")}
        >
          {state.progress ? (
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
      <ExcerptExportItems {...state} />
    </DropdownMenu>
  );
}
