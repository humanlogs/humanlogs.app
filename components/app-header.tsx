"use client";

import { NotificationBell } from "@/components/notifications/notification-bell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils/utils";
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
        {/* Notifications are app-wide, so they live outside the page portals. */}
        <NotificationBell />
      </div>
      <div id="header-sub-portal" className="w-full" />
    </header>
  );
}
