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
import { useCallback, useMemo, useState } from "react";
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

  /** The codes on offer: verbatim codebooks covering this document's study. */
  const options = useMemo(
    () =>
      buildCodingOptions(
        verbatimCodebooks(codebooksInScopeForProject(codebooks, projectId)),
      ),
    [codebooks, projectId],
  );

  const visibleCodings = useMemo(
    () => codingsInScope(codings, scope, profile?.id),
    [codings, scope, profile?.id],
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
        editorAPI.emit("codingsChange");
        return;
      }

      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `coding-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (!applyCodingMark(editor, id)) return; // nothing to anchor (empty line)
      editorAPI.emit("codingsChange");
      addCoding.mutate(
        { id, codebookId: option.codebookId, codeId: option.code.id },
        {
          onError: () => {
            // The row never landed: take the highlight back out rather than leave a
            // coded-looking passage that no query would ever return.
            removeCodingMark(editor, id);
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

  return {
    options,
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
