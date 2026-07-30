"use client";

import { useCustomShortcuts } from "@/hooks/use-shortcuts";
import { CustomShortcut } from "@/components/transcriptions/editor/text/utils/shortcuts";
import {
  ensureWordIndex,
  orderedRange,
  stepSentence,
  stepToPunctuation,
  stepWord,
  type SegmentRange,
} from "@/components/transcriptions/editor/text/utils/segment-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAnyModalOpen } from "../../../../use-modal";
import { EditorAPI } from "../api";
import { AudioControls } from "../../audio/helpers";

export type NavigationState = "edit" | "navigate";

/**
 * Smart window scroll that automatically uses instant scroll if called
 * multiple times within the animation delay period.
 */
const createSmartScroll = () => {
  let lastScrollTime = 0;
  const ANIMATION_DURATION = 300; // Smooth scroll animation duration in ms

  return (targetY: number) => {
    const now = Date.now();
    const timeSinceLastScroll = now - lastScrollTime;

    // Use instant scroll if we're requesting a new scroll before the previous one finished
    const behavior =
      timeSinceLastScroll < ANIMATION_DURATION ? "instant" : "smooth";

    window.scrollTo({
      top: targetY,
      behavior: behavior as ScrollBehavior,
    });

    lastScrollTime = now;
  };
};

