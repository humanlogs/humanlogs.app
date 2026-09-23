"use client";

import { useExcerptPanel } from "@/components/codebooks/excerpts/excerpt-panel-context";
import {
  decodeExcerptState,
  excerptStateKey,
  hasExcerptParams,
  writeExcerptParams,
} from "@/lib/codebooks/excerpt-url";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/**
 * Keep the excerpt table's question and the address bar saying the same thing.
 *
 * Two directions, one loop, and the thing that keeps it from spinning is a
 * CANONICAL key: both sides are reduced to the string the URL would carry, and
 * whichever side last matched that string is recorded. The URL then only
 * overwrites the panel when it says something the panel did not write, which is
 * exactly a reload, a back button, or a link somebody sent.
 *
 * Called by the pages that SHOW the table, not by the panel: the panel lives in
 * the layout above every route and has no business owning anyone's URL. The
 * pages already hold `useSearchParams` behind their own Suspense boundary.
 *
 * `router.replace`, not `push`: refining a filter is not a place in history, and
 * six steps of back to undo one exploration would be worse than none. The back
 * button still works across the moves that ARE places — a different document, a
 * different room of the study.
 */
export function useExcerptUrlSync(enabled: boolean): void {
  const panel = useExcerptPanel();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const fromUrl = excerptStateKey(decodeExcerptState(searchParams));
  const fromState = excerptStateKey({
    scope: panel.filter.scope,
    authors: panel.filter.authors,
    search: panel.filter.search,
    codes: panel.filter.codes,
    contextCodes: panel.filter.contextCodes,
    rules: panel.rules,
  });

  /** The last key both sides agreed on — see above. */
  const settled = React.useRef<string | null>(null);

  const setFilter = panel.setFilter;
  const setRules = panel.setRules;
  const keepView = panel.keepView;

  // The URL speaks first: on arrival, and whenever it moves without us.
  React.useEffect(() => {
    if (!enabled) return;
    if (settled.current === fromUrl) return;
    settled.current = fromUrl;

    const decoded = decodeExcerptState(searchParams);
    // A bare link says nothing about the table; leaving it as it was is right.
    if (!hasExcerptParams(searchParams)) return;

    // Arriving on a document normally resets the table to it. Not when the link
    // carried a question: the reader chose THAT, and rebuilding it under them is
    // the opposite of helping.
    keepView();
    setFilter((current) => ({
      ...current,
      ...(decoded.scope !== undefined ? { scope: decoded.scope } : {}),
      ...(decoded.authors !== undefined ? { authors: decoded.authors } : {}),
      ...(decoded.search !== undefined ? { search: decoded.search } : {}),
      ...(decoded.codes !== undefined ? { codes: decoded.codes } : {}),
      ...(decoded.contextCodes !== undefined
        ? { contextCodes: decoded.contextCodes }
        : {}),
    }));
    if (decoded.rules !== undefined) setRules(decoded.rules);
    // `searchParams` is a fresh object every render; `fromUrl` is what changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fromUrl]);

  // Then the panel does, for every change the researcher makes.
  React.useEffect(() => {
    if (!enabled) return;
    if (settled.current === fromState) return;
    settled.current = fromState;

    const next = writeExcerptParams(
      new URLSearchParams(searchParams.toString()),
      {
        scope: panel.filter.scope,
        authors: panel.filter.authors,
        search: panel.filter.search,
        codes: panel.filter.codes,
        contextCodes: panel.filter.contextCodes,
        rules: panel.rules,
      },
    );
    const query = next.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    // Same: the state's key is what changed, not the identity of the params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fromState]);
}
