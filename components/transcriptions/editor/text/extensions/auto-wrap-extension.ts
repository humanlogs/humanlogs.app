import { Extension } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/**
 * TipTap extension that automatically wraps selected text with matching pairs
 * when typing opening characters like (, [, {, <, ", ', etc.
 */
export const AutoWrapExtension = Extension.create({
  name: "autoWrap",

  addKeyboardShortcuts() {
    const wrapPairs: Record<string, string> = {
      "(": ")",
      "[": "]",
      "{": "}",
      "<": ">",
      '"': '"',
      "'": "'",
    };

    const shortcuts: Record<string, () => boolean> = {};

    // Create a keyboard shortcut for each wrapping character
    Object.entries(wrapPairs).forEach(([open, close]) => {
      shortcuts[open] = () => {
        const { state, view } = this.editor;
        const { from, to, empty } = state.selection;

        // Only wrap if there's a selection (not just a cursor)
        if (empty) {
          return false; // Let the default behavior handle it
        }

        // Get the selected text
        const selectedText = state.doc.textBetween(from, to);

        // Replace the selection with wrapped text
        const tr = state.tr.insertText(
          `${open}${selectedText}${close}`,
          from,
          to,
        );

        // Set cursor position after the closing character
        const newPos = from + selectedText.length + 2;
        tr.setSelection(TextSelection.near(tr.doc.resolve(newPos)));

        view.dispatch(tr);

        return true; // Prevent default behavior
      };
    });

    return shortcuts;
  },
});
