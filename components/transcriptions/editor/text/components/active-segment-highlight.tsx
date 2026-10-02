"use client";

import { useEffect, useRef, useState } from "react";
import { EditorAPI } from "../api";
import { highlightBoxStyle } from "./highlight-box";

interface ActiveSegmentHighlightProps {
  editorAPI: EditorAPI;
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
  editorAPI,
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
      // Depends on elapsed wall-clock time between two changes, not on renderable
      // state — it cannot be derived during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (!visible || segmentIndex < 0 || !editorAPI.ready()) {
      // Measures the live DOM (segment bounds), which is only valid after layout.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosition(null);
      return;
    }

    const updatePosition = () => {
      const segmentBounds = editorAPI.getSegmentBounds(segmentIndex);
      const editorBounds = editorAPI.getBoundingClientRect();

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

    // Update on window resize/scroll
    const handleWindowEvent = () => updatePosition();
    window.addEventListener("scroll", handleWindowEvent, true);
    window.addEventListener("resize", handleWindowEvent);

    // Update on editor mutations (content changes)
    editorAPI.addListener("change", updatePosition);

    return () => {
      editorAPI.removeListener("change", updatePosition);
      window.removeEventListener("scroll", handleWindowEvent, true);
      window.removeEventListener("resize", handleWindowEvent);
    };
  }, [segmentIndex, visible]);

  if (!position) {
    return null;
  }

  return (
    <div
      className={`absolute pointer-events-none ${
        enableTransition
          ? "transition-all duration-150 ease-out"
          : "transition-all duration-50 ease-out"
      }`}
      // Shared with the selection overlay: the active word and the selection it grows
      // into are one object, so they must not be two designs. See highlight-box.ts.
      style={{
        ...highlightBoxStyle,
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: 1,
      }}
    />
  );
}
