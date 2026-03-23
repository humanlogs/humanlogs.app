"use client";

import { RefObject, useCallback } from "react";

function expandSelectionToWords() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return;

  // Get the text content and positions
  const startContainer = range.startContainer;
  const endContainer = range.endContainer;
  const startOffset = range.startOffset;
  const endOffset = range.endOffset;

  // Helper to expand to word boundary in a text node
  const expandInNode = (
    node: Node,
    offset: number,
    direction: "start" | "end",
  ): number => {
    if (node.nodeType !== Node.TEXT_NODE) return offset;
    const text = node.textContent || "";

    if (direction === "start") {
      // Expand backward to start of word
      let pos = offset;
      while (pos > 0 && !/\s/.test(text[pos - 1])) {
        pos--;
      }
      return pos;
    } else {
      // Expand forward to end of word
      let pos = offset;
      while (pos < text.length && !/\s/.test(text[pos])) {
        pos++;
      }
      return pos;
    }
  };

  const newStartOffset = expandInNode(startContainer, startOffset, "start");
  const newEndOffset = expandInNode(endContainer, endOffset, "end");

  const newRange = document.createRange();
  newRange.setStart(startContainer, newStartOffset);
  newRange.setEnd(endContainer, newEndOffset);

  selection.removeAllRanges();
  selection.addRange(newRange);
}

export function useFormat(editorRef: RefObject<HTMLDivElement | null>) {
  const applyFormat = useCallback(
    (modifier: "b" | "i" | "u") => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      // Expand selection to full words before applying format
      expandSelectionToWords();

      const command =
        modifier === "b" ? "bold" : modifier === "i" ? "italic" : "underline";
      // execCommand integrates with the browser's native undo/redo stack and
      // preserves the current selection automatically.
      document.execCommand(command, false);
    },
    // editorRef is a stable ref — not needed in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Intercept Enter to insert <br> instead of letting the browser create <div>
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.execCommand("insertLineBreak", false);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === "b") {
          e.preventDefault();
          applyFormat("b");
        } else if (e.key === "i") {
          e.preventDefault();
          applyFormat("i");
        } else if (e.key === "u") {
          e.preventDefault();
          applyFormat("u");
        }
      }
    },
    [applyFormat],
  );

  return { applyFormat, handleKeyDown };
}
