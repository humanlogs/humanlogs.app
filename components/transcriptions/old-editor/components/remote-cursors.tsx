"use client";

import { useEffect, useState, useRef } from "react";
import { UserCursor } from "@/hooks/use-transcription-cursors";

type CursorDisplayProps = {
  cursors: UserCursor[];
  editorRef: React.RefObject<HTMLDivElement | null>;
};

type PositionedCursor = UserCursor & {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  selectionRects: DOMRect[];
};

// Generate a consistent color from a userId
function getUserColor(userId: string): string {
  const colors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#f59e0b", // amber
    "#ef4444", // red
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#f97316", // orange
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

// Get position for a character offset
function getPositionAtOffset(
  editorRef: React.RefObject<HTMLDivElement | null>,
  characterOffset: number,
): { x: number; y: number } | null {
  // Get the actual editor element (may be Tiptap's DOM)
  const editor =
    (editorRef.current as any)?._tiptapElement || editorRef.current;
  if (!editor) return null;

  const range = document.createRange();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);

  let currentOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const nodeLength = node.textContent?.length || 0;

    if (currentOffset + nodeLength >= characterOffset) {
      const offsetInNode = Math.min(
        characterOffset - currentOffset,
        nodeLength,
      );
      range.setStart(node, offsetInNode);
      range.setEnd(node, offsetInNode);

      const rect = range.getBoundingClientRect();
      const editorRect = editor.getBoundingClientRect();

      return {
        x: rect.left - editorRect.left + editor.scrollLeft,
        y: rect.top - editorRect.top + editor.scrollTop,
      };
    }

    currentOffset += nodeLength;
  }

  return null;
}

// Get selection rectangles between two character offsets
function getSelectionRects(
  editorRef: React.RefObject<HTMLDivElement | null>,
  startOffset: number,
  endOffset: number,
): DOMRect[] {
  if (startOffset === endOffset) return [];

  // Get the actual editor element (may be Tiptap's DOM)
  const editor =
    (editorRef.current as any)?._tiptapElement || editorRef.current;
  if (!editor) return [];

  const range = document.createRange();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);

  let currentOffset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;

  let node: Node | null;
  while ((node = walker.nextNode())) {
    const nodeLength = node.textContent?.length || 0;

    if (!startNode && currentOffset + nodeLength >= startOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    if (!endNode && currentOffset + nodeLength >= endOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset += nodeLength;
  }

  if (!startNode || !endNode) return [];

  try {
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
    return Array.from(range.getClientRects());
  } catch (error) {
    console.warn("Failed to get selection rects:", error);
    return [];
  }
}

export function RemoteCursors({ cursors, editorRef }: CursorDisplayProps) {
  const [positionedCursors, setPositionedCursors] = useState<
    PositionedCursor[]
  >([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const updateCursorPositions = () => {
      if (!editorRef.current) return;

      const newPositions: PositionedCursor[] = [];

      for (const cursor of cursors) {
        try {
          const startPos = getPositionAtOffset(editorRef, cursor.startOffset);
          const endPos = getPositionAtOffset(editorRef, cursor.endOffset);

          if (!startPos || !endPos) continue;

          const selectionRects = getSelectionRects(
            editorRef,
            cursor.startOffset,
            cursor.endOffset,
          );

          newPositions.push({
            ...cursor,
            startX: startPos.x,
            startY: startPos.y,
            endX: endPos.x,
            endY: endPos.y,
            selectionRects,
          });
        } catch (error) {
          console.warn("Failed to position cursor:", error);
        }
      }

      setPositionedCursors(newPositions);
    };

    // Initial update
    updateCursorPositions();

    // Update on scroll or resize
    const handleUpdate = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateCursorPositions);
    };

    editorRef.current?.addEventListener("scroll", handleUpdate);
    window.addEventListener("resize", handleUpdate);

    // Update when cursors change
    const interval = setInterval(updateCursorPositions, 100);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      editorRef.current?.removeEventListener("scroll", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
      clearInterval(interval);
    };
  }, [cursors, editorRef]);

  // Adjust label positions to prevent cutoff
  useEffect(() => {
    if (!editorRef.current) return;

    const editorRect = editorRef.current.getBoundingClientRect();
    const editorWidth = editorRect.width;

    labelRefs.current.forEach((label, socketId) => {
      if (!label) return;

      const labelRect = label.getBoundingClientRect();
      const labelWidth = labelRect.width;

      // Find the cursor position for this label
      const cursor = positionedCursors.find((c) => c.socketId === socketId);
      if (!cursor) return;

      const cursorX = cursor.startX;

      // Check if label would overflow right edge
      if (cursorX + labelWidth > editorWidth) {
        // Align label to the right of the cursor
        label.style.left = "auto";
        label.style.right = "0px";
        label.style.transform = `translateX(${editorWidth - cursorX}px)`;
      } else if (cursorX < 0) {
        // Label would overflow left edge
        label.style.left = "0px";
        label.style.right = "auto";
        label.style.transform = `translateX(${-cursorX}px)`;
      } else {
        // Normal positioning
        label.style.left = "0px";
        label.style.right = "auto";
        label.style.transform = "none";
      }
    });
  }, [positionedCursors, editorRef]);

  return (
    <>
      {positionedCursors.map((cursor) => {
        const color = getUserColor(cursor.userId);
        const hasSelection = cursor.startOffset !== cursor.endOffset;

        return (
          <div key={cursor.socketId}>
            {/* Selection highlight */}
            {hasSelection &&
              cursor.selectionRects.map((rect, index) => {
                const editorRect = editorRef.current?.getBoundingClientRect();
                if (!editorRect) return null;

                return (
                  <div
                    key={`${cursor.socketId}-selection-${index}`}
                    className="pointer-events-none absolute"
                    style={{
                      left: `${rect.left - editorRect.left + (editorRef.current?.scrollLeft || 0)}px`,
                      top: `${rect.top - editorRect.top + (editorRef.current?.scrollTop || 0)}px`,
                      width: `${rect.width}px`,
                      height: `${rect.height}px`,
                      backgroundColor: color,
                      opacity: 0.2,
                    }}
                  />
                );
              })}

            {/* Cursor indicator at the end of selection */}
            <div
              className="pointer-events-none absolute z-50 transition-all duration-100 ease-out"
              style={{
                left: `${cursor.endX}px`,
                top: `${cursor.endY}px`,
              }}
            >
              {/* Cursor line */}
              <div
                className="absolute h-5 w-0.5 animate-pulse"
                style={{
                  backgroundColor: color,
                }}
              />
              {/* User label */}
              <div
                ref={(el) => {
                  if (el) {
                    labelRefs.current.set(cursor.socketId, el);
                  } else {
                    labelRefs.current.delete(cursor.socketId);
                  }
                }}
                className="absolute -top-6 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium text-white shadow-lg"
                style={{
                  backgroundColor: color,
                }}
              >
                {cursor.userName}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