export function useNavigationMode(
  editorAPI: EditorAPI,
  audioControls: AudioControls | null,
  options?: {
    /**
     * The document cannot be typed into (the coding phase). Editing shortcuts —
     * Enter, Delete, "type a letter to start editing" — are then inert, so the
     * letters stay free for the code shortcuts and no keystroke can slip an edit
     * into a transcript the researcher is only reading.
     */
    readOnly?: boolean;
  },
) {
  const readOnly = options?.readOnly ?? false;
  const [state, setState] = useState<NavigationState>("navigate");
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  /**
   * Where a keyboard selection started, or null when nothing is selected. The moving
   * end is `currentIndex`, so growing a selection and moving the active word are the
   * same operation seen from two sides.
   */
  const [selectionAnchor, setSelectionAnchor] = useState<number | null>(null);
  const isModalOpen = useAnyModalOpen();
  const lastNavigationTime = useRef<number>(0);
  const smartScrollRef = useRef(createSmartScroll());
  const { data: customShortcuts = [] } = useCustomShortcuts();

  useEffect(() => {
    if (isModalOpen) {
      editorAPI.blur();
      audioControls?.pause();
    }
  }, [isModalOpen, audioControls]);

  useEffect(() => {
    if (!audioControls) return;
    const unsubscribe = audioControls.onTimeUpdate((currentTime) => {
        if (Date.now() - lastNavigationTime.current < 500) return;
        // Update the current index based on the current time
        const currentSegmentIndex = editorAPI
          .getSegments()
          .findIndex(
            (segment) =>
              segment.start !== undefined &&
              segment.end !== undefined &&
              currentTime >= segment.start &&
              currentTime <= segment.end,
          );
        // Only update if a matching segment was found — avoids scrolling to
        // position 0 when audio is past all timestamps or on words with no timing
        if (currentSegmentIndex !== -1) {
          setCurrentIndex(
            ensureWordIndex(currentSegmentIndex, editorAPI.getSegments(), "r"),
          );
        }
      });
    return unsubscribe;
  }, [audioControls, state]);

  // Show the currently selected segment in the editor
  useEffect(() => {
    if (state === "navigate") {
      if (currentIndex !== -1) {
        editorAPI.clearActiveSegments();
        const rect = editorAPI.getSegmentBounds(currentIndex);
        if (rect) {
          // Scrolling strategy
          const headerHeight =
            document.querySelector("header")?.getBoundingClientRect().height ||
            0;
          const viewportHeight = window.innerHeight;
          const topMargin = Math.max(viewportHeight * 0.2, 100);
          const bottomMargin = viewportHeight * 0.8;
          const visibleTop = headerHeight + topMargin;
          const visibleBottom = bottomMargin;
          if (!(rect.top >= visibleTop && rect.bottom <= visibleBottom)) {
            const targetY =
              rect.top >= visibleTop
                ? window.pageYOffset + (rect.top - visibleBottom)
                : window.pageYOffset + (rect.top - visibleTop);
            smartScrollRef.current(targetY);
          }
        }
      }
    } else {
      editorAPI.clearActiveSegments();
    }
  }, [currentIndex, state]);

  // Bind the state to the focus of the editor
  useEffect(() => {
    const handleFocus = () => {
      audioControls?.pause();
      setState("edit");
    };
    const handleBlur = () => {
      // Unselect any text in the editor
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      setState("navigate");
    };
    editorAPI.addListener("focus", handleFocus);
    editorAPI.addListener("blur", handleBlur);
    return () => {
      editorAPI.removeListener("focus", handleFocus);
      editorAPI.removeListener("blur", handleBlur);
    };
  }, [audioControls, setState]);

  // Bind the state of the playing audio to the navigate mode: if the audio is playing, we are in navigate mode, if it's paused, we are in edit mode
  useEffect(() => {
    if (audioControls?.isPlaying && state !== "navigate") {
      editorAPI.blur();
    }
  }, [audioControls?.isPlaying, setState, state]);

  // Arrows: move into editorAPI.getSegments()
  // Space = play / pause
  // Arrow on the right or bottom, do not stop play
  // Arrow on the left / top: stop playback
  // Shift + arrow, get back to the first word or the previous sentence / next sentence
  // Maintain shift while in play mode: goes to x2 playback + ctrl goes to x4 playback
  // Maintain ctrl while in play mode: goes to x0.5 playback

  // Play / Pause.
  //
  // This is the transcription's most-used shortcut, so we own the key handling
  // directly (a capture-phase document listener) instead of going through
  // react-hotkeys-hook, which was delivering these unreliably. It stays fully
  // deterministic and works the same whether or not you're typing:
  //
  //  - Tab           → always toggles. Because starting playback drops you back
  //                    into navigate mode, this is what lets you PAUSE mid-play
  //                    without reaching for the mouse. Blurs the editor first if
  //                    you were editing.
  //  - Space         → toggles when you're NOT typing (navigate mode). Plain
  //                    Space keeps typing a normal space inside the editor.
  //  - Alt/Ctrl+Space→ toggles even WHILE editing, so you can pause without
  //                    leaving the text (Windows still reserves these at the OS
  //                    level, hence Tab as the universal fallback).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;

      const el = (e.target as HTMLElement) ?? null;
      const tag = el?.tagName;
      // Never hijack real form typing.
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const editing = !!el?.isContentEditable;
      const hasModifier = e.altKey || e.ctrlKey || e.metaKey;

      if (e.code === "Tab") {
        e.preventDefault();
        if (editing) editorAPI.blur();
        audioControls?.togglePlayPause();
        return;
      }

      if (e.code === "Space") {
        // Plain Space types inside the editor; only a modifier turns it into a
        // toggle there.
        if (editing && !hasModifier) return;
        // When not editing, leave Space to activate a focused button/link.
        if (!editing) {
          const role = el?.getAttribute?.("role");
          if (
            tag === "BUTTON" ||
            tag === "A" ||
            role === "button" ||
            role === "link"
          ) {
            return;
          }
        }
        e.preventDefault();
        audioControls?.togglePlayPause();
      }
    };

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [audioControls, editorAPI, isModalOpen]);
  useHotkeys(
    ["alt", "ctrl", "alt+ctrl"],
    (event) => {
      if (state !== "navigate") return;
      event.preventDefault();

      if (event.altKey && event.ctrlKey) {
        audioControls?.setPlaybackSpeed(4);
      } else if (event.altKey) {
        audioControls?.setPlaybackSpeed(0.5);
      } else if (event.ctrlKey) {
        audioControls?.setPlaybackSpeed(2);
      } else {
        audioControls?.setPlaybackSpeed(1);
      }
    },
    {
      keyup: true,
      keydown: true,
    },
    [state, audioControls],
  );

  // Navigate in editorAPI.getSegments()
  //
  //  - arrows        → one word (and one line, up/down)
  //  - Ctrl + arrows → one sentence. This used to be Shift; Shift now grows a
  //                    selection, which the coding phase needs and which reads the
  //                    same way it does in every other text surface.
  //  - Shift + ←/→   → one more / one less word in the selection
  //  - Shift + ↑/↓   → out to the next / previous punctuation
  useHotkeys(
    [
      "ArrowRight",
      "ArrowDown",
      "ArrowLeft",
      "ArrowUp",
      "Shift+ArrowRight",
      "Shift+ArrowDown",
      "Shift+ArrowLeft",
      "Shift+ArrowUp",
      "Ctrl+ArrowRight",
      "Ctrl+ArrowDown",
      "Ctrl+ArrowLeft",
      "Ctrl+ArrowUp",
    ],
    (event) => {
      if (state !== "navigate") return;
      event.preventDefault();

      lastNavigationTime.current = Date.now();

      // Back arrows stop the playback
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        audioControls?.pause();
      }

      const segments = editorAPI.getSegments();
      if (segments.length === 0) return;

      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      const direction: "r" | "l" = forward ? "r" : "l";
      let selection = 0;

      if (currentIndex !== -1) {
        selection = currentIndex;

        if (event.shiftKey) {
          // Growing a selection: one word sideways, a whole clause vertically.
          selection =
            event.key === "ArrowUp" || event.key === "ArrowDown"
              ? stepToPunctuation(segments, currentIndex, direction)
              : stepWord(segments, currentIndex, direction);
        } else if (event.ctrlKey || event.metaKey) {
          selection = stepSentence(segments, currentIndex, direction);
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          // Line movement: find the segment that is the closest in the DOM.
          selection = closestSegmentOnNextLine(
            editorAPI,
            currentIndex,
            forward ? 1 : -1,
          );
          selection = ensureWordIndex(selection, segments, direction);
        } else {
          selection = stepWord(segments, currentIndex, direction);
        }
      }

      // Shift keeps (or opens) the selection; anything else collapses it, which is
      // what makes a plain arrow the way out of a selection you no longer want.
      if (event.shiftKey) {
        setSelectionAnchor((anchor) =>
          anchor === null ? (currentIndex === -1 ? selection : currentIndex) : anchor,
        );
      } else {
        setSelectionAnchor(null);
      }

      audioControls?.seekTo(
        segments[Math.max(0, Math.min(segments.length - 1, selection))].start ||
          0,
      );
      setCurrentIndex(selection);
    },
    {},
    [state, audioControls, currentIndex],
  );

  /**
   * The current keyboard selection, or null when the active word is just a caret.
   * Mirrored into the ProseMirror selection below so the rest of the editor — coding,
   * comments, the floating bar — reads one notion of "what is selected".
   */
  const selection: SegmentRange | null =
    selectionAnchor === null || currentIndex === -1
      ? null
      : orderedRange(selectionAnchor, currentIndex);

  useEffect(() => {
    if (state !== "navigate") return;
    if (selection) editorAPI.selectSegmentRange(selection.from, selection.to);
    // A collapsed selection is not pushed back into the editor: navigate mode
    // already draws the active word itself, and clearing the document selection on
    // every arrow press would fight the click-to-select the mouse still does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.from, selection?.to, state]);

  useHotkeys(
    ["Delete", "Backspace"],

    (event) => {
      if (isModalOpen) return;
      if (readOnly) return;
      if (state !== "navigate") return;
      event.preventDefault();

      // Select the current segment and focus the editor
      editorAPI.focus(currentIndex, true); // true = select the segment content

      // If a letter was typed or there's a custom shortcut replacement, insert that text
      editorAPI.execCommand("delete");

      const nextDomElement =
        editorAPI.getSegmentNode(currentIndex - 1) ||
        editorAPI.getSegmentNode(currentIndex + 1);
      if (nextDomElement) {
        const range = document.createRange();
        range.selectNodeContents(nextDomElement);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        if (event.key === "Delete") {
          selection?.setPosition(range.endContainer);
        } else {
          selection?.setPosition(range.startContainer);
        }
      }
    },
    {},
    [isModalOpen, readOnly, state, currentIndex],
  );

  // "Enter" key enters in focus mode and select the current word
  // Any letter or shift+letter or number, or accent also trigger the focus mode, but also add that letter there
  useHotkeys(
    ["Enter", "*"],
    (event) => {
      if (isModalOpen) return;

      // If something not being the editor is focused, do not trigger this shortcut, except if it's a custom shortcut
      if (
        // Is focussing an input, select or textarea element
        document.activeElement &&
        ["INPUT", "SELECT", "TEXTAREA"].includes(
          document.activeElement.tagName,
        ) &&
        // Is focussing an element outside of the editor
        editorAPI.isFocused() === false
      ) {
        return;
      }

      // The coding phase never types into the document: letters drive the code
      // shortcuts there, and Enter/Escape belong to the coding bar.
      if (readOnly) return;

      const replacement = handleCustomShortcut(event, customShortcuts);

      if (state !== "navigate" && !replacement) return;

      if (!replacement) {
        // Do not trigger if it's a shortcut (e.g. cmd + b, alt + shift + f, etc.)
        if (event.metaKey || event.altKey || event.ctrlKey) {
          return;
        }

        // Do not trigger for FN keys, arrows, etc.
        if (event.key.length > 1 && event.key !== "Enter") {
          return;
        }

        // Do not trigger on space
        if (event.key === " ") {
          return;
        }
      }

      event.preventDefault();

      // Set the selection range
      if (state === "navigate") {
        editorAPI.focus(currentIndex, true); // true = select the segment content
      } else {
        // In edit mode, just focus to maintain existing selection
        editorAPI.focus();
      }

      // If a letter was typed or there's a custom shortcut replacement, insert that text
      if (replacement) {
        editorAPI.execCommand("insertText", replacement);
      } else if (event.key.length === 1) {
        editorAPI.execCommand("insertText", event.key);
      }
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
    [isModalOpen, readOnly, state, currentIndex, customShortcuts],
  );

  /**
   * Move the active word to whatever sits at `charOffset` in the flat projection, and
   * take the audio with it.
   *
   * Needed whenever the UI jumps somewhere the caret alone doesn't account for — opening
   * a comment thread selects a *range*, which useAudioSync deliberately ignores, so
   * without this the active word stays where it was and the next scroll drags the page
   * back to the old position.
   */
  const goToOffset = useCallback(
    (charOffset: number) => {
      const segments = editorAPI.getSegments();
      if (segments.length === 0) return;

      let index = segments.length - 1;
      let charCount = 0;
      for (let i = 0; i < segments.length; i++) {
        const segmentEnd = charCount + segments[i].text.length;
        if (charOffset < segmentEnd) {
          index = i;
          break;
        }
        charCount = segmentEnd;
      }
      index = ensureWordIndex(index, segments, "r");

      // Keep the audio-time watcher from overwriting us before the seek lands.
      lastNavigationTime.current = Date.now();
      setCurrentIndex(index);
      const start = segments[index]?.start;
      if (start !== undefined) audioControls?.seekTo(start);
    },
    [editorAPI, audioControls],
  );

  useHotkeys(
    ["Escape"],
    (event) => {
      if (isModalOpen) return;
      // Escape means "get me out of what I am in": out of the text while editing,
      // out of a selection while navigating.
      if (state === "edit") {
        event.preventDefault();
        editorAPI.blur();
        return;
      }
      if (selectionAnchor !== null) {
        event.preventDefault();
        setSelectionAnchor(null);
      }
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
    [isModalOpen, state, selectionAnchor],
  );

  return {
    state,
    currentIndex,
    selection,
    goToOffset,
  };
}

const differentVerticalLine = (rect: DOMRect, rectCandidate: DOMRect) => {
  return (
    rect.top + rect.height * 0.75 <= rectCandidate.top ||
    rect.top >= rectCandidate.top + rectCandidate.height * 0.75
  );
};

/**
 * The segment on the next (or previous) visual line closest to the current one
 * horizontally — what a plain Up/Down arrow lands on. Measured from the DOM because
 * line breaks are a layout fact: the projection knows nothing about where the text
 * wraps.
 */
const closestSegmentOnNextLine = (
  editorAPI: EditorAPI,
  currentIndex: number,
  direction: 1 | -1,
): number => {
  const segments = editorAPI.getSegments();
  const currentRect = editorAPI.getSegmentBounds(currentIndex);
  if (!currentRect) return currentIndex + direction;

  let candidateIndex = currentIndex + direction;
  let foundLineChange = false;
  let closest = { index: currentIndex, distance: Infinity };

  while (candidateIndex >= 0 && candidateIndex < segments.length) {
    const candidateRect = editorAPI.getSegmentBounds(candidateIndex);
    if (!candidateRect) {
      candidateIndex += direction;
      continue;
    }

    if (differentVerticalLine(currentRect, candidateRect)) {
      foundLineChange = true;
      const horizontalDistance = Math.abs(candidateRect.left - currentRect.left);

      if (horizontalDistance < closest.distance) {
        closest = { index: candidateIndex, distance: horizontalDistance };
      }

      // Moving away horizontally: the best match on this line is behind us.
      if (closest.distance < Infinity && horizontalDistance > closest.distance) {
        break;
      }
    }

    candidateIndex += direction;
  }

  // No line change found: stay where we are rather than drift a word sideways.
  return foundLineChange ? closest.index : currentIndex;
};

// Check for custom shortcuts first
const handleCustomShortcut = (
  event: KeyboardEvent,
  customShortcuts: CustomShortcut[],
): string | null => {
  const parts: string[] = [];

  if (event.ctrlKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  if (event.metaKey) parts.push("meta");

  const key = event.key.toLowerCase();
  if (!["control", "alt", "shift", "meta"].includes(key)) {
    parts.push(key);
  }

  const combination = [parts.join("+")];

  if (combination[0].match(/ctrl\+shift\+[0-9]/)) {
    combination.push(combination[0].replace("+shift", ""));
  }

  const matchingShortcut = customShortcuts.find((s) =>
    combination.includes(s.key.toLowerCase()),
  );

  return matchingShortcut?.text || null;
};
