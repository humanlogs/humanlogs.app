"use client";

import { useCustomShortcuts } from "@/hooks/use-shortcuts";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { CustomShortcut } from "@/lib/shortcuts";
import { useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useAnyModalOpen } from "../../../use-modal";
import { AudioControls } from "../interactive-audio";
import { EditorAPI } from "./editor-api-tiptap";
import { selectSegmentByIndexAndFocus } from "./editor-utils";

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
  editorAPIRef: { current: EditorAPI },
  audioControls: AudioControls | null,
) {
  const [state, setState] = useState<NavigationState>("navigate");
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const isModalOpen = useAnyModalOpen();
  const lastNavigationTime = useRef<number>(0);
  const smartScrollRef = useRef(createSmartScroll());
  const { data: customShortcuts = [] } = useCustomShortcuts();

  useEffect(() => {
    if (isModalOpen) {
      editorAPIRef.current.blur();
      audioControls?.pause();
    }
  }, [isModalOpen, audioControls]);

  useEffect(() => {
    if (audioControls)
      audioControls.onTimeUpdate((currentTime) => {
        if (Date.now() - lastNavigationTime.current < 500) return;
        // Update the current index based on the current time
        const currentSegmentIndex = editorAPIRef.current
          .getSegments()
          .findIndex(
            (segment) =>
              segment.start !== undefined &&
              segment.end !== undefined &&
              currentTime >= segment.start &&
              currentTime <= segment.end,
          );
        setCurrentIndex(
          ensureWord(
            currentSegmentIndex,
            editorAPIRef.current.getSegments(),
            "r",
          ),
        );
      });
  }, [audioControls, state]);

  // Show the currently selected segment in the editor
  useEffect(() => {
    if (state === "navigate") {
      if (currentIndex !== -1) {
        editorAPIRef.current.clearActiveSegments();
        const rect = editorAPIRef.current.getSegmentBounds(currentIndex);
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
      editorAPIRef.current.clearActiveSegments();
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
    const cleanupFocus = editorAPIRef.current.addEventListener(
      "focus",
      handleFocus,
    );
    const cleanupBlur = editorAPIRef.current.addEventListener(
      "blur",
      handleBlur,
    );
    return () => {
      cleanupFocus();
      cleanupBlur();
    };
  }, [audioControls, setState]);

  // Bind the state of the playing audio to the navigate mode: if the audio is playing, we are in navigate mode, if it's paused, we are in edit mode
  useEffect(() => {
    if (audioControls?.isPlaying && state !== "navigate") {
      editorAPIRef.current.blur();
    }
  }, [audioControls?.isPlaying, setState, state]);

  // Arrows: move into editorAPIRef.current.getSegments()
  // Space = play / pause
  // Arrow on the right or bottom, do not stop play
  // Arrow on the left / top: stop playback
  // Shift + arrow, get back to the first word or the previous sentence / next sentence
  // Maintain shift while in play mode: goes to x2 playback + ctrl goes to x4 playback
  // Maintain ctrl while in play mode: goes to x0.5 playback

  // Play / pause / change speed
  useHotkeys(
    ["space", "alt+space", "ctrl+space", "ctrl+alt+space"],
    (event) => {
      event.preventDefault();
      if (state !== "navigate") return;
      audioControls?.togglePlayPause();
    },
    {},
    [state, audioControls],
  );
  useHotkeys(
    ["alt+space"],
    (event) => {
      event.preventDefault();
      // Ignore if the editor is not focused
      if (state !== "edit") return;
      // Blur the editor to trigger the navigate mode and then toggle play/pause
      editorAPIRef.current.blur();
      audioControls?.togglePlayPause();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
    [state, audioControls],
  );
  useHotkeys(
    ["alt", "ctrl", "alt+ctrl"],
    (event) => {
      if (state !== "navigate") return;
      event.preventDefault();

      if (event.altKey && event.ctrlKey) {
        audioControls?.setPlaybackSpeed(4);
      } else if (event.altKey) {
        audioControls?.setPlaybackSpeed(2);
      } else if (event.ctrlKey) {
        audioControls?.setPlaybackSpeed(0.5);
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

  // Navigate in editorAPIRef.current.getSegments()
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
    ],
    (event) => {
      if (state !== "navigate") return;
      event.preventDefault();

      lastNavigationTime.current = Date.now();

      // Back arrows stop the playback
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        audioControls?.pause();
      }

      let selection = 0;

      if (currentIndex !== -1) {
        selection = currentIndex;

        // Find the next / previous segment or top / bottom segment in DOM and seek to it
        if (event.shiftKey) {
          // First first segment in the sentence starting by previous word
          // Or first word of next sentence
          // Basically start from previous / next word, then move up to one of this cases:
          // - Word or spacing contains a dot, exclamation mark or question mark (end of sentence) -> go to next word segment
          if (event.key === "ArrowRight") {
            let found = false;
            for (
              let i = currentIndex + 1;
              i < editorAPIRef.current.getSegments().length;
              i++
            ) {
              if (
                /.*[.!?].*/.test(editorAPIRef.current.getSegments()[i].text) ||
                (editorAPIRef.current.getSegments()[i].type === "spacing" &&
                  duration(editorAPIRef.current.getSegments()[i]) > 1)
              ) {
                selection = i;
                found = true;
                break;
              }
            }
            if (!found)
              selection = editorAPIRef.current.getSegments().length - 1;
          } else if (event.key === "ArrowLeft") {
            let found = false;
            for (let i = currentIndex - 3; i >= 0; i--) {
              console.log(editorAPIRef.current.getSegments()[i]);
              if (
                /.*[.!?].*/.test(editorAPIRef.current.getSegments()[i].text) ||
                (editorAPIRef.current.getSegments()[i].type === "spacing" &&
                  duration(editorAPIRef.current.getSegments()[i]) > 1)
              ) {
                selection = i;
                found = true;
                break;
              }
            }
            if (!found) selection = 0;
          }
          for (
            let i = selection + (selection > 0 ? 1 : 0);
            i < editorAPIRef.current.getSegments().length;
            i++
          ) {
            if (editorAPIRef.current.getSegments()[i].type === "word") {
              selection = i;
              break;
            }
          }
        } else {
          if (event.key === "ArrowRight") {
            selection = currentIndex + 1;
          } else if (event.key === "ArrowLeft") {
            selection = currentIndex - 1;
          }
        }

        // For up and down, find the segment that is the closest in the DOM
        // TODO: In plain text mode, this needs to be reimplemented using getSegmentBounds()
        // to find editorAPIRef.current.getSegments() on different lines
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const currentRect =
            editorAPIRef.current.getSegmentBounds(currentIndex);
          if (!currentRect) {
            // Fallback to simple left/right navigation
            selection =
              event.key === "ArrowDown" ? currentIndex + 1 : currentIndex - 1;
          } else {
            // Find the segment on the next/previous line that's closest horizontally
            const direction = event.key === "ArrowDown" ? 1 : -1;
            let candidateIndex = currentIndex + direction;
            let foundLineChange = false;
            let closest = { index: currentIndex, distance: Infinity };

            // Scan editorAPIRef.current.getSegments() to find one on a different line
            while (
              candidateIndex >= 0 &&
              candidateIndex < editorAPIRef.current.getSegments().length
            ) {
              const candidateRect =
                editorAPIRef.current.getSegmentBounds(candidateIndex);
              if (!candidateRect) {
                candidateIndex += direction;
                continue;
              }

              const isDifferentLine = differentVerticalLine(
                currentRect,
                candidateRect,
              );

              if (isDifferentLine) {
                foundLineChange = true;
                const horizontalDistance = Math.abs(
                  candidateRect.left - currentRect.left,
                );

                if (horizontalDistance < closest.distance) {
                  closest = {
                    index: candidateIndex,
                    distance: horizontalDistance,
                  };
                }

                // If we're moving away horizontally, we've found the best match on this line
                if (
                  closest.distance < Infinity &&
                  horizontalDistance > closest.distance
                ) {
                  break;
                }
              }

              candidateIndex += direction;
            }

            if (foundLineChange) {
              selection = closest.index;
            } else {
              // No line change found, stay on current segment
              selection = currentIndex;
            }
          }
        }

        // Ensure the selection is a word
        selection = ensureWord(
          selection,
          editorAPIRef.current.getSegments(),
          event.key === "ArrowRight" || event.key === "ArrowDown" ? "r" : "l",
        );
      }

      audioControls?.seekTo(
        editorAPIRef.current.getSegments()[
          Math.max(
            0,
            Math.min(editorAPIRef.current.getSegments().length, selection),
          )
        ].start || 0,
      );
      setCurrentIndex(selection);
    },
    {},
    [state, audioControls, currentIndex],
  );

  useHotkeys(
    ["Delete", "Backspace"],

    (event) => {
      if (isModalOpen) return;
      if (state !== "navigate") return;
      event.preventDefault();

      event.preventDefault();

      // Select the current segment and focus the editor
      selectSegmentByIndexAndFocus(editorAPIRef.current, currentIndex);

      // If a letter was typed or there's a custom shortcut replacement, insert that text
      document.execCommand("delete");

      const nextDomElement =
        editorAPIRef.current.getSegmentNode(currentIndex - 1) ||
        editorAPIRef.current.getSegmentNode(currentIndex + 1);
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
    [isModalOpen, state, currentIndex],
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
        editorAPIRef.current.isFocused() === false
      ) {
        return;
      }

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
        selectSegmentByIndexAndFocus(editorAPIRef.current, currentIndex);
      } else {
        // In edit mode, just focus to maintain existing selection
        editorAPIRef.current.focus();
      }

      // If a letter was typed or there's a custom shortcut replacement, insert that text
      if (replacement) {
        document.execCommand("insertText", false, replacement);
      } else if (event.key.length === 1) {
        document.execCommand("insertText", false, event.key);
      }
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
    [isModalOpen, state, currentIndex, customShortcuts],
  );

  useHotkeys(
    ["Escape"],
    (event) => {
      if (isModalOpen) return;
      if (state !== "edit") return;
      event.preventDefault();
      editorAPIRef.current.blur();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
    [isModalOpen, state],
  );

  return {
    state,
    currentIndex,
  };
}

const duration = (segment: TranscriptionSegment) => {
  if (!segment.start || !segment.end) return 0;
  return segment.end - segment.start;
};

const differentVerticalLine = (rect: DOMRect, rectCandidate: DOMRect) => {
  return (
    rect.top + rect.height * 0.75 <= rectCandidate.top ||
    rect.top >= rectCandidate.top + rectCandidate.height * 0.75
  );
};

const ensureWord = (
  selection: number,
  segments: TranscriptionSegment[],
  direction: "r" | "l",
) => {
  while (
    segments[selection] &&
    !(segments[selection].type === "word" || duration(segments[selection]) > 1)
  ) {
    if (direction === "r") {
      selection++;
    } else if (direction === "l") {
      selection--;
    }
  }
  return Math.max(0, Math.min(segments.length - 1, selection));
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
