"use client";

import { useCallback } from "react";
import { getSelectionOffsets } from "../utils/selection";
import { useHotkeys } from "react-hotkeys-hook";
import { EditorAPI } from "./editor-api-tiptap";

const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "“": "”",
  "‘": "’",
};

// Store the original selection before bracket wrap for undo history
// This is accessed by the editor-sync to override beforeInput selection
export const bracketWrapState = {
  originalSelection: null as { start: number; end: number } | null,
};

export function useBracketWrap() {
  useHotkeys(
    "*",
    (e) => {
      const key = e.key;

      // Check if the pressed key is an opening bracket
      if (!BRACKET_PAIRS[key]) {
        return;
      }

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);

      // Only wrap if there's actually selected text
      if (range.collapsed) {
        return;
      }

      e.preventDefault();

      // Capture the original selection BEFORE any modifications
      const editorElement = (e.target as HTMLElement).closest(
        "[contenteditable]",
      ) as HTMLElement;
      if (editorElement) {
        const originalSel = getSelectionOffsets(editorElement);
        bracketWrapState.originalSelection = originalSel;
      }

      // Get the selected text
      const selectedText = range.toString();
      const closingBracket = BRACKET_PAIRS[key];

      // Create the wrapped text
      const wrappedText = `${key}${selectedText}${closingBracket}`;

      // Use execCommand for proper undo/redo integration
      document.execCommand("insertText", false, wrappedText);

      // Select text inside brackets after a brief delay to ensure input event completes
      setTimeout(() => {
        bracketWrapState.originalSelection = null;

        const currentSelection = window.getSelection();
        if (currentSelection && selectedText.length > 0) {
          const newRange = document.createRange();
          const currentNode = currentSelection.anchorNode;
          if (currentNode && currentNode.nodeType === Node.TEXT_NODE) {
            const textContent = currentNode.textContent || "";
            const wrapPosition = textContent.lastIndexOf(wrappedText);
            if (wrapPosition !== -1) {
              newRange.setStart(currentNode, wrapPosition + 1);
              newRange.setEnd(
                currentNode,
                wrapPosition + 1 + selectedText.length,
              );
              currentSelection.removeAllRanges();
              currentSelection.addRange(newRange);
            }
          }
        }
      }, 0);
    },
    [],
    {
      enableOnContentEditable: true,
    },
  );
}
