"use client";

import * as React from "react";
import type { CodeRef } from "@/lib/codebooks/codebook";
import {
  DEFAULT_PHRASE_GROUP_BY,
  type PhraseGroupBy,
} from "@/lib/local/phrase-query";

/**
 * The excerpt panel's state, and the thread between it and the editor.
 *
 * The panel is GLOBAL: one instance, docked to the right of the whole app, alive
 * across navigation. That is deliberate — the question it answers ("everything coded
 * «violence» in this study") is not a property of the page you happen to be on, and
 * a researcher who opens a second interview to check a passage should not lose the
 * table they were reading it against.
 *
 * Being global means the pages have to tell it where they are, which is what
 * {@link useExcerptPanelContext} is for: the editor announces the document it has
 * open and the codebook being used, and the panel adopts the defaults that follow
 * from that — this document, grouped by the codes of that codebook — unless the
 * researcher has since said otherwise.
 *
 * The other half is the **focus bus**. Coding is a two-handed activity: you select a
 * passage on the left and want the row on the right, or you read a row on the right
 * and want the passage on the left. Rather than wire the editor to the table (they
 * are on opposite sides of the route tree), each side publishes what it focused and
 * subscribes to the other's. `source` is what keeps that from looping: a side never
 * scrolls itself in response to its own event.
 */

export type ExcerptScope = "document" | "study";

export type ExcerptAuthors = "mine" | "everyone";

export type ExcerptFilterState = {
  /** Whether the table is showing the open document or the whole study. */
  scope: ExcerptScope;
  /**
   * Speaker-codebook codes narrowing WHICH documents and speakers count — the
   * "documents coded «hôpital», speakers coded «cadre»" half of the question,
   * resolved from the document list before the index is touched.
   */
  contextCodes: CodeRef[];
  /** Verbatim codes the passages must carry. */
  codes: CodeRef[];
  authors: ExcerptAuthors;
  search: string;
};

export const EMPTY_FILTER: ExcerptFilterState = {
  scope: "study",
  contextCodes: [],
  codes: [],
  authors: "everyone",
  search: "",
};

/** Where the app currently is, as the pages report it. */
export type ExcerptDocumentContext = {
  documentId: string | null;
  projectId: string | null;
  /** The verbatim codebook being coded through, when there is one. */
  codebookId: string | null;
};

export type FocusOrigin = "editor" | "table";

export type PhraseFocus = {
  /**
   * The row that was focused, when the focus came from the table. The editor
   * cannot compute it: a phrase is identified by the anchors covering its EXACT
   * span, and two overlapping codings put a different set on each of their runs
   * than either one spans. So the editor publishes anchors and lets the rows
   * recognise themselves — see {@link focusMatchesPhrase}.
   */
  phraseId?: string;
  documentId: string;
  /** The anchors involved: how the editor finds the passage in the DOM. */
  codingIds: string[];
  source: FocusOrigin;
};

/**
 * Whether a row is what the current focus is about. An exact row id wins; failing
 * that, any shared anchor does — which is what makes selecting an overlapped
 * passage in the editor light up every excerpt that covers it, rather than none.
 */
export function focusMatchesPhrase(
  focus: PhraseFocus | null,
  phrase: { id: string; documentId: string; codingIds: string[] },
): boolean {
  if (!focus || focus.documentId !== phrase.documentId) return false;
  if (focus.phraseId) return focus.phraseId === phrase.id;
  return phrase.codingIds.some((id) => focus.codingIds.includes(id));
}

type ExcerptPanelValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  width: number;
  setWidth: (width: number) => void;

  filter: ExcerptFilterState;
  setFilter: React.Dispatch<React.SetStateAction<ExcerptFilterState>>;
  groupBy: PhraseGroupBy;
  setGroupBy: (groupBy: PhraseGroupBy) => void;

  context: ExcerptDocumentContext;
  setContext: (context: ExcerptDocumentContext) => void;

  focused: PhraseFocus | null;
  focus: (focus: PhraseFocus) => void;
  subscribe: (listener: (focus: PhraseFocus) => void) => () => void;
};

const ExcerptPanelContext = React.createContext<ExcerptPanelValue | null>(null);

const OPEN_KEY = "hl-excerpt-panel-open";
const WIDTH_KEY = "hl-excerpt-panel-width";
const GROUP_KEY = "hl-excerpt-panel-group";

export const MIN_PANEL_WIDTH = 320;
export const MAX_PANEL_WIDTH = 780;
export const DEFAULT_PANEL_WIDTH = 420;

