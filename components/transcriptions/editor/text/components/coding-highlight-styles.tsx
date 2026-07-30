"use client";

import {
  codeKey,
  codingBackground,
  flattenCodingOptions,
  type CodingDTO,
  type CodingOption,
} from "@/lib/codebooks/coding";
import { useEffect, useState } from "react";
import { EditorAPI } from "../api";
import { codingAttrValuesInDoc } from "../utils/coding-actions";

/**
 * Paints the coded passages.
 *
 * The colour of a run is not a property of any single coding: it depends on the whole
 * set covering it, on which codebook each code came from, and on whether the researcher
 * is looking at their own pass or at everyone's. None of that fits in a mark attribute,
 * and a class set imperatively on the spans would be wiped the next time ProseMirror
 * redraws them — so we generate a stylesheet keyed on the attribute VALUE instead. A
 * coded document has a handful of distinct combinations, so this stays a dozen rules.
 *
 * A run whose codings are all filtered out (or whose codes were deleted) matches no
 * rule and falls back to `.hl-coding`'s transparent background: it reads as plain text,
 * which is exactly what "not in my pass" should look like.
 */
export function CodingHighlightStyles({
  editorAPI,
  options,
  visibleCodings,
}: {
  editorAPI: EditorAPI;
  options: CodingOption[];
  visibleCodings: CodingDTO[];
}) {
  const [attrValues, setAttrValues] = useState<string[]>([]);

  // The set of combinations changes whenever a coding is applied or removed — ours
  // (`codingsChange`, emitted synchronously) or a collaborator's (`change`, which
  // follows the debounced derivation).
  useEffect(() => {
    const update = () => {
      const editor = editorAPI.getEditor();
      setAttrValues(editor ? codingAttrValuesInDoc(editor) : []);
    };
    update();
    editorAPI.on("codingsChange", update);
    editorAPI.on("change", update);
    editorAPI.on("ready", update);
    return () => {
      editorAPI.off("codingsChange", update);
      editorAPI.off("change", update);
      editorAPI.off("ready", update);
    };
  }, [editorAPI]);

  // Colours are ordered by their position in the menu, not by the order the codings
  // happen to be listed in: the same overlap must always produce the same stripes,
  // however the passage was built up.
  const flat = flattenCodingOptions(options);
  const colorOf = new Map(
    flat.map((option, index) => [
      codeKey(option.codebookId, option.code.id),
      { color: option.color, order: index },
    ]),
  );
  const codingById = new Map(visibleCodings.map((c) => [c.id, c]));

  const rules: string[] = [];
  for (const value of attrValues) {
    // Ids are uuids; anything else did not come from us and has no business being
    // interpolated into a selector.
    if (!/^[\w- ]+$/.test(value)) continue;

    const painted = value
      .split(" ")
      .map((id) => codingById.get(id))
      .filter((c): c is CodingDTO => Boolean(c))
      .map((c) => colorOf.get(codeKey(c.codebookId, c.codeId)))
      .filter((entry): entry is { color: string | null; order: number } =>
        Boolean(entry),
      )
      .sort((a, b) => a.order - b.order);

    if (painted.length === 0) continue;
    rules.push(
      `.hl-coding[data-coding-id="${value}"]{background:${codingBackground(
        painted.map((p) => p.color),
      )};}`,
    );
  }

  if (rules.length === 0) return null;
  return <style>{rules.join("\n")}</style>;
}
