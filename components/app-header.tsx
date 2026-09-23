"use client";

import { ExcerptPanelTrigger } from "@/components/codebooks/excerpts/excerpt-panel-trigger";
import { WORKSPACE_ACCENT } from "@/components/transcriptions/editor/phase";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { workspaceAreaOf } from "@/lib/documents/workspace-area";
import { cn } from "@/lib/utils/utils";
import { useDocumentViewPrefs } from "@/hooks/use-document-view-prefs";
import { usePathname } from "next/navigation";

/**
 * Top bar shared by every authenticated route. It always renders the header
 * portals so pages can inject their own title/actions.
 *
 * The sidebar toggle is contextual:
 * - On mobile it is always available (the sidebar is an off-canvas sheet).
 * - On desktop the sidebar is persistent, so the toggle is redundant on the
 *   home/study/new pages and we hide it there. The transcription editor is the
 *   exception — it benefits from collapsing the sidebar for focus, so the toggle
 *   stays visible on desktop for those routes.
 */
export function AppHeader() {
  const pathname = usePathname();
  const isTranscription = pathname?.startsWith("/app/transcription/") ?? false;

  // Which space the app is currently in: writing the transcript, reading it, or
  // (one day) comparing it. A rule under the header rather than a label, because
  // it has to be answerable at a glance without being read.
  // The phase comes from the view preferences rather than the query string: this
  // sits in the layout that wraps every route, and `useSearchParams` there would
  // demand a Suspense boundary around all of them. The document page keeps the
  // preference in step with its URL, so the two agree.
  const { prefs } = useDocumentViewPrefs();
  const area = workspaceAreaOf(pathname, prefs.phase);

  // On desktop, non-transcription routes leave the bar empty (the toggle and the
  // mobile title are hidden, and only the editor injects into the header
  // portals). In that case make the bar invisible — no border, no background —
  // while keeping its height so the content below stays pushed down.
  const emptyOnDesktop = !isTranscription;

  return (
    <header
      className={cn(
        // z-20 keeps the bar (and the audio player/toolbar the transcription
        // editor portals into it) above the scrolling content, which is itself
        // lifted to z-10. Without this they tie at z-10 and the later-in-DOM
        // content paints on top, so the sticky header appears to slide behind it.
        "sticky top-0 z-20 bg-background/50 backdrop-blur-lg",
        emptyOnDesktop && "md:bg-transparent md:backdrop-blur-none",
      )}
    >
      <div
        className={cn(
          "border-b px-4 flex h-14 shrink-0 items-center gap-2 bg-background",
          emptyOnDesktop && "md:border-transparent md:bg-transparent",
        )}
      >
        <SidebarTrigger
          className={cn("-ml-1", !isTranscription && "md:hidden")}
        />
        {/* Default app title on mobile, where the header would otherwise be bare.
            The transcription page fills the header with its own title/actions. */}
        {!isTranscription && (
          <div className="flex items-center gap-2 md:hidden">
            <img src="/logo.svg" alt="" className="h-6 w-6" />
            <span className="font-semibold">humanlogs</span>
          </div>
        )}
        <div
          id="header-actions-portal"
          className="flex-1 flex items-center justify-between"
        />
        {/* The excerpt panel is global, so its toggle lives in the bar every route
            shares rather than in any one page's actions. */}
        <ExcerptPanelTrigger />
      </div>
      <div id="header-sub-portal" className="w-full" />
      {/* The same scale as the sidebar's phase headers, from the same constant, so
          the two cannot drift. Absent off a working space: the home page is not a
          pass over material, and colouring it would make the scale mean nothing. */}
      {area && (
        <div
          aria-hidden
          className={cn("h-[3px] w-full", WORKSPACE_ACCENT[area].rule)}
        />
      )}
    </header>
  );
}
