import { Editor } from "@tiptap/react";
import { useState } from "react";
import { EditorAPI } from "../api";

const formatToTiptapMarkName: Record<"b" | "i" | "u" | "s", string> = {
  b: "bold",
  i: "italic",
  u: "underline",
  s: "strike",
};

const formatToTiptapMethod: Record<
  "b" | "i" | "u" | "s",
  "toggleBold" | "toggleItalic" | "toggleUnderline" | "toggleStrike"
> = {
  b: "toggleBold",
  i: "toggleItalic",
  u: "toggleUnderline",
  s: "toggleStrike",
};

export const useFormat = (editorAPI: EditorAPI, currentIndex: number) => {
  const [activeFormats, setActiveFormats] = useState<
    Set<"b" | "i" | "u" | "s">
  >(new Set());

  return {
    activeFormats,
    applyFormat: (format: "b" | "i" | "u" | "s") => {
      const editor = (editorAPI as any).editorRef?.current;
      if (!editor) return;

      const wasFocused = editor.isFocused;

      // If not focused, select the segment at currentIndex
      if (!wasFocused && currentIndex >= 0) {
        const segments = editorAPI.getSegments();
        if (currentIndex < segments.length) {
          // Calculate character offset for this segment
          let charOffset = 0;
          for (let i = 0; i < currentIndex; i++) {
            charOffset += segments[i].text.length;
          }
          const segmentLength = segments[currentIndex].text.length;

          // Select the entire segment (without focusing)
          editor.commands.setTextSelection({
            from: charOffset + 1,
            to: charOffset + segmentLength + 1,
          });
        }
      }

      // Check if we have a selection or just a caret
      const { from, to } = editor.state.selection;
      const isEmptySelection = from === to;

      if (isEmptySelection && wasFocused) {
        // Expand to word boundaries
        const { doc } = editor.state;
        const $pos = doc.resolve(from);
        const textContent = $pos.parent.textContent;
        const posInParent = $pos.parentOffset;

        // Find word boundaries
        let start = posInParent;
        let end = posInParent;

        // Find start of word (alphanumeric or apostrophe)
        while (start > 0 && /[\w']/.test(textContent[start - 1])) {
          start--;
        }

        // Find end of word
        while (end < textContent.length && /[\w']/.test(textContent[end])) {
          end++;
        }

        // Only select if we found a word
        if (start < end) {
          // Calculate absolute positions
          const absStart = from - posInParent + start;
          const absEnd = from - posInParent + end;

          // Set selection to word boundaries
          editor.commands.setTextSelection({ from: absStart, to: absEnd });
        }
      }

      // Apply format without changing focus state
      const chain = editor.chain();

      // Only focus if was already focused AND there's no selection
      // (focus() can interfere with existing selections)
      if (wasFocused && isEmptySelection) {
        chain.focus();
      }

      // Apply the appropriate toggle command
      const toggleMethod = formatToTiptapMethod[format];
      chain[toggleMethod]();
      chain.run();
    },
    selectionUpdate: (editor: Editor) => {
      if (!editor) return;

      const newActiveFormats = new Set<"b" | "i" | "u" | "s">();

      // Check which marks are active at the current selection
      (
        Object.keys(formatToTiptapMarkName) as Array<"b" | "i" | "u" | "s">
      ).forEach((format) => {
        const markName = formatToTiptapMarkName[format];
        if (editor.isActive(markName)) {
          newActiveFormats.add(format);
        }
      });

      setActiveFormats(newActiveFormats);
    },
  };
};
