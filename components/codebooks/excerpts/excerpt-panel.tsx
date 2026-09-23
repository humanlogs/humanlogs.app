"use client";

import * as React from "react";
import { MaximizeIcon, TableIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EXCERPT_PARAMS } from "@/lib/codebooks/excerpt-url";
import { useTranslations } from "@/components/locale-provider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBetaFeatures } from "@/hooks/use-api";
import { ExcerptExportButton } from "./excerpt-export";
import {
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  useExcerptPanel,
  useExcerptPanelOnPage,
} from "./excerpt-panel-context";
import { useExcerptTable } from "./use-excerpt-table";

/**
 * The excerpt table as a column beside a transcript.
 *
 * One of the table's two homes; the other is the study's coding workshop, where it
 * is the full width of the page. Both are `useExcerptTable`, and this file is only
 * the frame: how wide, whether it is shown, and where it sits.
 *
 * It reads the LOCAL index (hooks/use-local-index.ts), never the server, which is
 * what lets it stay open while a study of a thousand interviews is browsed and what
 * lets it work at all on an end-to-end encrypted corpus.
 */
export function ExcerptPanel() {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const betaFeatures = useBetaFeatures();

  // Codebooks are still a beta surface, and an excerpt table with no codebook to
  // read against would be a permanently empty panel. And it belongs on a document,
  // in either phase: everywhere else it was answering a question the page had not
  // asked. Neither the sync nor the read runs while it is not shown.
  const onPage = useExcerptPanelOnPage();
  const live = panel.open && betaFeatures && onPage;

  const table = useExcerptTable({ enabled: live });

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
          {table.total}
        </span>
        <span className="ml-auto" />
        {/* The same table, the width of the page. The question travels in the
            URL, so expanding keeps the filters and the grouping exactly as they
            are — that is the whole point of the button rather than a link to a
            blank analysis. */}
        <ExpandToAnalysis />
        {/* No close button: the toggle in the app's top bar is where this was
            opened from and is where it closes. The export is here as a SHORTCUT
            from the table it exports, and lives in full in the document's own
            download menu, with every other file it produces. */}
        <ExcerptExportButton disabled={table.total === 0} />
      </div>

      <ScrollArea className="min-h-0 flex-1">{table.node}</ScrollArea>

      {table.footer}
    </aside>
  );
}

/**
 * Open the same question on the analysis page, full width.
 *
 * Only with a study to open it on: analysis is a room of a study and a document
 * filed under none has no corpus to be analysed against. The panel's state is
 * global, so nothing is passed — but the URL carries it too, and passing it
 * explicitly is what makes the back button and a reload land here as well.
 */
function ExpandToAnalysis() {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const searchParams = useSearchParams();
  const projectId = panel.context.projectId;
  if (!projectId) return null;

  const query = new URLSearchParams();
  for (const key of EXCERPT_PARAMS) {
    const value = searchParams.get(key);
    if (value !== null) query.set(key, value);
  }
  if (panel.context.documentId) query.set("document", panel.context.documentId);
  const suffix = query.toString();

  return (
    <Link
      href={`/app/project/${projectId}/analysis${suffix ? `?${suffix}` : ""}`}
      aria-label={t("expand")}
      title={t("expand")}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <MaximizeIcon className="size-4" />
    </Link>
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
