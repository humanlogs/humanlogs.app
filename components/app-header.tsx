"use client";

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

  return (
    <header className="sticky top-0 bg-background/50 backdrop-blur-lg z-10">
      <div className="border-b px-4 flex h-14 shrink-0 items-center gap-2 bg-background">
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
      </div>
      <div id="header-sub-portal" className="w-full" />
    </header>
  );
}
