"use client";

import type { WorkspaceArea } from "@/components/transcriptions/editor/phase";
import { useDocumentViewPrefs } from "@/hooks/use-document-view-prefs";
import { endCodingSession } from "@/lib/documents/coding-session";
import * as React from "react";

/**
 * Say which space of the work this page is, and keep the sidebar in step with it.
 *
 * Every route declares its own space, and nothing else writes the preference. A
 * link from a colleague, the browser's back button, and the switch in the header
 * all end up on a route, so the route is the only thing that always knows.
 *
 * It is also the only arrangement that survives navigation. Setting the
 * preference from the click that LEAVES a page is a race: the page being left
 * re-renders first, sees the preference disagree with its own URL and puts it
 * back — so the sidebar arrived on the analysis page still showing editing open.
 */
export function useDeclareWorkspaceArea(area: WorkspaceArea): void {
  const { prefs, update } = useDocumentViewPrefs();
  React.useEffect(() => {
    if (prefs.phase !== area) update({ phase: area });
  }, [area, prefs.phase, update]);

  // Leaving the coding space ends the pass, so the next interview opened for
  // coding asks which grille again. Here because this is the one hook every
  // route calls — see `lib/documents/coding-session.ts`.
  React.useEffect(() => {
    if (area !== "coding") endCodingSession();
  }, [area]);
}
