"use client";

import * as React from "react";
import { PanelRightCloseIcon, RefreshCwIcon, TableIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useBetaFeatures, useUserProfile } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import { useLocalIndexSync, useStudyPhrases } from "@/hooks/use-local-index";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import { ExcerptFilters, type ExcerptDocument } from "./excerpt-filters";
import { ExcerptList } from "./excerpt-list";
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  useExcerptPanel,
} from "./excerpt-panel-context";
import { useExcerptQuery } from "./use-excerpt-query";

/**
 * The excerpt panel: every coded passage the current filter keeps, grouped the way
 * the researcher asked for, permanently available on the right of the app.
 *
 * It reads the LOCAL index (hooks/use-local-index.ts), never the server, which is
 * what lets it stay open while a study of a thousand interviews is browsed and what
 * lets it work at all on an end-to-end encrypted corpus. The sync that keeps that
 * index current runs behind it and is only ever visible as the line at the bottom.
 *
 * This file is the shell: what is open, how wide, and what is being loaded. The
 * query lives in use-excerpt-query.ts and the rows in excerpt-list.tsx.
 */
export function ExcerptPanel() {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const betaFeatures = useBetaFeatures();
  const { data: profile } = useUserProfile();
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcriptions = [] } = useTranscriptions();

  // Codebooks are still a beta surface, and an excerpt table with no codebook to
  // read against would be a permanently empty panel.
  const live = panel.open && betaFeatures;

  const projectId = panel.context.projectId;
  // Neither the sync nor the read should cost anything to a researcher who never
  // opens the panel — hence the explicit flag rather than a null scope, which would
  // mean something quite different (the documents filed in no study).
  const sync = useLocalIndexSync(projectId, { enabled: live });
  const { data: index, isPending } = useStudyPhrases(projectId, {
    enabled: live,
  });
  /** A pass with documents left to fetch — the panel is filling, not empty. */
  const indexing = sync.isFetching && (sync.progress?.total ?? 0) > 0;

  const documents = React.useMemo<ExcerptDocument[]>(
    () =>
      transcriptions.map((doc) => ({
        id: doc.id,
        title: doc.title,
        projectId: doc.projectId ?? null,
        codes: doc.codes ?? [],
        speakerCodes: doc.speakerCodes ?? [],
        speakers: doc.speakers ?? [],
        speakerCount: doc.speakerCount ?? 0,
      })),
    [transcriptions],
  );

  const query = useExcerptQuery({
    index,
    documents,
    codebooks,
    userId: profile?.id,
  });

  if (!live) return null;

  return (
    <aside
      // Hidden on small screens on purpose: the panel is a second column, and a
      // second column on a phone is a modal that hides the text it is about.
      className="hidden md:flex relative shrink-0 flex-col border-l bg-background"
      style={{ width: panel.width }}
      aria-label={t("title")}
    >
      <ResizeHandle />

      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <TableIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("title")}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {query.phrases.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          onClick={() => panel.setOpen(false)}
          aria-label={t("close")}
        >
          <PanelRightCloseIcon className="size-4" />
        </Button>
      </div>

      <ExcerptFilters documents={documents} codebooks={codebooks} />

      <ScrollArea className="min-h-0 flex-1">
        {isPending && !index ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : query.groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {/* "Nothing matches" and "nothing here yet" are different answers, and
                a study being indexed for the first time is the second one. Saying
                the first would be telling a researcher their corpus is uncoded
                while we are still reading it. */}
            {indexing ? t("indexingEmpty") : t("empty")}
          </p>
        ) : (
          <ExcerptList
            groups={query.groups}
            labels={query.labels}
            codesByPhrase={query.codesByPhrase}
          />
        )}
      </ScrollArea>

      <SyncFooter
        pending={sync.isFetching}
        total={sync.progress?.total ?? 0}
        done={sync.progress?.done ?? 0}
        failed={sync.progress?.failed ?? sync.data?.failed ?? 0}
      />
    </aside>
  );
}

/**
 * How much of the study the table is actually showing.
 *
 * Silent while everything is in hand, which is the normal state: the sync's whole
 * point is that it usually has nothing to do. It speaks up while a study is being
 * indexed for the first time, and when documents could not be read — a study half
 * indexed without saying so is worse than one that admits it.
 */
function SyncFooter({
  pending,
  total,
  done,
  failed,
}: {
  pending: boolean;
  total: number;
  done: number;
  failed: number;
}) {
  const t = useTranslations("codebook.excerpts");
  if (!pending && failed === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
      {pending && <RefreshCwIcon className="size-3 animate-spin" />}
      <span>
        {pending
          ? t("syncing", { done, total })
          : t("syncFailed", { count: failed })}
      </span>
    </div>
  );
}

/** Drag the panel's edge. The width is persisted, so it survives the next session. */
function ResizeHandle() {
  const panel = useExcerptPanel();
  const dragging = React.useRef(false);
  const setWidth = panel.setWidth;

  React.useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(window.innerWidth - event.clientX);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [setWidth]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={panel.width}
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={MAX_PANEL_WIDTH}
      onPointerDown={() => {
        dragging.current = true;
        // Without this the drag selects the transcript it is dragging across.
        document.body.style.userSelect = "none";
      }}
      className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-primary/20"
    />
  );
}
