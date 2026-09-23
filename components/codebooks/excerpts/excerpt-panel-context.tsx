"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CodeRef } from "@/lib/codebooks/codebook";
import {
  DEFAULT_PHRASE_GROUP_BY,
  phraseMatchesAnchors,
  type PhraseGroupBy,
} from "@/lib/local/phrase-query";

/**
 * The excerpt panel's state, and the thread between it and the editor.
 *
 * The panel's STATE is global and its presence is not. One instance, one filter,
 * one width, alive across navigation, so a researcher who opens a second interview
 * to check a passage comes back to the table exactly as they left it. But it is
 * only ever SHOWN on a document (see {@link useExcerptPanelOnPage}): everywhere
 * else it was open over a page that had not asked its question.
 *
 * Living outside the pages means they have to tell it where they are, which is what
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
 * Whether a row is what the current focus is about — see
 * {@link phraseMatchesAnchors}, which owns the rule because it is about the shape
 * of the index rather than about the panel.
 */
export function focusMatchesPhrase(
  focus: PhraseFocus | null,
  phrase: { id: string; documentId: string; codingIds: string[] },
): boolean {
  return phraseMatchesAnchors(phrase, focus);
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
  /**
   * Say that an editor is mounted and will act on the table's clicks itself.
   *
   * The panel outlives any one editor: while a document is loading, or failed to
   * decrypt, the table can be on screen with no bridge behind it, and a click used
   * to publish a focus nobody was listening for. The fallback below navigates in
   * that case — but only then, or a row clicked next to a mounted editor would
   * both scroll and navigate.
   */
  claimFocus: () => () => void;
  /** Open the panel on entering a coding pass — see the implementation. */
  autoOpen: () => void;
  /**
   * Open the interview a row comes from WITHOUT resetting the table to it. The
   * only way to reach a row's play and code controls from a study-wide view.
   */
  followDocument: (documentId: string, codingId?: string) => void;

  /**
   * The document whose audio is currently playable, if any.
   *
   * The player lives inside the editor (`AudioProvider`), the panel does not — so
   * a row can offer to replay its passage only while the interview it comes from
   * is the one on screen. Rows of other interviews show no play button rather
   * than a dead one; listening across documents needs a player the panel owns,
   * which is a different piece of work.
   */
  audioDocumentId: string | null;
  registerAudio: (
    documentId: string,
    seek: ((seconds: number) => void) | null,
  ) => void;
  seekAudio: (seconds: number) => void;

  /**
   * The document whose codes the table may change, if any.
   *
   * Same division as the audio, and for a harder reason: a coding is a row in the
   * database AND an anchor in the CRDT, and only the client holding that document's
   * Y.Doc can write the second half. The panel holds neither, so it names the
   * passage and the open editor does the work. Rows of other interviews offer no
   * code picker rather than one that would half-apply — writing the row without the
   * anchor is a coding nothing points at.
   */
  codingDocumentId: string | null;
  registerCoding: (
    documentId: string,
    toggle: PhraseCodingToggle | null,
  ) => void;
  /** Returns false when the passage could not be found in the open document. */
  togglePhraseCode: (intent: PhraseCodingIntent) => boolean;
};

/** A code to put on, or take off, one coded passage. */
export type PhraseCodingIntent = {
  documentId: string;
  /** The passage's anchors — how the editor finds its exact range. */
  codingIds: readonly string[];
  codebookId: string;
  codeId: string;
};

export type PhraseCodingToggle = (
  intent: Omit<PhraseCodingIntent, "documentId">,
) => boolean;

const ExcerptPanelContext = React.createContext<ExcerptPanelValue | null>(null);

const OPEN_KEY = "hl-excerpt-panel-open";
const WIDTH_KEY = "hl-excerpt-panel-width";
const GROUP_KEY = "hl-excerpt-panel-group";
/**
 * The study the panel is pointed at.
 *
 * Persisted, unlike the open document, because the two answer different
 * questions. "Which interview is on screen" is a property of the page, and a
 * reload on the account settings has genuinely left it. "Which study am I
 * working on" is not: it survives closing the laptop, and a panel that forgot it
 * would be an empty column on every page that does not happen to name a study —
 * home, account, anything reached by a hard reload.
 */
