"use client";

import { RefObject, useCallback } from "react";

export function useFormat(editorRef: RefObject<HTMLDivElement | null>) {
  const applyFormat = useCallback(
    (modifier: "b" | "i" | "u") => {
      if (!editorRef.current) return;
      editorRef.current.focus();
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
