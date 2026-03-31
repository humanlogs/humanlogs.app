import { TranscriptionSegment } from "@/hooks/use-transcriptions";

/**
 * Converts the plain text content of the editor back to segments.
 * Uses the original segments array as reference and updates only the text content.
 * Formatting modifiers are extracted from the DOM structure.
 */
export function domToSegments(
  container: HTMLElement,
  originalSegments: TranscriptionSegment[],
): TranscriptionSegment[] {
  const text = container.textContent ?? "";

  // Build a map of character positions to formatting modifiers
  const modifierMap = new Map<number, Set<"b" | "i" | "u" | "s">>();

  const buildModifierMap = (
    node: Node,
    modifiers: ("b" | "i" | "u" | "s")[],
    offset: number,
  ): number => {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent ?? "";
      for (let i = 0; i < nodeText.length; i++) {
        const pos = offset + i;
        if (!modifierMap.has(pos)) {
          modifierMap.set(pos, new Set());
        }
        modifiers.forEach((mod) => modifierMap.get(pos)!.add(mod));
      }
      return offset + nodeText.length;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      let newModifiers = [...modifiers];
      if (tag === "b" || tag === "strong") {
        newModifiers = [...newModifiers, "b"];
      } else if (tag === "i" || tag === "em") {
        newModifiers = [...newModifiers, "i"];
      } else if (tag === "u") {
        newModifiers = [...newModifiers, "u"];
      } else if (tag === "s" || tag === "strike" || tag === "del") {
        newModifiers = [...newModifiers, "s"];
      }

      let currentOffset = offset;
      for (const child of Array.from(node.childNodes)) {
        currentOffset = buildModifierMap(child, newModifiers, currentOffset);
      }
      return currentOffset;
    }

    return offset;
  };

  buildModifierMap(container, [], 0);

  // Now reconstruct segments by iterating through the text
  const result: TranscriptionSegment[] = [];
  let charIndex = 0;

  for (const originalSeg of originalSegments) {
    const segmentLength = originalSeg.text.length;
    const segmentText = text.substring(charIndex, charIndex + segmentLength);

    // Determine modifiers for this segment by sampling the first character
    const mods = modifierMap.get(charIndex);
    const segmentModifiers = mods ? Array.from(mods) : [];

    result.push({
      ...originalSeg,
      text: segmentText,
      modifiers:
        segmentModifiers.length > 0
          ? (segmentModifiers as ("b" | "i" | "u" | "s")[])
          : undefined,
    });

    charIndex += segmentLength;
  }

  // Handle case where user has typed more text than exists in original segments
  if (charIndex < text.length) {
    const remainingText = text.substring(charIndex);
    // Split remaining text into words and spacing
    const parts = remainingText.split(/(\s+)/);

    for (const part of parts) {
      if (!part) continue;

      const mods = modifierMap.get(charIndex);
      const segmentModifiers = mods ? Array.from(mods) : [];

      result.push({
        type: /^\s+$/.test(part) ? "spacing" : "word",
        text: part,
        modifiers:
          segmentModifiers.length > 0
            ? (segmentModifiers as ("b" | "i" | "u" | "s")[])
            : undefined,
      });

      charIndex += part.length;
    }
  }

  return result;
}
