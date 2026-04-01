"use client";

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { AddMarkStep, RemoveMarkStep, ReplaceStep } from "@tiptap/pm/transform";
import { Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import diff from "fast-diff";
import { useEffect, useMemo, useRef } from "react";
import { segmentsToHtml } from "../utils/html";
import { createTiptapEditorAPI } from "./editor-api-tiptap";
import { normalizeEditorSegments } from "./use-normalize-editor-segments";

interface UseTiptapEditorOptions {
  segments: TranscriptionSegment[];
  onChange: (segments: TranscriptionSegment[]) => void;
  editable: boolean;
  onTransaction?: (editor: any) => void;
  onUpdate?: (editor: any) => void;
  onSelectionUpdate?: (editor: any) => void;
}

/**
 * Creates a Tiptap editor instance configured for transcription editing.
 * This hook manages the editor lifecycle and provides transaction events.
 */
export function useTiptapEditor({
  segments,
  onChange,
  editable,
  onTransaction,
  onUpdate,
  onSelectionUpdate,
}: UseTiptapEditorOptions) {
  // Track the last segments to avoid redundant updates
  const segmentsRef = useRef<TranscriptionSegment[] | null>(segments);
  const segmentsHtmlRef = useRef<string>("");
  if (!segmentsHtmlRef.current)
    segmentsHtmlRef.current = segmentsToHtml(segments);
  const editorRef = useRef<Editor>(null);
  const isUpdatingFromSegmentsRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep useful features (pass empty object to enable with defaults)
        bold: {},
        italic: {},
        strike: {},
        // Disable some features we don't need
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Start typing…",
      }),
    ],
    editable,
    content: segmentsHtmlRef.current,
    immediatelyRender: false, // Don't render until we have the initial segments
    editorProps: {
      attributes: {
        class: "text-base leading-relaxed focus:outline-none relative",
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor, transaction }) => {
      if (onUpdate) {
        onUpdate(editor);
      }
    },
    onTransaction: ({ editor, transaction }) => {
      if (
        transaction.steps.length === 0 ||
        !segmentsRef.current ||
        !segmentsRef.current.length ||
        isUpdatingFromSegmentsRef.current
      ) {
        return;
      }
      // console.log("[Tiptap] Transaction:", transaction);

      // Edit segments based on transactions steps
      for (const step of transaction.steps) {
        if (
          step instanceof AddMarkStep ||
          step instanceof RemoveMarkStep ||
          step instanceof ReplaceStep
        ) {
          segmentsRef.current = applyStepToSegments(
            segmentsRef.current ?? [],
            step,
          );
        } else {
          // console.log("Unhandled step type:", step);
        }
      }

      // Get normalised version of segments based on current editor content
      const before = editor.getText();
      segmentsRef.current = normalizeEditorSegments(segmentsRef.current ?? []);
      const normalizedSomething =
        segmentsRef.current.map((s) => s.text).join("") !== before;

      // console.log("Segments after applying steps:", segmentsRef.current);

      if (normalizedSomething) {
        // Detect diffs and apply custom transactions with fast-diff
        const diffs = diff(
          before || "",
          segmentsRef.current.map((s) => s.text).join(""),
        );

        // console.log("Diffs after normalization:", diffs);

        let cursor = 0;
        isUpdatingFromSegmentsRef.current = true;
        for (const [type, text] of diffs) {
          cursor += text.length;
          if (type === 0) {
            // No change
            continue;
          } else if (type === -1) {
            // Deletion
            editor?.commands.deleteRange({
              from: cursor - text.length + 1, // +1 for Tiptap's 1-based indexing
              to: cursor + 1,
            });
          } else if (type === 1) {
            // Insertion
            editor?.commands.insertContentAt(
              cursor - text.length + 1, // +1 for Tiptap's 1-based indexing
              text,
            );
          }
        }
        isUpdatingFromSegmentsRef.current = false;
      }

      // Call custom transaction handler
      if (onChange) {
        onChange(segmentsRef.current ?? []);
      }
    },
    onSelectionUpdate: ({ editor }) => {
      // console.log("[Tiptap] Selection update");

      if (onSelectionUpdate) {
        onSelectionUpdate(editor);
      }
    },
  });

  // Update editable state
  useEffect(() => {
    if (editor) {
      // Run render
      editor.setEditable(editable);
    }
  }, [editor, editable]);
  editorRef.current = editor;

  // Create EditorAPI from Tiptap editor
  const api = useMemo(
    () => createTiptapEditorAPI(editorRef as any, segmentsRef as any),
    [],
  );

  return { editor, api };
}

function applyStepToSegments(
  segments: TranscriptionSegment[],
  step: AddMarkStep | RemoveMarkStep | ReplaceStep,
): TranscriptionSegment[] {
  let charCount = 0;
  let segmentIndex = 0;
  let replacementIndex = 0;
  while (charCount < step.from) {
    const seg = segments[segmentIndex];
    if (!seg) break;

    if (charCount + seg.text.length >= step.from - 1) {
      // +1 for Tiptap's 1-based indexing
      // The step starts in the middle of this segment, we need to split it
      segments[segmentIndex] = applyStepToSegment(
        segments[segmentIndex],
        charCount,
        step,
        replacementIndex,
      );
      replacementIndex++;
    }

    charCount += seg.text.length;
    segmentIndex++;
  }

  while (charCount < step.to) {
    const seg = segments[segmentIndex];
    if (!seg) break;

    if (charCount + seg.text.length >= step.to - 1) {
      // +1 for Tiptap's 1-based indexing
      // The step ends in this segment, we need to split it
      segments[segmentIndex] = applyStepToSegment(
        segments[segmentIndex],
        charCount,
        step,
        replacementIndex,
        true,
      );
      replacementIndex++;
    } else {
      // Apply replacement if it makes sense
      segments[segmentIndex] = applyStepToSegment(
        segments[segmentIndex],
        charCount,
        step,
        replacementIndex,
      );
      replacementIndex++;
    }

    charCount += seg.text.length;
    segmentIndex++;
  }

  return segments;
}

const modifiersMap: Record<string, string> = {
  bold: "b",
  italic: "i",
  underline: "u",
  strike: "s",
};

function applyStepToSegment(
  segment: TranscriptionSegment,
  offset: number,
  step: AddMarkStep | RemoveMarkStep | ReplaceStep,
  replacementIndex?: number,
  remaining = false,
): TranscriptionSegment {
  // Apply add / remove mark steps to the whole segment (can't split markers in segments)
  if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
    const modifiers = new Set(segment.modifiers ?? []);
    if (modifiersMap[step.mark.type.name]) {
      if (step instanceof AddMarkStep) {
        modifiers.add(modifiersMap[step.mark.type.name] as never);
      } else {
        modifiers.delete(modifiersMap[step.mark.type.name] as never);
      }
    }

    return { ...segment, modifiers: Array.from(modifiers) };
  }

  if (step instanceof ReplaceStep) {
    const strSegments = step.slice.content.content
      .map((a) =>
        a.type.name === "paragraph" || a.type.name === "hardBreak"
          ? "\n"
          : a.text || "",
      )
      .join("")
      .split("(\s+)");

    const text = remaining
      ? strSegments.slice(replacementIndex ?? 0).join("")
      : strSegments[replacementIndex ?? 0] || "";

    const from = Math.max(0, step.from - offset - 1);
    const to = Math.max(0, step.to - offset - 1);
    const newText =
      (segment.text.slice(0, from) || "") +
      text +
      (segment.text.slice(to) || "");

    return {
      ...segment,
      text: newText,
    };
  }

  return segment;
}
