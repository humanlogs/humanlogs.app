"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { TranscriptionSegment } from "../../../../hooks/use-api";

export interface NavigationState {
  isFocused: boolean;
  isManualNavigation: boolean;
  activeSegmentIndex: number | null;
}

export function useNavigationMode(
  editorRef: RefObject<HTMLDivElement | null>,
  segments: TranscriptionSegment[],
  audioControls: {
    isPlaying: boolean;
    togglePlayPause: () => void;
    pause: () => void;
    play: () => void;
    seekTo: (time: number) => void;
    playSegment: (start: number, end: number) => void;
  } | null,
) {
  // Three states:
  // 1. Audio playing: !isFocused && !isManualNavigation && isPlaying
  // 2. Manual navigation: !isFocused && isManualNavigation
  // 3. Editing: isFocused
  const [isFocused, setIsFocused] = useState(false);
  const [isManualNavigation, setIsManualNavigation] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(
    null,
  );
  const isNavigatingRef = useRef(false);
  const navigationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Debug logging
  useEffect(() => {
    const currentState = isFocused
      ? "EDITING"
      : isManualNavigation
        ? "MANUAL_NAV"
        : audioControls?.isPlaying
          ? "AUDIO_PLAYING"
          : "IDLE";

    console.log("[NavigationMode] State change:", {
      state: currentState,
      isFocused,
      isManualNavigation,
      isPlaying: audioControls?.isPlaying,
      activeSegmentIndex,
      hasAudioControls: !!audioControls,
      segmentsCount: segments.length,
    });
  }, [
    isFocused,
    isManualNavigation,
    activeSegmentIndex,
    audioControls,
    segments.length,
  ]);

  // Find the segment element by index
  const getSegmentElement = useCallback(
    (index: number): HTMLElement | null => {
      if (!editorRef.current) return null;
      const element = editorRef.current.querySelector(
        `[data-index="${index}"]`,
      );
      return element as HTMLElement | null;
    },
    [editorRef],
  );

  // Set selection to a specific segment
  const selectSegment = useCallback(
    (index: number) => {
      const element = getSegmentElement(index);
      if (!element) return;

      const segment = segments[index];
      const range = document.createRange();
      const selection = window.getSelection();

      if (!selection) return;

      if (segment.type === "spacing") {
        // For spacing, put cursor at the beginning
        const firstNode = element.firstChild || element;
        range.setStart(firstNode, 0);
        range.setEnd(firstNode, 0);
      } else {
        // For word, select the entire content
        range.selectNodeContents(element);
      }

      selection.removeAllRanges();
      selection.addRange(range);

      // Scroll into view if needed
      element.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [getSegmentElement, segments],
  );

  // Enter editing mode (state 3)
  const enterEditingMode = useCallback(
    (selectActive = true) => {
      console.log("[NavigationMode] Entering editing mode (state 3)", {
        selectActive,
        activeSegmentIndex,
      });
      setIsFocused(true);
      setIsManualNavigation(false);
      audioControls?.pause();

      if (selectActive && activeSegmentIndex !== null) {
        selectSegment(activeSegmentIndex);
      }

      editorRef.current?.focus();
    },
    [activeSegmentIndex, selectSegment, audioControls, editorRef],
  );

  // Exit editing mode to manual navigation (state 2)
  const exitToManualNavigation = useCallback(() => {
    console.log("[NavigationMode] Exiting to manual navigation (state 2)");
    setIsFocused(false);
    setIsManualNavigation(true);
    audioControls?.pause();
    // Clear selection
    const selection = window.getSelection();
    selection?.removeAllRanges();
  }, [audioControls]);

  // Exit editing mode to audio playing (state 1)
  const exitToAudioPlaying = useCallback(() => {
    console.log("[NavigationMode] Exiting to audio playing (state 1)");
    setIsFocused(false);
    setIsManualNavigation(false);
    // Clear selection
    const selection = window.getSelection();
    selection?.removeAllRanges();
    // Start audio if not already playing
    if (audioControls && !audioControls.isPlaying) {
      audioControls.play();
    }
  }, [audioControls]);

  // Enter manual navigation mode from audio playing (state 1 -> 2)
  const enterManualNavigation = useCallback(() => {
    console.log(
      "[NavigationMode] Entering manual navigation from audio (state 1 -> 2)",
    );
    setIsManualNavigation(true);
    audioControls?.pause();
  }, [audioControls]);

  // Exit manual navigation to audio playing (state 2 -> 1)
  const exitManualNavigationToAudio = useCallback(() => {
    console.log(
      "[NavigationMode] Exiting manual navigation to audio (state 2 -> 1)",
    );
    setIsManualNavigation(false);
    // Start/resume audio
    if (audioControls) {
      if (!audioControls.isPlaying) {
        audioControls.play();
      }
    }
  }, [audioControls]);

  // Navigate to next/previous segment
  const navigateSegment = useCallback(
    (direction: "next" | "previous") => {
      console.log("[NavigationMode] Navigating:", direction, {
        activeSegmentIndex,
        isManualNavigation,
        hasAudioControls: !!audioControls,
      });

      isNavigatingRef.current = true;

      // If coming from audio playing state, enter manual navigation
      if (!isManualNavigation && !isFocused) {
        enterManualNavigation();
      }

      let newIndex: number;
      if (activeSegmentIndex === null) {
        // Start from first word segment
        newIndex = segments.findIndex((s) => s.type === "word");
        console.log(
          "[NavigationMode] Starting from first word segment:",
          newIndex,
        );
      } else {
        // Find next/previous word segment
        const step = direction === "next" ? 1 : -1;
        newIndex = activeSegmentIndex + step;

        // Skip spacing segments
        while (
          newIndex >= 0 &&
          newIndex < segments.length &&
          segments[newIndex].type !== "word"
        ) {
          newIndex += step;
        }
        console.log(
          "[NavigationMode] New index after skipping spacing:",
          newIndex,
        );
      }

      // Bounds check
      if (newIndex < 0 || newIndex >= segments.length) {
        console.log("[NavigationMode] Out of bounds:", newIndex);
        isNavigatingRef.current = false;
        return;
      }

      const segment = segments[newIndex];
      if (segment.type !== "word" || segment.start === undefined) {
        console.log("[NavigationMode] Invalid segment:", segment);
        isNavigatingRef.current = false;
        return;
      }

      console.log(
        "[NavigationMode] Setting active segment:",
        newIndex,
        segment,
      );
      setActiveSegmentIndex(newIndex);

      // Highlight the segment
      const element = getSegmentElement(newIndex);
      if (element) {
        console.log("[NavigationMode] Highlighting element:", element);
        element.scrollIntoView({ block: "nearest", behavior: "smooth" });
        element.classList.add("active-segment");
        // Remove class from other segments
        editorRef.current?.querySelectorAll(".active-segment").forEach((el) => {
          if (el !== element) el.classList.remove("active-segment");
        });
      } else {
        console.log("[NavigationMode] Element not found for index:", newIndex);
      }

      // Play the segment audio
      if (segment.end !== undefined && audioControls) {
        console.log(
          "[NavigationMode] Playing segment audio:",
          segment.start,
          segment.end,
        );
        audioControls.playSegment(segment.start, segment.end);
      } else {
        console.log("[NavigationMode] Cannot play audio:", {
          hasEnd: !!segment.end,
          hasAudioControls: !!audioControls,
        });
      }

      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 100);
    },
    [
      activeSegmentIndex,
      isManualNavigation,
      isFocused,
      segments,
      audioControls,
      getSegmentElement,
      editorRef,
      enterManualNavigation,
    ],
  );

  // Start continuous navigation (when holding arrow key)
  const startContinuousNavigation = useCallback(
    (direction: "next" | "previous") => {
      console.log(
        "[NavigationMode] Starting continuous navigation:",
        direction,
      );
      if (navigationIntervalRef.current) return;

      navigateSegment(direction);

      // Calculate interval based on average segment duration
      const avgDuration = 0.3; // Default 300ms if we can't calculate
      navigationIntervalRef.current = setInterval(() => {
        navigateSegment(direction);
      }, avgDuration * 1000);
    },
    [navigateSegment],
  );

  // Stop continuous navigation
  const stopContinuousNavigation = useCallback(() => {
    console.log("[NavigationMode] Stopping continuous navigation");
    if (navigationIntervalRef.current) {
      clearInterval(navigationIntervalRef.current);
      navigationIntervalRef.current = null;
    }
  }, []);

  // Space: handle based on state
  // - If in manual navigation (state 2), start audio (state 2 -> 1)
  // - If in audio playing or idle, toggle play/pause
  useHotkeys(
    "space",
    (e) => {
      console.log("[NavigationMode] Space pressed", {
        isFocused,
        isManualNavigation,
        isPlaying: audioControls?.isPlaying,
      });
      if (isFocused) return;

      e.preventDefault();

      if (isManualNavigation) {
        // State 2 -> State 1: exit manual nav and start audio
        exitManualNavigationToAudio();
      } else {
        // Just toggle play/pause
        audioControls?.togglePlayPause();
      }
    },
    {
      enabled: !isFocused,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isFocused, isManualNavigation, audioControls, exitManualNavigationToAudio],
  );

  // Arrow keys: navigate segments (unfocused mode)
  useHotkeys(
    "right,down",
    (e) => {
      console.log("[NavigationMode] Right/Down arrow pressed", { isFocused });
      if (isFocused) return;
      e.preventDefault();
      if (!isNavigatingRef.current) {
        startContinuousNavigation("next");
      }
    },
    {
      enabled: !isFocused,
      enableOnContentEditable: true,
      preventDefault: true,
      keydown: true,
    },
    [isFocused, startContinuousNavigation],
  );

  useHotkeys(
    "left,up",
    (e) => {
      console.log("[NavigationMode] Left/Up arrow pressed", { isFocused });
      if (isFocused) return;
      e.preventDefault();
      if (!isNavigatingRef.current) {
        startContinuousNavigation("previous");
      }
    },
    {
      enabled: !isFocused,
      enableOnContentEditable: true,
      preventDefault: true,
      keydown: true,
    },
    [isFocused, startContinuousNavigation],
  );

  // Stop navigation on arrow key release
  useHotkeys(
    "right,down,left,up",
    () => {
      console.log("[NavigationMode] Arrow key released");
      stopContinuousNavigation();
    },
    {
      enabled: !isFocused,
      enableOnContentEditable: true,
      keyup: true,
    },
    [isFocused, stopContinuousNavigation],
  );

  // Enter: enter editing mode (state 1 or 2 -> 3)
  useHotkeys(
    "enter",
    (e) => {
      console.log("[NavigationMode] Enter pressed", {
        isFocused,
        isManualNavigation,
      });
      if (isFocused) return;
      e.preventDefault();
      enterEditingMode();
    },
    {
      enabled: !isFocused,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isFocused, enterEditingMode],
  );

  // Escape: exit editing mode to manual navigation (state 3 -> 2)
  useHotkeys(
    "escape",
    (e) => {
      console.log("[NavigationMode] Escape pressed", { isFocused });
      if (!isFocused) return;
      e.preventDefault();
      exitToManualNavigation();
    },
    {
      enabled: isFocused,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isFocused, exitToManualNavigation],
  );

  // Modified Space: exit editing mode to audio playing (state 3 -> 1)
  useHotkeys(
    "alt+space,ctrl+space,meta+space,shift+space",
    (e) => {
      console.log("[NavigationMode] Modified Space pressed", { isFocused });
      if (!isFocused) return;
      e.preventDefault();
      exitToAudioPlaying();
    },
    {
      enabled: isFocused,
      enableOnContentEditable: true,
      preventDefault: true,
    },
    [isFocused, exitToAudioPlaying],
  );

  // Detect when editor gets native focus (clicked) - enter editing mode
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleFocus = () => {
      console.log("[NavigationMode] Editor focus event (clicked)");
      setIsFocused(true);
      setIsManualNavigation(false);
      audioControls?.pause();
    };

    const handleBlur = () => {
      console.log("[NavigationMode] Editor blur event");
      // Only exit editing mode if focus truly left the editor
      setTimeout(() => {
        if (
          !document.activeElement ||
          !editor.contains(document.activeElement)
        ) {
          console.log(
            "[NavigationMode] Editor lost focus - exiting to manual navigation",
          );
          setIsFocused(false);
          setIsManualNavigation(true); // Exit to manual navigation, not audio playing
        }
      }, 0);
    };

    editor.addEventListener("focus", handleFocus);
    editor.addEventListener("blur", handleBlur);

    return () => {
      editor.removeEventListener("focus", handleFocus);
      editor.removeEventListener("blur", handleBlur);
    };
  }, [editorRef, audioControls]);

  // Clear manual navigation highlight when audio is playing
  useEffect(() => {
    if (!isManualNavigation && !isFocused && editorRef.current) {
      // Remove active-segment class when not in manual navigation
      editorRef.current.querySelectorAll(".active-segment").forEach((el) => {
        el.classList.remove("active-segment");
      });
    }
  }, [isManualNavigation, isFocused, editorRef]);

  return {
    isFocused,
    isManualNavigation,
    activeSegmentIndex,
    setActiveSegmentIndex,
    enterEditingMode,
    exitToManualNavigation,
    exitToAudioPlaying,
    navigateSegment,
  };
}
