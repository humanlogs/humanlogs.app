"use client";

import { useCallback } from "react";

const BRACKET_PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
};

export function useBracketWrap() {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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

    // Get the selected text
    const selectedText = range.toString();
    const closingBracket = BRACKET_PAIRS[key];

    // Create the wrapped text
    const wrappedText = `${key}${selectedText}${closingBracket}`;

    // Use execCommand for proper undo/redo integration
    document.execCommand("insertText", false, wrappedText);

    // Select the text inside the brackets
    if (selection && selectedText.length > 0) {
      const newRange = document.createRange();
      const currentNode = selection.anchorNode;
      if (currentNode && currentNode.nodeType === Node.TEXT_NODE) {
        const textContent = currentNode.textContent || "";
        const wrapPosition = textContent.lastIndexOf(wrappedText);
        if (wrapPosition !== -1) {
          newRange.setStart(currentNode, wrapPosition + 1);
          newRange.setEnd(currentNode, wrapPosition + 1 + selectedText.length);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
      }
    }
  }, []);

  return { handleKeyDown };
}
