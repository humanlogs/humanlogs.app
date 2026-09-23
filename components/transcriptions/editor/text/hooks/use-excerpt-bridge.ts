"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useExcerptPanel,
  useExcerptPanelContext,
  type PhraseCodingToggle,
} from "@/components/codebooks/excerpts/excerpt-panel-context";
import { useAudio } from "@/components/transcriptions/editor/audio/audio-context";
import { useBetaFeatures } from "@/hooks/use-api";
import { useLiveDocumentIndex } from "@/hooks/use-local-index";
import type { CodingDTO } from "@/lib/codebooks/coding";
import type { EditorAPI } from "../api";
import { codingIdsCoveringRange } from "../utils/coding-actions";

/**
 * The thread between the transcript on the left and the excerpt table on the right.
 *
 * Four jobs, all of them about keeping the two halves of coding in step:
 *
 *  1. **Say where we are.** The panel is global; the editor is what tells it which
 *     document and which codebook are open, which is what its defaults are derived
 *     from (this document, grouped by that codebook's codes).
 *  2. **Keep the index live.** The background sync is driven by the transcript's
 *     `updatedAt`, which does not move when a code is applied. The document being
 *     coded therefore writes its own rows from the live projection, so a passage
 *     coded a second ago is already a row in the table.
 *  3. **Follow the eye.** Select a coded passage and its row scrolls into view;
 *     click a row and the passage does — including across documents, which is a
 *     navigation rather than a scroll.
 *  4. **Lend what only this side has.** The audio player and the CRDT live in the
 *     editor, so the panel borrows them for the document on screen: a row can be
 *     listened to, and its codes changed, while its interview is open.
 */
