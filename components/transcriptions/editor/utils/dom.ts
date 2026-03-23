import { TranscriptionSegment } from "../../../../hooks/use-api";

// Maps HTML tag names produced by execCommand to the modifier they represent
const MODIFIER_TAG: Record<string, "b" | "i" | "u"> = {
  b: "b",
  strong: "b",
  i: "i",
  em: "i",
  u: "u",
};

export function elementToSegment(el: HTMLElement): TranscriptionSegment {
  const type = (el.dataset.type ?? "word") as "word" | "spacing";
  const text = el.textContent ?? "";
  const modifiers: ("b" | "i" | "u")[] = [];
  if (el.querySelector("b, strong")) modifiers.push("b");
  if (el.querySelector("i, em")) modifiers.push("i");
  if (el.querySelector("u")) modifiers.push("u");

  return {
    type,
    text,
    start:
      el.dataset.start !== undefined ? parseFloat(el.dataset.start) : undefined,
    end: el.dataset.end !== undefined ? parseFloat(el.dataset.end) : undefined,
    speakerId: el.dataset.speaker || undefined,
    modifiers:
      modifiers.length > 0 ? (modifiers as ("b" | "i" | "u")[]) : undefined,
  };
}

/**
 * Walk the contenteditable DOM and extract TranscriptionSegments.
 *
 * `inherited` accumulates formatting from execCommand-produced ancestor wrappers
 * (e.g. <b><span data-type="word">…</span></b>) so modifiers are correctly parsed.
 */
export function domToSegments(container: HTMLElement): TranscriptionSegment[] {
  const segments: TranscriptionSegment[] = [];

  const processNode = (
    node: Node,
    inherited: ("b" | "i" | "u")[],
    isFirstChild: boolean,
  ): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      const mod = MODIFIER_TAG[tag];
      const mods: ("b" | "i" | "u")[] =
        mod && !inherited.includes(mod) ? [...inherited, mod] : inherited;

      if (el.dataset.type) {
        const seg = elementToSegment(el);
        const combined = [...new Set([...(seg.modifiers ?? []), ...mods])] as (
          | "b"
          | "i"
          | "u"
        )[];
        segments.push({
          ...seg,
          modifiers: combined.length > 0 ? combined : undefined,
        });
        return;
      }

      if (el.tagName === "BR") {
        segments.push({ type: "spacing", text: "\n" });
        return;
      }

      // DIV elements created by pressing Enter — add a line break before their
      // content (except the very first div in the container, which shouldn't
      // inject a leading newline).
      if (el.tagName === "DIV" && !isFirstChild) {
        segments.push({ type: "spacing", text: "\n" });
      }

      for (let i = 0; i < el.childNodes.length; i++) {
        processNode(el.childNodes[i], mods, i === 0);
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (!text) return;
      const parts = text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          segments.push({ type: "spacing", text: part });
        } else {
          segments.push({
            type: "word",
            text: part,
            modifiers:
              inherited.length > 0
                ? ([...inherited] as ("b" | "i" | "u")[])
                : undefined,
          });
        }
      }
    }
  };

  for (let i = 0; i < container.childNodes.length; i++) {
    processNode(container.childNodes[i], [], i === 0);
  }
  return segments;
}
