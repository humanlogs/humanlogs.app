import { EditorAPI } from "./editor-api-tiptap";

/**
 * Selects the currently active segment (marked with .active-segment class)
 * and focuses the editor. Returns true if a segment was found and selected.
 */
export function selectActiveSegmentAndFocus(editorAPI: EditorAPI): boolean {
  editorAPI.focus();
  return editorAPI.getSegmentNode() !== null;
}

/**
 * Selects a specific segment by index and focuses the editor.
 * Returns true if the segment was found and selected.
 * @param editorAPI - The editor API instance
 * @param currentIndex - The segment index to select
 * @param selectContent - If true, selects the entire segment content; if false, just places caret at start
 */
export function selectSegmentByIndexAndFocus(
  editorAPI: EditorAPI,
  currentIndex: number,
  selectContent: boolean = true,
): boolean {
  editorAPI.focus(currentIndex, selectContent);
  return editorAPI.getSegmentNode(currentIndex) !== null;
}
