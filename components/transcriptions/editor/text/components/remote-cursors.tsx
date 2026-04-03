"use client";

import { UserCursor } from "@/hooks/use-transcription-cursors";
import { useEffect, useRef, useState } from "react";
import { EditorAPI } from "../api";

type CursorDisplayProps = {
  cursors: UserCursor[];
  editorAPI: EditorAPI;
};

type PositionedCursor = UserCursor & {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  selectionRects: DOMRect[];
};

// Generate a consistent color from a userId
export function getUserColor(userId: string): string {
  const colors = [
    "#f59e0b", // amber
    "#3b82f6", // blue
    "#10b981", // green
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

export function RemoteCursors({ cursors, editorAPI }: CursorDisplayProps) {
  const [positionedCursors, setPositionedCursors] = useState<
    PositionedCursor[]
  >([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const updateCursorPositions = () => {
      if (!editorAPI) return;

      const editorElement = editorAPI.getEditorElement();
      if (!editorElement) return;

      const editorRect = editorElement.getBoundingClientRect();
      const scrollLeft = editorElement.scrollLeft || 0;
      const scrollTop = editorElement.scrollTop || 0;

      const newPositions: PositionedCursor[] = [];

      for (const cursor of cursors) {
        try {
          // Get the start and end coordinates (viewport-relative)
          const startCoords = editorAPI.getCoordinatesAtOffset(
            cursor.startOffset,
          );
          const endCoords = editorAPI.getCoordinatesAtOffset(cursor.endOffset);

          if (!startCoords || !endCoords) continue;

          // Convert to editor-relative coordinates
          const startX = startCoords.left - editorRect.left + scrollLeft;
          const startY = startCoords.top - editorRect.top + scrollTop;
          const endX = endCoords.left - editorRect.left + scrollLeft;
          const endY = endCoords.top - editorRect.top + scrollTop;

          // Get selection rectangles for multi-line selections
          const selectionRects = editorAPI
            .getRangeClientRects(cursor.startOffset, cursor.endOffset)
            .filter((a) => a.width < editorRect.width); // Filter out any rects that are wider than the editor (can happen with certain node types)

          newPositions.push({
            ...cursor,
            startX,
            startY,
            endX,
            endY,
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

    window.addEventListener("scroll", handleUpdate);
    window.addEventListener("resize", handleUpdate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("scroll", handleUpdate);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [cursors, editorAPI]);

  // Adjust label positions to prevent cutoff
  useEffect(() => {
    if (!editorAPI) return;

    const editorRect = editorAPI.getBoundingClientRect();
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
  }, [positionedCursors, editorAPI]);

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
                const editorRect = editorAPI
                  ?.getEditorElement()
                  ?.getBoundingClientRect();
                if (!editorRect) return null;

                return (
                  <div
                    key={`${cursor.socketId}-selection-${index}`}
                    className="pointer-events-none absolute"
                    style={{
                      left: `${rect.left - editorRect.left + (editorAPI?.getEditorElement()?.scrollLeft || 0)}px`,
                      top: `${rect.top - editorRect.top + (editorAPI?.getEditorElement()?.scrollTop || 0)}px`,
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
                className="absolute -top-6 whitespace-nowrap rounded px-1 py-0.5 text-xs font-medium text-white shadow-lg"
                style={{
                  backgroundColor: color,
                }}
              >
                {cursor.userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toLocaleUpperCase()}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
