"use client";

import * as React from "react";
import { RefreshCwIcon, TableIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useBetaFeatures, useUserProfile } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import { codebooksInScopeForProject } from "@/lib/codebooks/codebook";
import { verbatimCodebooks } from "@/lib/codebooks/coding";
import { useLocalIndexSync } from "@/hooks/use-local-index";
import { ExcerptFilters } from "./excerpt-filters";
import { ExcerptList } from "./excerpt-list";
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  useExcerptPanel,
  useExcerptPanelOnPage,
} from "./excerpt-panel-context";
import { useExcerptDocuments } from "./use-excerpt-documents";
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

  // Codebooks are still a beta surface, and an excerpt table with no codebook to
  // read against would be a permanently empty panel. And it belongs on a document,
  // in either phase: everywhere else it was answering a question the page had not
  // asked. Neither the sync nor the read runs while it is not shown.
  const onPage = useExcerptPanelOnPage();
  const live = panel.open && betaFeatures && onPage;

  const projectId = panel.context.projectId;
  // Neither the sync nor the read should cost anything to a researcher who never
  // opens the panel — hence the explicit flag rather than a null scope, which would
  // mean something quite different (the documents filed in no study).
  const sync = useLocalIndexSync(projectId, { enabled: live });
  /** A pass with documents left to fetch — the panel is filling, not empty. */
  const indexing = sync.isFetching && (sync.progress?.total ?? 0) > 0;

  const documents = useExcerptDocuments();

  const query = useExcerptQuery({
    documents,
    codebooks,
    userId: profile?.id,
    enabled: live,
  });

  // The table may change codes only on the interview an editor is lending it, and
  // only through the verbatim codebooks that cover this study.
  const coding = React.useMemo(() => {
    if (!panel.codingDocumentId) return undefined;
    return {
      documentId: panel.codingDocumentId,
      codebooks: verbatimCodebooks(
        codebooksInScopeForProject(codebooks, projectId),
      ),
      toggle: (
        phrase: { documentId: string; codingIds: string[] },
        codebookId: string,
        codeId: string,
      ) => {
        panel.togglePhraseCode({ ...phrase, codebookId, codeId });
      },
    };
  }, [panel, codebooks, projectId]);

  if (!live) return null;

  return (
    <aside
      // Hidden on small screens on purpose: the panel is a second column, and a
      // second column on a phone is a modal that hides the text it is about.
      //
      // `h-svh sticky top-0` is load-bearing, not decoration. The flex row this
      // sits in only sets a MINIMUM height, so without it the column grows to the
      // height of its content: the scroll area inside is then never bounded, never
      // scrolls, and the list never pages in anything past its first screen.
      className="hidden md:flex sticky top-0 h-svh relative shrink-0 flex-col border-l bg-background"
      style={{ width: panel.width }}
      aria-label={t("title")}
    >
      <ResizeHandle />

      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <TableIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("title")}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {query.total}
        </span>
        {/* No close button and no export here. Closing is the toggle in the app's
            top bar, which is where it was opened from; the export lives in the
            document's own download menu, with every other file it produces. */}
      </div>

      <ExcerptFilters documents={documents} codebooks={codebooks} />

      <ScrollArea className="min-h-0 flex-1">
        {query.pending ? (
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
            deepen={query.deepen}
            coding={coding}
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
