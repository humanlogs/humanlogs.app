"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useExcerptPanel,
  useExcerptPanelContext,
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
 * Three jobs, all of them about keeping the two halves of coding in step:
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
 */
export function useExcerptBridge({
  transcriptionId,
  projectId,
  title,
  serverUpdatedAt,
  codebookId,
  editorAPI,
  codings,
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
  const { seekTo } = useAudio();
  const registerAudio = panel.registerAudio;
  React.useEffect(() => {
    registerAudio(transcriptionId, seekTo);
    return () => registerAudio(transcriptionId, null);
  }, [registerAudio, transcriptionId, seekTo]);

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
