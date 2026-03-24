"use client";

import { RefObject, useCallback, useEffect, useState } from "react";

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

// Detect which formats are active at the current cursor position
function getActiveFormats(): Set<"b" | "i" | "u" | "s"> {
  const selection = window.getSelection();
  const active = new Set<"b" | "i" | "u" | "s">();

  if (!selection || selection.rangeCount === 0) return active;

  let node: Node | null = selection.anchorNode;

  // Walk up the DOM tree from the cursor position
  while (node && node.nodeType !== Node.DOCUMENT_NODE) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      if (tag === "b" || tag === "strong") active.add("b");
      if (tag === "i" || tag === "em") active.add("i");
      if (tag === "u") active.add("u");
      if (tag === "s" || tag === "strike" || tag === "del") active.add("s");

      // Stop at the editor boundary
      if (element.hasAttribute("contenteditable")) break;
    }
    node = node.parentNode;
  }

  return active;
}

export function useFormat(editorRef: RefObject<HTMLDivElement | null>) {
  const [activeFormats, setActiveFormats] = useState<
    Set<"b" | "i" | "u" | "s">
  >(new Set());

  // Update active formats on selection change
  useEffect(() => {
    const updateFormats = () => {
      setActiveFormats(getActiveFormats());
    };

    const editor = editorRef.current;
    if (!editor) return;

    // Update on selection change and input
    document.addEventListener("selectionchange", updateFormats);
    editor.addEventListener("input", updateFormats);
    editor.addEventListener("keyup", updateFormats);
    editor.addEventListener("mouseup", updateFormats);

    return () => {
      document.removeEventListener("selectionchange", updateFormats);
      editor.removeEventListener("input", updateFormats);
      editor.removeEventListener("keyup", updateFormats);
      editor.removeEventListener("mouseup", updateFormats);
    };
  }, [editorRef]);

  const applyFormat = useCallback(
    (modifier: "b" | "i" | "u" | "s") => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      // Expand selection to full words before applying format
      expandSelectionToWords();

      const command =
        modifier === "b"
          ? "bold"
          : modifier === "i"
            ? "italic"
            : modifier === "u"
              ? "underline"
              : "strikeThrough";
      // execCommand integrates with the browser's native undo/redo stack and
      // preserves the current selection automatically.
      document.execCommand(command, false);

      // Update active formats after applying
      setActiveFormats(getActiveFormats());
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

      // Cmd+Shift+X or Ctrl+Shift+X for strikethrough
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "x") {
        e.preventDefault();
        applyFormat("s");
      }
    },
    [applyFormat],
  );

  return { applyFormat, handleKeyDown, activeFormats };
}