function readStored<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return parse(raw);
  } catch {
    return fallback;
  }
}

export function ExcerptPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpenState] = React.useState(false);
  const [width, setWidthState] = React.useState(DEFAULT_PANEL_WIDTH);
  const [groupBy, setGroupByState] = React.useState<PhraseGroupBy>(
    DEFAULT_PHRASE_GROUP_BY,
  );
  const [filter, setFilter] = React.useState<ExcerptFilterState>(EMPTY_FILTER);
  const [context, setContextState] = React.useState<ExcerptDocumentContext>({
    documentId: null,
    projectId: null,
    codebookId: null,
  });
  const [focused, setFocused] = React.useState<PhraseFocus | null>(null);

  // Restored after mount rather than during render: the server has no localStorage,
  // and a first paint that disagreed with it would hydrate-mismatch.
  React.useEffect(() => {
    setOpenState(readStored(OPEN_KEY, (raw) => raw === "1", false));
    setWidthState(
      readStored(
        WIDTH_KEY,
        (raw) =>
          Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Number(raw))),
        DEFAULT_PANEL_WIDTH,
      ),
    );
    setGroupByState(
      readStored(GROUP_KEY, (raw) => raw as PhraseGroupBy, DEFAULT_PHRASE_GROUP_BY),
    );
  }, []);

  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next);
    if (typeof window !== "undefined")
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
  }, []);

  const toggle = React.useCallback(() => {
    setOpenState((current) => {
      const next = !current;
      if (typeof window !== "undefined")
        window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const setWidth = React.useCallback((next: number) => {
    const clamped = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, next));
    setWidthState(clamped);
    if (typeof window !== "undefined")
      window.localStorage.setItem(WIDTH_KEY, String(clamped));
  }, []);

  const setGroupBy = React.useCallback((next: PhraseGroupBy) => {
    setGroupByState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(GROUP_KEY, next);
  }, []);

  /**
   * Adopt a page's context. Identity-preserving when nothing moved, so a page can
   * report where it is on every render without re-rendering the panel for nothing.
   */
  const setContext = React.useCallback((next: ExcerptDocumentContext) => {
    setContextState((current) =>
      current.documentId === next.documentId &&
      current.projectId === next.projectId &&
      current.codebookId === next.codebookId
        ? current
        : next,
    );
  }, []);

  /**
   * Opening a document sets the defaults that go with it: this document, and its
   * codes grouped by the codebook being used.
   *
   * Only on a change of DOCUMENT, so a researcher who widened the table to the whole
   * study keeps it that way while they work; opening a different interview is the
   * one moment where "what am I looking at" has genuinely changed under them. Run as
   * an effect rather than inside the state updater above, which must stay pure.
   */
  const lastDocument = React.useRef<string | null>(null);
  const documentId = context.documentId;
  React.useEffect(() => {
    if (documentId === lastDocument.current) return;
    lastDocument.current = documentId;
    if (!documentId) return;
    setFilter((current) => ({
      ...current,
      scope: "document",
      codes: [],
      contextCodes: [],
    }));
    setGroupByState("code");
  }, [documentId]);

  const listeners = React.useRef(new Set<(focus: PhraseFocus) => void>());

  const focus = React.useCallback((next: PhraseFocus) => {
    setFocused(next);
    for (const listener of listeners.current) listener(next);
  }, []);

  const subscribe = React.useCallback((listener: (focus: PhraseFocus) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const value: ExcerptPanelValue = {
    open,
    setOpen,
    toggle,
    width,
    setWidth,
    filter,
    setFilter,
    groupBy,
    setGroupBy,
    context,
    setContext,
    focused,
    focus,
    subscribe,
  };

  return (
    <ExcerptPanelContext.Provider value={value}>
      {children}
    </ExcerptPanelContext.Provider>
  );
}

export function useExcerptPanel(): ExcerptPanelValue {
  const value = React.useContext(ExcerptPanelContext);
  if (!value) {
    throw new Error("useExcerptPanel must be used inside ExcerptPanelProvider");
  }
  return value;
}

/**
 * Tell the panel where the app is. Safe outside the provider (the landing pages and
 * the welcome flow render no panel), so pages can call it unconditionally.
 */
export function useExcerptPanelContext(next: ExcerptDocumentContext): void {
  const panel = React.useContext(ExcerptPanelContext);
  const setContext = panel?.setContext;
  const { documentId, projectId, codebookId } = next;
  React.useEffect(() => {
    setContext?.({ documentId, projectId, codebookId });
  }, [setContext, documentId, projectId, codebookId]);
}