export function useExcerptBridge({
  transcriptionId,
  projectId,
  title,
  serverUpdatedAt,
  codebookId,
  editorAPI,
  codings,
  audioControls,
  toggleCodeOnPhrase,
  active,
}: {
  transcriptionId: string;
  projectId: string | null;
  title: string;
  /** The document's `updatedAt`, used to stamp the rows this session writes. */
  serverUpdatedAt?: string | null;
  /** The verbatim codebook being coded through, if any. */
  codebookId: string | null;
  editorAPI: EditorAPI;
  codings: CodingDTO[];
  /**
   * The player's controls, for the play button on a row. Absent until the audio
   * has loaded, and on a document that has none.
   */
  audioControls?: { play: () => void } | null;
  /**
   * Put a code on, or take one off, a passage the TABLE names. Absent while the
   * document is read-only or has no codebook, and the panel then offers no picker
   * rather than one that does nothing.
   */
  toggleCodeOnPhrase?: PhraseCodingToggle;
  /**
   * Whether the coding phase is on. The bridge stays wired either way — a table
   * open while transcribing is legitimate — but the editor only publishes its
   * selection while coding, where a selection means "this passage", not "I am
   * about to type here".
   */
  active: boolean;
}) {
  const router = useRouter();
  const panel = useExcerptPanel();
  // Same gate as the panel itself. Without the codebooks beta there is nothing to
  // code with, so indexing every document that gets opened would fill the local
  // database with empty rows and report them on the security page.
  const betaFeatures = useBetaFeatures();
  const pushIndex = useLiveDocumentIndex({
    documentId: transcriptionId,
    projectId,
    title,
    serverUpdatedAt,
    enabled: betaFeatures,
  });

  useExcerptPanelContext({
    documentId: transcriptionId,
    projectId,
    codebookId,
  });

  // --- (2) Keep this document's rows current.
  //
  // Rebuilt from the projection the editor already derives (which carries the
  // anchors per token) plus the codings the API returned, on every change of
  // either. `pushIndex` debounces, so a run of codes costs one rewrite.
  const codingsRef = React.useRef(codings);
  codingsRef.current = codings;

  React.useEffect(() => {
    const rebuild = () =>
      pushIndex({
        segments: editorAPI.getSegments(),
        codings: codingsRef.current,
      });

    rebuild();
    editorAPI.addListener("codingsChange", rebuild);
    editorAPI.addListener("change", rebuild);
    return () => {
      editorAPI.removeListener("codingsChange", rebuild);
      editorAPI.removeListener("change", rebuild);
    };
  }, [editorAPI, pushIndex, codings]);

  // --- (3a) Editor → table. Publish the anchors under the selection.
  //
  // Only when they change: `onSelectionUpdate` fires on every caret move, and
  // re-publishing the same passage would keep yanking the table back to a row the
  // researcher may have scrolled away from on purpose.
  const lastPublished = React.useRef<string>("");
  const publishSelection = React.useCallback(() => {
    if (!active) return;
    const editor = editorAPI.getEditor();
    if (!editor) return;
    const { from, to } = editor.state.selection;
    // An empty selection still sits inside the passage it is in; probing one
    // character wide is what makes clicking into a coded run count as pointing at it.
    const codingIds = codingIdsCoveringRange(
      editor,
      from,
      to > from ? to : from + 1,
    );
    const signature = codingIds.join("+");
    if (signature === lastPublished.current) return;
    lastPublished.current = signature;
    if (codingIds.length === 0) return;
    panel.focus({
      documentId: transcriptionId,
      codingIds,
      source: "editor",
    });
  }, [active, editorAPI, panel, transcriptionId]);

  // --- (3b) Table → editor. Scroll to the passage, or open the document holding it.
  //
  // Claimed first, so the panel's own fallback stands down: without an editor
  // mounted the panel navigates on its own, and both acting on the same click
  // would push a route out from under the scroll it just performed.
  const claimFocus = panel.claimFocus;
  React.useEffect(() => claimFocus(), [claimFocus]);

  // --- Lend the panel this document's audio, so a row can be listened to.
  //
  // SEEK AND THEN PLAY. Seeking alone moves the playhead and makes no sound, which
  // is what "play" on an excerpt did at first: the button worked, the position
  // moved, and nothing happened that anyone could hear. `play` lives on the
  // player's own controls rather than on the audio context, so the editor passes
  // it in.
  //
  // Through a ref, for the same reason as the coding below: if this callback's
  // identity ever started changing per render, registering it directly would loop
  // the provider, and that failure mode is a frozen page rather than a missed
  // update.
  const { seekTo } = useAudio();
  const playRef = React.useRef<((seconds: number) => void) | undefined>(
    undefined,
  );
  React.useEffect(() => {
    playRef.current = (seconds: number) => {
      seekTo(seconds);
      audioControls?.play();
    };
  }, [seekTo, audioControls]);

  const playFrom = React.useCallback((seconds: number) => {
    playRef.current?.(seconds);
  }, []);

  const registerAudio = panel.registerAudio;
  React.useEffect(() => {
    registerAudio(transcriptionId, playFrom);
    return () => registerAudio(transcriptionId, null);
  }, [registerAudio, transcriptionId, playFrom]);

  // --- Lend it the ability to code, too.
  //
  // A coding is a database row AND an anchor in this document's CRDT, and only the
  // client holding that Y.Doc can write the second half. So the panel names a
  // passage and this does the work — the alternative, letting the panel POST the
  // row on its own, would leave a coding nothing in the transcript points at.
  //
  // What is registered is a STABLE wrapper over a ref, never the callback itself.
  // The real one closes over TanStack mutation objects, which are a fresh identity
  // on every render, so registering it directly stored a new function each render,
  // which re-rendered the provider, which re-ran this effect: "Maximum update depth
  // exceeded", and the page froze. Anything handed across this boundary has to be
  // identity-stable or the boundary becomes a render loop.
  const codingRef = React.useRef(toggleCodeOnPhrase);
  React.useEffect(() => {
    codingRef.current = toggleCodeOnPhrase;
  }, [toggleCodeOnPhrase]);

  const toggleCoding = React.useCallback<PhraseCodingToggle>(
    (intent) => codingRef.current?.(intent) ?? false,
    [],
  );

  const canCode = !!toggleCodeOnPhrase;
  const registerCoding = panel.registerCoding;
  React.useEffect(() => {
    if (!canCode) return;
    registerCoding(transcriptionId, toggleCoding);
    return () => registerCoding(transcriptionId, null);
  }, [registerCoding, transcriptionId, canCode, toggleCoding]);

  // --- Entering a coding pass opens the table, on a screen with room for it.
  //
  // Coding without it is coding blind: you cannot see what you have already said
  // about the corpus. The panel decides whether to actually open — it owns the
  // width threshold and knows whether the reader has closed it.
  const autoOpen = panel.autoOpen;
  React.useEffect(() => {
    if (active) autoOpen();
  }, [active, autoOpen]);

  React.useEffect(
    () =>
      panel.subscribe((focus) => {
        if (focus.source !== "table") return;
        if (focus.documentId !== transcriptionId) {
          // A row from another interview. Following it is a navigation, and the
          // anchor travels in the URL so the editor that opens can land on it —
          // the passage is not in this document's DOM to scroll to.
          router.push(
            `/app/transcription/${focus.documentId}?phase=coding&coding=${encodeURIComponent(
              focus.codingIds[0] ?? "",
            )}`,
          );
          return;
        }
        scrollToCoding(focus.codingIds);
      }),
    [panel, transcriptionId, router],
  );

  // --- Landing on a passage named in the URL (the cross-document case above).
  //
  // Waits for the editor to be ready: the document is seeded asynchronously, and a
  // scroll issued before the text exists would find nothing to scroll to.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const wanted = new URLSearchParams(window.location.search).get("coding");
    if (!wanted) return;
    let attempts = 0;
    const tick = () => {
      if (scrollToCoding([wanted])) return;
      if (attempts++ > 40) return; // ~8s, then give up rather than spin
      timer = setTimeout(tick, 200);
    };
    let timer = setTimeout(tick, 200);
    return () => clearTimeout(timer);
  }, [transcriptionId]);

  return { publishSelection };
}

/**
 * Bring the first of these anchors into view and flash it.
 *
 * Found through the DOM rather than through ProseMirror positions: the mark renders
 * as `span[data-coding-id]`, the attribute is a space-separated SET (a run can carry
 * several codings), and `~=` is exactly the selector for "this value is one of the
 * words". Returns whether anything was found, which is what the URL-landing retry
 * loop waits on.
 */
function scrollToCoding(codingIds: string[]): boolean {
  if (typeof document === "undefined") return false;
  for (const id of codingIds) {
    const target = document.querySelector<HTMLElement>(
      `.tiptap [data-coding-id~="${CSS.escape(id)}"]`,
    );
    if (!target) continue;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    // A coded passage is already highlighted by its code's colour, so the cue for
    // "this is the one you clicked" has to be motion rather than another tint.
    target.classList.add("hl-coding-flash");
    setTimeout(() => target.classList.remove("hl-coding-flash"), 1200);
    return true;
  }
  return false;
}
