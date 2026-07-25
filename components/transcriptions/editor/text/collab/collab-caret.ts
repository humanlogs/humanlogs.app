import { Extension } from "@tiptap/core";
import { yCursorPlugin } from "@tiptap/y-tiptap";
import type { Awareness } from "y-protocols/awareness";

/**
 * Remote collaboration carets, built directly on `@tiptap/y-tiptap`'s `yCursorPlugin`
 * — the SAME package the Collaboration extension uses for `ySyncPlugin`, so the
 * relative-position mapping shares one `ySyncPluginKey` (no version-mismatch risk
 * that the standalone `@tiptap/extension-collaboration-cursor` would introduce).
 *
 * The plugin writes the local selection into awareness (relayed by our blind-relay
 * provider) and renders peers' carets from awareness. The local `user` field
 * (name/color) is set by the editor hook.
 */
export interface CollabCaretOptions {
  awareness: Awareness | null;
}

type CaretUser = { name?: string; color?: string };

function cursorBuilder(user: CaretUser): HTMLElement {
  const color = user?.color || "#888888";
  const caret = document.createElement("span");
  caret.classList.add("collaboration-cursor__caret");
  caret.setAttribute("style", `border-color: ${color}`);

  const label = document.createElement("div");
  label.classList.add("collaboration-cursor__label");
  label.setAttribute("style", `background-color: ${color}`);
  label.textContent = user?.name || "Anonymous";

  caret.appendChild(label);
  return caret;
}

export const CollabCaret = Extension.create<CollabCaretOptions>({
  name: "collabCaret",

  addOptions() {
    return { awareness: null };
  },

  addProseMirrorPlugins() {
    const awareness = this.options.awareness;
    if (!awareness) return [];
    return [yCursorPlugin(awareness, { cursorBuilder })];
  },
});
