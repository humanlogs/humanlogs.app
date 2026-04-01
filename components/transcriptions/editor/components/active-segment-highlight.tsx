"use client";

import { useEffect, useRef, useState } from "react";
import { EditorAPI } from "../hooks/editor-api-tiptap";

interface ActiveSegmentHighlightProps {
  editorAPIRef: { current: EditorAPI };
  segmentIndex: number;
  visible: boolean;
}

interface HighlightPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Renders an absolutely positioned overlay that highlights the active segment
 * Uses Range API to calculate precise bounding rectangles
 */
export function ActiveSegmentHighlight({
  editorAPIRef,
  segmentIndex,
  visible,
}: ActiveSegmentHighlightProps) {
  const [position, setPosition] = useState<HighlightPosition | null>(null);
  const [enableTransition, setEnableTransition] = useState(true);
  const lastChangeTimeRef = useRef<number>(0);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Disable transition during rapid navigation
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastChange = now - lastChangeTimeRef.current;
    lastChangeTimeRef.current = now;

    // If changing within 200ms, disable transition
    if (timeSinceLastChange < 200) {
      setEnableTransition(false);

      // Clear any pending timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      // Re-enable transition after 300ms of no changes
      transitionTimeoutRef.current = setTimeout(() => {
        setEnableTransition(true);
      }, 300);
    }

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [segmentIndex]);

  useEffect(() => {
    if (!visible || segmentIndex < 0 || !editorAPIRef.current.ready()) {
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const segmentBounds = editorAPIRef.current.getSegmentBounds(segmentIndex);
      const editorBounds = editorAPIRef.current.getBoundingClientRect();

      if (!segmentBounds || !editorBounds) {
        setPosition(null);
        return;
      }

      // Calculate position relative to the editor container
      setPosition({
        top: segmentBounds.top - editorBounds.top,
        left: segmentBounds.left - editorBounds.left,
        width: segmentBounds.width,
        height: segmentBounds.height,
      });
    };

    // Initial position
    updatePosition();

    // Update on scroll (the editor itself might scroll)
    const cleanupScroll = editorAPIRef.current.addEventListener(
      "scroll",
      updatePosition,
    );

    // Update on window resize/scroll
    const handleWindowEvent = () => updatePosition();
    window.addEventListener("scroll", handleWindowEvent, true);
    window.addEventListener("resize", handleWindowEvent);

    // Update on editor mutations (content changes)
    const cleanupMutations =
      editorAPIRef.current.observeMutations(updatePosition);

    return () => {
      cleanupScroll();
      cleanupMutations();
      window.removeEventListener("scroll", handleWindowEvent, true);
      window.removeEventListener("resize", handleWindowEvent);
    };
  }, [segmentIndex, visible]);

  if (!position) {
    return null;
  }

  return (
    <div
      className={`absolute pointer-events-none rounded ${
        enableTransition
          ? "transition-all duration-150 ease-out"
          : "transition-all duration-50 ease-out"
      }`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        backgroundColor:
          "color-mix(in oklab, var(--color-blue-500) 25%, transparent)",
        outline:
          "1px solid color-mix(in oklab, var(--color-blue-500) 50%, transparent)",
        outlineOffset: "1px",
        zIndex: 1,
      }}
    />
  );
}
