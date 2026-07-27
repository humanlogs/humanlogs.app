"use client";

import { useEffect } from "react";

const SUFFIX = "HumanLogs";

/**
 * Set the browser tab title from a client component.
 *
 * Most app pages are client components, so they can't export Next `metadata`.
 * Passing `undefined` (data still loading) leaves the title from the nearest
 * layout in place instead of flashing an empty tab.
 */
export function useDocumentTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return;

    const previous = document.title;
    document.title = `${title} · ${SUFFIX}`;

    return () => {
      document.title = previous;
    };
  }, [title]);
}