const STUDY_KEY = "hl-excerpt-panel-study";

/**
 * Below this the panel is not a second column, it is half the transcript taken
 * away — so a coding pass opens it only on a screen with room for both. Roughly
 * a 420px panel, a readable measure of text, and the sidebar.
 */
const AUTO_OPEN_MIN_WIDTH = 1280;

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

/**
 * A capability the open editor LENDS the panel, for one document.
 *
 * Two of these exist and they had the same fifteen lines twice: the audio player
 * and the ability to write a coding both live inside the editor, and the panel can
 * use them only for the interview currently on screen. The subtle half is the
 * deregistration, which is why this is shared rather than written out twice: only
 * the document that registered may clear the slot. Navigating between two
 * interviews MOUNTS the next editor before unmounting the previous one, so a blind
 * clear on unmount would wipe the arrival.
 */
function useLentCapability<T>() {
  const [held, setHeld] = React.useState<{
    documentId: string;
    value: T;
  } | null>(null);

  const register = React.useCallback((documentId: string, value: T | null) => {
    setHeld((current) => {
      if (!value) {
        return current?.documentId === documentId ? null : current;
      }
      return current?.documentId === documentId && current.value === value
        ? current
        : { documentId, value };
    });
  }, []);

  return { held, register };
}

export function ExcerptPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
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
  const audio = useLentCapability<(seconds: number) => void>();
  const coding = useLentCapability<PhraseCodingToggle>();

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
      readStored(
        GROUP_KEY,
        (raw) => raw as PhraseGroupBy,
        DEFAULT_PHRASE_GROUP_BY,
      ),
    );
    const study = readStored<string | null>(STUDY_KEY, (raw) => raw, null);
    if (study !== null) {
      // Only the study. A restored document id would claim an editor is open when
      // the page may be the account settings, and the scope control would offer to
      // filter on a document nobody can see.
      setContextState((current) =>
        current.projectId === null && current.documentId === null
          ? { ...current, projectId: study || null }
          : current,
      );
    }
  }, []);

  /**
   * Whether the reader has closed the panel themselves since the app loaded.
   *
   * {@link autoOpen} stands down once they have. Opening a table over someone's
   * transcript is helpful the first time and an imposition the third, and the
   * closing gesture is the only reliable statement of "not now".
   */
  const dismissed = React.useRef(false);

  const setOpen = React.useCallback((next: boolean) => {
    if (!next) dismissed.current = true;
    setOpenState(next);
    if (typeof window !== "undefined")
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
  }, []);

  const toggle = React.useCallback(() => {
    setOpenState((current) => {
      const next = !current;
      if (!next) dismissed.current = true;
      if (typeof window !== "undefined")
        window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  /**
   * Open the panel because a coding pass just started.
   *
   * Coding without the table is coding blind — you cannot see what you have
   * already said about the corpus — so entering the phase is the one moment where
   * opening it unasked is right. Two conditions keep that from being pushy: the
   * window has to be wide enough for a second column to be a second column rather
   * than a squeeze, and the reader must not have closed it since the app loaded.
   */
  const autoOpen = React.useCallback(() => {
    if (dismissed.current) return;
    if (typeof window === "undefined") return;
    if (window.innerWidth < AUTO_OPEN_MIN_WIDTH) return;
    setOpenState(true);
    window.localStorage.setItem(OPEN_KEY, "1");
  }, []);

  const setWidth = React.useCallback((next: number) => {
    const clamped = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, next));
    setWidthState(clamped);
    if (typeof window !== "undefined")
      window.localStorage.setItem(WIDTH_KEY, String(clamped));
  }, []);

  const setGroupBy = React.useCallback((next: PhraseGroupBy) => {
    setGroupByState(next);
    if (typeof window !== "undefined")
      window.localStorage.setItem(GROUP_KEY, next);
  }, []);

  /**
   * Adopt a page's context. Identity-preserving when nothing moved, so a page can
   * report where it is on every render without re-rendering the panel for nothing.
   */
  const setContext = React.useCallback((next: ExcerptDocumentContext) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STUDY_KEY, next.projectId ?? "");
    }
    setContextState((current) =>
      current.documentId === next.documentId &&
      current.projectId === next.projectId &&
      current.codebookId === next.codebookId
        ? current
        : next,
    );
  }, []);

  /**
   * Go to the interview a row comes from, keeping the table exactly as it is.
   *
   * Reading a study-wide table, the rows of other interviews can be neither played
   * nor recoded: both need that document open. Following one used to mean losing
   * the view, because arriving on a document resets the table to it. So this says
   * "I am going there ON PURPOSE, do not reset" and the reset below stands down
   * once.
   */
  const keepView = React.useRef(false);
  const followDocument = React.useCallback(
    (documentId: string, codingId?: string) => {
      keepView.current = true;
      const anchor = codingId ? `&coding=${encodeURIComponent(codingId)}` : "";
      router.push(`/app/transcription/${documentId}?phase=coding${anchor}`);
    },
    [router],
  );

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
    // Arrived by following a row: the reader chose this document FROM the table
    // they had built, so rebuilding it under them is the opposite of helping.
    if (keepView.current) {
      keepView.current = false;
      return;
    }
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

  const subscribe = React.useCallback(
    (listener: (focus: PhraseFocus) => void) => {
      listeners.current.add(listener);
      return () => {
        listeners.current.delete(listener);
      };
    },
    [],
  );

  /**
   * How many editors are mounted and handling the table's clicks.
   *
   * A count rather than a boolean because navigating between two interviews
   * mounts the next bridge before unmounting the previous one, and a boolean
   * would be left false by the unmount that happens last.
   */
  const seekAudio = React.useCallback(
    (seconds: number) => {
      audio.held?.value(seconds);
    },
    [audio],
  );

  const togglePhraseCode = React.useCallback(
    (intent: PhraseCodingIntent) => {
      const held = coding.held;
      if (!held || held.documentId !== intent.documentId) return false;
      return held.value({
        codingIds: intent.codingIds,
        codebookId: intent.codebookId,
        codeId: intent.codeId,
      });
    },
    [coding],
  );

  const claimed = React.useRef(0);
  const claimFocus = React.useCallback(() => {
    claimed.current++;
    return () => {
      claimed.current--;
    };
  }, []);

  /**
   * Nobody is showing the transcript: follow the row ourselves.
   *
   * The same URL the editor's own cross-document jump uses, so the page that
   * opens lands on the passage rather than at the top of the interview.
   */
  React.useEffect(
    () =>
      subscribe((next) => {
        if (next.source !== "table" || claimed.current > 0) return;
        router.push(
          `/app/transcription/${next.documentId}?phase=coding&coding=${encodeURIComponent(
            next.codingIds[0] ?? "",
          )}`,
        );
      }),
    [subscribe, router],
  );

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
    claimFocus,
    autoOpen,
    followDocument,
    audioDocumentId: audio.held?.documentId ?? null,
    registerAudio: audio.register,
    seekAudio,
    codingDocumentId: coding.held?.documentId ?? null,
    registerCoding: coding.register,
    togglePhraseCode,
  };

  return (
    <ExcerptPanelContext.Provider value={value}>
      {children}
    </ExcerptPanelContext.Provider>
  );
}

/**
 * Whether the excerpt table belongs on the page you are on.
 *
 * Only a document, in either of its phases. The panel used to follow you
 * everywhere, which is what "global" bought: the table survived opening a second
 * interview. It also meant it sat open over the home page, the account settings
 * and a study's page, answering a question none of them had asked.
 *
 * Decided from the ROUTE rather than from `context.documentId`, because that is
 * reported by the pages that bother to report it: a page that forgets would leave
 * the previous document's id standing and the panel with it. A route cannot
 * forget where it is.
 */
export function useExcerptPanelOnPage(): boolean {
  const pathname = usePathname();
  return pathname?.startsWith("/app/transcription/") ?? false;
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
