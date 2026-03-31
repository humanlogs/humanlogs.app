import { TranscriptionSegment } from "@/hooks/use-transcriptions";

// Modifier ranges for efficient lookup (instead of per-character Sets)
interface ModifierRange {
  start: number;
  end: number;
  modifiers: ("b" | "i" | "u" | "s")[];
}

/**
 * Converts the plain text content of the editor back to segments.
 * Uses the original segments array as reference and updates only the text content.
 * Formatting modifiers are extracted from the DOM structure.
 *
 * OPTIMIZED VERSION:
 * - Uses TreeWalker for faster DOM traversal
 * - Tracks modifier ranges instead of per-character Sets
 * - Processes text nodes as chunks instead of character-by-character
 */
export function domToSegments(
  container: HTMLElement,
  originalSegments: TranscriptionSegment[],
): TranscriptionSegment[] {
  const text = container.textContent ?? "";
  if (text.length === 0) return [];

  // Build modifier ranges using TreeWalker (faster than recursion)
  const modifierRanges: ModifierRange[] = [];

  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    null,
  );

  let currentOffset = 0;
  const modifierStack: ("b" | "i" | "u" | "s")[][] = [[]];

  let node: Node | null = walker.currentNode;

  while (node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Push new modifier context
      const parentModifiers = modifierStack[modifierStack.length - 1];
      const newModifiers = [...parentModifiers];

      if (tag === "b" || tag === "strong") {
        newModifiers.push("b");
      } else if (tag === "i" || tag === "em") {
        newModifiers.push("i");
      } else if (tag === "u") {
        newModifiers.push("u");
      } else if (tag === "s" || tag === "strike" || tag === "del") {
        newModifiers.push("s");
      }

      modifierStack.push(newModifiers);

      // Check if we have children
      if (el.firstChild) {
        node = walker.firstChild();
        continue;
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const nodeText = node.textContent ?? "";
      const nodeLength = nodeText.length;

      if (nodeLength > 0) {
        const currentModifiers = modifierStack[modifierStack.length - 1];
        if (currentModifiers.length > 0) {
          modifierRanges.push({
            start: currentOffset,
            end: currentOffset + nodeLength,
            modifiers: currentModifiers,
          });
        }
        currentOffset += nodeLength;
      }
    }

    // Move to next node
    const nextNode = walker.nextSibling();
    if (nextNode) {
      node = nextNode;
    } else {
      // Go up and pop modifier stack
      let parent = walker.parentNode();
      while (parent && parent !== container) {
        modifierStack.pop();
        const sibling = walker.nextSibling();
        if (sibling) {
          node = sibling;
          break;
        }
        parent = walker.parentNode();
      }
      if (!parent || parent === container) {
        break;
      }
    }
  }

  // Helper to get modifiers at a specific position (optimized range search)
  const getModifiersAt = (
    pos: number,
  ): ("b" | "i" | "u" | "s")[] | undefined => {
    for (let i = 0; i < modifierRanges.length; i++) {
      const range = modifierRanges[i];
      if (pos >= range.start && pos < range.end) {
        return range.modifiers;
      }
    }
    return undefined;
  };

  // Reconstruct segments - pre-allocate array for better performance
  const result: TranscriptionSegment[] = new Array(originalSegments.length);
  let charIndex = 0;
  let resultIndex = 0;

  // Process original segments efficiently
  for (let i = 0; i < originalSegments.length; i++) {
    const originalSeg = originalSegments[i];
    const segmentLength = originalSeg.text.length;
    const segmentText = text.substring(charIndex, charIndex + segmentLength);

    // Sample modifiers at the first character of the segment
    const modifiers = getModifiersAt(charIndex);

    result[resultIndex++] = {
      ...originalSeg,
      text: segmentText,
      modifiers: modifiers && modifiers.length > 0 ? modifiers : undefined,
    };

    charIndex += segmentLength;
  }

  // Handle extra text typed by user (if any)
  if (charIndex < text.length) {
    const remainingText = text.substring(charIndex);
    // Split into words and spacing using regex (faster than repeated splits)
    const parts = remainingText.split(/(\s+)/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      const modifiers = getModifiersAt(charIndex);

      result.push({
        type: /^\s+$/.test(part) ? "spacing" : "word",
        text: part,
        modifiers: modifiers && modifiers.length > 0 ? modifiers : undefined,
      });

      charIndex += part.length;
    }
  }

  return result;
}
