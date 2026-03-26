"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { TranscriptionSegment } from "../../../../hooks/use-api";
import { AudioControls } from "../interactive-audio";

export type NavigationState = "edit" | "navigate";

export function useNavigationMode(
  editorRef: RefObject<HTMLDivElement | null>,
  segments: TranscriptionSegment[],
  audioControls: AudioControls | null,
) {
  const [state, setState] = useState<NavigationState>("navigate");
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const lastNavigationTime = useRef<number>(0);

  useEffect(() => {
    if (audioControls)
      audioControls.onTimeUpdate((currentTime) => {
        if (Date.now() - lastNavigationTime.current < 500) return;
        // Update the current index based on the current time
        const currentSegmentIndex = segments.findIndex(
          (segment) =>
            segment.start !== undefined &&
            segment.end !== undefined &&
            currentTime >= segment.start &&
            currentTime <= segment.end,
        );
        setCurrentIndex(ensureWord(currentSegmentIndex, segments, "r"));
      });
  }, [audioControls, segments, state]);

  // Show the currently selected segment in the editor
  useEffect(() => {
    if (state === "navigate") {
      if (currentIndex !== -1) {
        editorRef.current?.querySelectorAll(".active-segment").forEach((el) => {
          el.classList.remove("active-segment");
        });
        const domElement = editorRef.current?.querySelector(
          `[data-index="${currentIndex}"]`,
        );
        if (domElement) {
          domElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          domElement.classList.add("active-segment");
        }
      }
    } else {
      editorRef.current?.querySelectorAll(".active-segment").forEach((el) => {
        el.classList.remove("active-segment");
      });
    }
  }, [currentIndex, state, editorRef]);

  // Bind the state to the focus of the editor
  useEffect(() => {
    if (!editorRef.current) return;
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
    const editor = editorRef.current;
    editor.addEventListener("focus", handleFocus);
    editor.addEventListener("blur", handleBlur);
    return () => {
      editor.removeEventListener("focus", handleFocus);
      editor.removeEventListener("blur", handleBlur);
    };
  });

  // Arrows: move into segments
  // Space = play / pause
  // Arrow on the right or bottom, do not stop play
  // Arrow on the left / top: stop playback
  // Shift + arrow, get back to the first word or the previous sentence / next sentence
  // Maintain shift while in play mode: goes to x2 playback + ctrl goes to x4 playback
  // Maintain ctrl while in play mode: goes to x0.5 playback

  // Play / pause / change speed
  useHotkeys(
    ["space", "alt+space", "shift+space", "ctrl+space", "ctrl+shift+space"],
    (event) => {
      console.log("here");
      event.preventDefault();
      if (state !== "navigate") return;
      audioControls?.togglePlayPause();
    },
    {},
    [state, audioControls],
  );
  useHotkeys(
    ["alt+space", "ctrl+space"],
    (event) => {
      event.preventDefault();
      // Ignore if the editor is not focused
      if (state !== "edit") return;
      // Blur the editor to trigger the navigate mode and then toggle play/pause
      if (editorRef.current) editorRef.current.blur();
      audioControls?.togglePlayPause();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
    [state, audioControls],
  );
  useHotkeys(
    ["shift", "ctrl", "shift+ctrl"],
    (event) => {
      if (state !== "navigate") return;
      event.preventDefault();

      if (event.shiftKey && event.ctrlKey) {
        audioControls?.setPlaybackSpeed(4);
      } else if (event.shiftKey) {
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

  // Navigate in segments
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
            for (let i = currentIndex + 1; i < segments.length; i++) {
              if (
                /.*[.!?].*/.test(segments[i].text) ||
                (segments[i].type === "spacing" && duration(segments[i]) > 1)
              ) {
                selection = i;
                found = true;
                break;
              }
            }
            if (!found) selection = segments.length - 1;
          } else if (event.key === "ArrowLeft") {
            let found = false;
            for (let i = currentIndex - 3; i >= 0; i--) {
              console.log(segments[i]);
              if (
                /.*[.!?].*/.test(segments[i].text) ||
                (segments[i].type === "spacing" && duration(segments[i]) > 1)
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
            i < segments.length;
            i++
          ) {
            if (segments[i].type === "word") {
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
        // In the DOM we can use "data-index" attribute to find the current segment, then find the closest one with the same "data-speaker-id" attribute for the same speaker, or if there is no speaker, the closest one in terms of "data-start" attribute
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const domElement = editorRef.current?.querySelector(
            `[data-index="${currentIndex}"]`,
          );
          if (!domElement) return;

          const rect = domElement.getBoundingClientRect();

          let nextElement =
            event.key === "ArrowDown"
              ? domElement.nextElementSibling
              : domElement.previousElementSibling;
          while (nextElement) {
            const rectCandidate = nextElement.getBoundingClientRect();
            // First wait for Y axis change (got to new line)
            if (differentVerticalLine(rect, rectCandidate)) {
              break;
            }
            nextElement =
              event.key === "ArrowDown"
                ? nextElement.nextElementSibling
                : nextElement.previousElementSibling;
          }

          if (nextElement) {
            let closest = 1000000000;
            const rectLine = nextElement.getBoundingClientRect();
            while (nextElement) {
              const rectCandidate = nextElement.getBoundingClientRect();
              const distance = Math.abs(rectCandidate.left - rect.left);
              if (distance < closest) {
                closest = distance;
                selection = Number(nextElement.getAttribute("data-index") || 0);
              }
              if (
                distance > closest ||
                differentVerticalLine(rectLine, rectCandidate)
              ) {
                break;
              }
              nextElement =
                event.key === "ArrowDown"
                  ? nextElement.nextElementSibling
                  : nextElement.previousElementSibling;
            }
          }
        }

        // Ensure the selection is a word
        selection = ensureWord(
          selection,
          segments,
          event.key === "ArrowRight" || event.key === "ArrowDown" ? "r" : "l",
        );
      }

      audioControls?.seekTo(
        segments[Math.max(0, Math.min(segments.length, selection))].start || 0,
      );
      setCurrentIndex(selection);
    },
    {},
    [state, audioControls, segments, currentIndex],
  );

  // "Enter" key enters in focus mode and select the current word
  // Any letter or shift+letter or number, or accent also trigger the focus mode, but also add that letter there
  useHotkeys(
    ["Enter", "*"],
    (event) => {
      if (state !== "navigate") return;

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

      event.preventDefault();
      editorRef.current?.focus();

      // Set the selection range
      const domElement = editorRef.current?.querySelector(
        `[data-index="${currentIndex}"]`,
      );
      if (domElement) {
        const range = document.createRange();
        range.selectNodeContents(domElement);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }

      // If a letter was typed, then add that letter there
      if (event.key.length === 1) {
        document.execCommand("insertText", false, event.key);
      }
    },
    {},
    [state, currentIndex],
  );

  useHotkeys(
    ["Escape"],
    (event) => {
      if (state !== "edit") return;
      event.preventDefault();
      editorRef.current?.blur();
    },
    {
      enableOnContentEditable: true,
      enableOnFormTags: true,
    },
    [state],
  );

  return {};
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
