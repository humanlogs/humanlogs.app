export interface SelectionOffsets {
  start: number;
  end: number;
}

export function getSelectionOffsets(
  container: HTMLElement,
): SelectionOffsets | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer)) return null;

  const preStart = document.createRange();
  preStart.selectNodeContents(container);
  preStart.setEnd(range.startContainer, range.startOffset);
  const start = preStart.toString().length;

  const preEnd = document.createRange();
  preEnd.selectNodeContents(container);
  preEnd.setEnd(range.endContainer, range.endOffset);
  const end = preEnd.toString().length;

  return { start, end };
}

export function restoreSelection(
  container: HTMLElement,
  start: number,
  end: number,
): void {
  const sel = window.getSelection();
  if (!sel) return;

  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;
  let charCount = 0;

  const walk = (node: Node): void => {
    if (startNode && endNode) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0;
      if (startNode === null && charCount + len >= start) {
        startNode = node;
        startNodeOffset = start - charCount;
      }
      if (endNode === null && charCount + len >= end) {
        endNode = node;
        endNodeOffset = end - charCount;
      }
      charCount += len;
    } else {
      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }
    }
  };

  walk(container);

  if (!startNode) {
    const range = document.createRange();
    range.selectNodeContents(container);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }

  const range = document.createRange();
  range.setStart(startNode, startNodeOffset);
  if (endNode) {
    range.setEnd(endNode, endNodeOffset);
  } else {
    range.collapse(true);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
