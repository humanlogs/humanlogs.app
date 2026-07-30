"use client";

import { useUserProfile } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import { useAddCoding, useCodings, useDeleteCoding } from "@/hooks/use-codings";
import { codebooksInScopeForProject } from "@/lib/codebooks/codebook";
import {
  buildCodingOptions,
  codeKey,
  codingsInScope,
  DEFAULT_CODING_SCOPE,
  verbatimCodebooks,
  type CodingOption,
  type CodingScope,
} from "@/lib/codebooks/coding";
import { useCallback, useMemo, useRef, useState } from "react";
import { EditorAPI } from "../api";
import {
  applyCodingMark,
  codingIdsCoveringRange,
  removeCodingMark,
} from "../utils/coding-actions";

/**
 * Everything the coding phase does to a document, in one place: which codes are on
 * offer, which of them the current passage already carries, and applying or retracting
 * one.
 *
 * A coding is written in two halves that must not drift — the anchor mark in the
 * transcript and the row in the database — so both halves are always applied here, and
 * a failed request undoes the mark rather than leaving a highlight standing for nothing.
 */
export function useCoding({
  transcriptionId,
  projectId,
  editorAPI,
  canWrite,
}: {
  transcriptionId: string;
  projectId?: string | null;
  editorAPI: EditorAPI;
  canWrite: boolean;
}) {
  const { data: profile } = useUserProfile();
  const { data: codebooks = [] } = useCodebooks();
  const { data: codings = [] } = useCodings(transcriptionId);
  const addCoding = useAddCoding(transcriptionId);
  const deleteCoding = useDeleteCoding(transcriptionId);
  const [scope, setScope] = useState<CodingScope>(DEFAULT_CODING_SCOPE);

  /** The verbatim codebooks covering this document's study. */
  const availableCodebooks = useMemo(
    () => verbatimCodebooks(codebooksInScopeForProject(codebooks, projectId)),
    [codebooks, projectId],
  );

  /**
   * You code through ONE codebook at a time.
   *
   * A codebook is a way of looking at the material — a prism — and two of them held up
   * at once is not twice the reading, it is neither: the letters would run past Z, the
   * colours would stop being a legend, and "is this passage coded?" would have no
   * single answer. Switching is one click, and codings made through another codebook
   * stay in the database untouched; they are simply not what you are looking at.
   */
  const storageKey = `hl-coding-codebook:${projectId ?? "none"}`;
  const [chosenCodebookId, setChosenCodebookId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem(storageKey),
  );
  // Falling back to the first one keeps the bar usable before any choice, and after
  // the chosen codebook is deleted or moved out of this study.
  const codebook =
    availableCodebooks.find((c) => c.id === chosenCodebookId) ??
    availableCodebooks[0] ??
    null;

  const selectCodebook = useCallback(
    (id: string) => {
      setChosenCodebookId(id);
      if (typeof window !== "undefined") localStorage.setItem(storageKey, id);
    },
    [storageKey],
  );

  /** The codes on offer: those of the chosen codebook. */
  const options = useMemo(
    () => buildCodingOptions(codebook ? [codebook] : []),
    [codebook],
  );

  /**
   * The codes we have opened into, outermost first — empty at the top level.
   *
   * Sub-codes replace the list rather than living in a submenu. A theme is then always
   * one keystroke away, whether or not you go on to refine it: "A" applies the theme
   * AND puts its sub-themes where the themes were, so the next letter reads against
   * them. Escape (or the back row) comes back out.
   */
  const [trail, setTrail] = useState<CodingOption[]>([]);
  // The trail belongs to the codebook it was opened in; keeping it across a change of
  // prism would show one codebook's sub-codes under another's heading. Adjusted during
  // render rather than in an effect, so no frame is ever painted with the mismatch.
  const [trailCodebookId, setTrailCodebookId] = useState(codebook?.id ?? null);
  if (trailCodebookId !== (codebook?.id ?? null)) {
    setTrailCodebookId(codebook?.id ?? null);
    setTrail([]);
  }

  /** The codes currently shown: the top level, or the children we have opened into. */
  const level =
    trail.length > 0 ? trail[trail.length - 1].children : options;

  const back = useCallback(() => setTrail((t) => t.slice(0, -1)), []);
  // Identity-preserving when already at the top level, so callers can fire it on
  // every selection change without re-rendering the bar for nothing.
  const resetTrail = useCallback(
    () => setTrail((t) => (t.length === 0 ? t : [])),
    [],
  );

  const visibleCodings = useMemo(
    () =>
      codingsInScope(codings, scope, profile?.id).filter(
        (coding) => coding.codebookId === codebook?.id,
      ),
    [codings, scope, profile?.id, codebook?.id],
  );

  const codingsById = useMemo(
    () => new Map(codings.map((c) => [c.id, c])),
    [codings],
  );

  /**
   * The codes carried by the current selection, as `codebookId:codeId` keys — what
   * turns each menu entry into a checkbox.
   *
   * Only codings that cover the selection ENTIRELY count (see
   * `codingIdsCoveringRange`), and only within the current scope: a code applied by a
   * colleague must not read as one of mine, or clicking it would try to retract theirs.
   */
  const appliedAtSelection = useCallback((): Set<string> => {
    const editor = editorAPI.getEditor();
    if (!editor) return new Set();
    const { from, to } = editor.state.selection;
    const visible = new Set(visibleCodings.map((c) => c.id));
    const applied = new Set<string>();
    for (const id of codingIdsCoveringRange(editor, from, to)) {
      if (!visible.has(id)) continue;
      const coding = codingsById.get(id);
      if (coding) applied.add(codeKey(coding.codebookId, coding.codeId));
    }
    return applied;
  }, [editorAPI, visibleCodings, codingsById]);

  /**
   * Apply a code to the current selection, or retract it when it is already there.
   *
   * Retracting only ever touches YOUR OWN codings: a passage two researchers coded the
   * same way carries two rows, and one of them stepping back must not erase the other's
   * reading.
   */
  /**
   * What has been done to this document in this session, newest last.
   *
   * Coding cannot ride the editor's undo stack: the marks are written with
   * `addToHistory: false` precisely because Ctrl+Z only knows about the document and
   * would leave the database row pointing at nothing. So coding keeps its own, in
   * which one step is one code applied or retracted — which is what "undo" means to
   * someone coding anyway, whatever the transcript's own history holds.
   */
  const historyRef = useRef<
    Array<
      | { type: "apply"; codingId: string }
      | {
          type: "remove";
          codebookId: string;
          codeId: string;
          from: number;
          to: number;
        }
    >
  >([]);

  const toggleCode = useCallback(
    (option: Pick<CodingOption, "codebookId"> & { code: { id: string } }) => {
      const editor = editorAPI.getEditor();
      if (!editor || !canWrite) return;
      const { from, to } = editor.state.selection;
      if (to <= from) return;

      const mine = new Set(
        codings.filter((c) => c.userId === profile?.id).map((c) => c.id),
      );
      const existing = codingIdsCoveringRange(editor, from, to)
        .filter((id) => mine.has(id))
        .filter((id) => {
          const coding = codingsById.get(id);
          return (
            coding?.codebookId === option.codebookId &&
            coding?.codeId === option.code.id
          );
        });

      if (existing.length > 0) {
        for (const id of existing) {
          removeCodingMark(editor, id);
          deleteCoding.mutate(id);
        }
        historyRef.current.push({
          type: "remove",
          codebookId: option.codebookId,
          codeId: option.code.id,
          from,
          to,
        });
        editorAPI.emit("codingsChange");
        return;
      }

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `coding-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!applyCodingMark(editor, id)) return; // nothing to anchor (empty line)
      historyRef.current.push({ type: "apply", codingId: id });
      editorAPI.emit("codingsChange");
      addCoding.mutate(
        { id, codebookId: option.codebookId, codeId: option.code.id },
        {
          onError: () => {
            // The row never landed: take the highlight back out rather than leave a
            // coded-looking passage that no query would ever return.
            removeCodingMark(editor, id);
            historyRef.current = historyRef.current.filter(
              (entry) => !(entry.type === "apply" && entry.codingId === id),
            );
            editorAPI.emit("codingsChange");
          },
        },
      );
    },
    [
      editorAPI,
      canWrite,
      codings,
      codingsById,
      profile?.id,
      addCoding,
      deleteCoding,
    ],
  );

  /**
   * Choosing a code: apply it, and — when it has sub-codes — open them in place of
   * the level it was on. That is what makes one keystroke enough for a theme while
   * leaving its refinements one more keystroke away. A leaf closes the trail, so the
   * next passage starts from the themes again.
   */
  const pick = useCallback(
    (option: CodingOption) => {
      toggleCode(option);
      setTrail((current) =>
        option.children.length > 0 ? [...current, option] : [],
      );
    },
    [toggleCode],
  );

  /**
   * Take back the last thing coded here. Applying becomes retracting and retracting
   * becomes applying — with a fresh id, since the row is gone and a coding is
   * identified by the anchor it created.
   */
  const undo = useCallback(() => {
    const editor = editorAPI.getEditor();
    if (!editor || !canWrite) return;
    const entry = historyRef.current.pop();
    if (!entry) return;

    if (entry.type === "apply") {
      removeCodingMark(editor, entry.codingId);
      deleteCoding.mutate(entry.codingId);
      editorAPI.emit("codingsChange");
      return;
    }

    // Put the passage back and code it again. The range may have moved under a
    // collaborator's edit; clamping is the honest answer — better a coding an
    // approximate word wide than none at all.
    const size = editor.state.doc.content.size;
    const from = Math.min(entry.from, size);
    const to = Math.min(entry.to, size);
    if (to <= from) return;
    editor.commands.setTextSelection({ from, to });

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `coding-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!applyCodingMark(editor, id)) return;
    editorAPI.emit("codingsChange");
    addCoding.mutate(
      { id, codebookId: entry.codebookId, codeId: entry.codeId },
      {
        onError: () => {
          removeCodingMark(editor, id);
          editorAPI.emit("codingsChange");
        },
      },
    );
  }, [editorAPI, canWrite, addCoding, deleteCoding]);

  return {
    options,
    level,
    trail,
    back,
    resetTrail,
    pick,
    undo,
    availableCodebooks,
    codebook,
    selectCodebook,
    scope,
    setScope,
    codings,
    visibleCodings,
    codingsById,
    appliedAtSelection,
    toggleCode,
    /** Whether there is anything to code — no codebook means no coding phase. */
    hasCodes: options.length > 0,
  };
}
