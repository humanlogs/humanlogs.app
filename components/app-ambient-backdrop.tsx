"use client";

import { usePathname } from "next/navigation";
import { AmbientBackground } from "@/components/ui/ambient-background";

/**
 * Fixed warm ambient backdrop behind the main content area. Regular pages paint
 * an opaque `--background` that fades out over its final 500px (see `.route-fade`
 * in globals.css), dissolving into this backdrop as you reach the end of the
 * content. It sits inside the (overflow-hidden) `<main>` as an absolute layer, so
 * it stays put while the content scrolls and never adds scroll height.
 *
 * Hidden on the transcription editor, which owns the full viewport and keeps its
 * own opaque background.
 */
export function AppAmbientBackdrop() {
  const pathname = usePathname();
  const isTranscription = pathname?.startsWith("/app/transcription/") ?? false;
  if (isTranscription) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <AmbientBackground variant="warm" />
    </div>
  );
}
