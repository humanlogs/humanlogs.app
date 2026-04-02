"use client";

import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import { AddMarkStep, RemoveMarkStep, ReplaceStep } from "@tiptap/pm/transform";
import { Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import _ from "lodash";
import { useEffect, useRef } from "react";
import { segmentsToHtml } from "../utils/html";
import { normalizeEditorSegments } from "./use-normalize-editor-segments";
import { applyTransactionOnSegments } from "../utils/transaction-on-segments";

const SpeakerParagraph = Paragraph.extend({
  addAttributes() {
    return {
      speakerId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-speaker-id"),
        renderHTML: (attrs) => {
          if (!attrs.speakerId) return {};
          return {
            "data-speaker-id": attrs.speakerId,
          };
        },
      },
    };
  },
});

interface UseTiptapEditorOptions {
  segments: TranscriptionSegment[];
  onChange: (segments: TranscriptionSegment[]) => void;
  editable: boolean;
  onTransaction?: (editor: any) => void;
  onUpdate?: (editor: any) => void;
  onSelectionUpdate?: (editor: any) => void;
}

/**
 * Syncs speaker IDs from the editor's paragraph attributes to the segments.
 * This ensures that when a paragraph's speakerId changes in the editor,
 * all segments within that paragraph are updated to match.
 */
function syncSpeakerIdsFromEditor(
  editor: Editor,
  segments: TranscriptionSegment[],
): TranscriptionSegment[] {
  const doc = editor.state.doc;
  const paragraphSpeakers: Array<{
    from: number;
    to: number;
    speakerId: string;
  }> = [];

  // Walk through the document and collect paragraph ranges with their speaker IDs
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph") {
      const speakerId = node.attrs.speakerId;
      if (speakerId) {
        // pos is the position before the node, pos + 1 is the start of content
        paragraphSpeakers.push({
          from: pos + 1,
          to: pos + node.nodeSize - 1, // -1 to exclude the closing tag
          speakerId,
        });
      }
    }
    return true; // Continue traversing
  });

  // Now map character positions to segments and update speaker IDs
  let charOffset = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segStart = charOffset;
    const segEnd = charOffset + seg.text.length;

    // Find which paragraph this segment belongs to
    for (const para of paragraphSpeakers) {
      // Check if segment overlaps with this paragraph
      if (segStart < para.to && segEnd > para.from) {
        // Update the segment's speaker ID
        segments[i] = { ...seg, speakerId: para.speakerId };
        break;
      }
    }

    charOffset += seg.text.length;
  }

  return segments;
}

/**
 * Creates a Tiptap editor instance configured for transcription editing.
 * This hook manages the editor lifecycle and provides transaction events.
 */
export function useTiptapEditor({
  segments,
  onChange,
  editable,
  onSelectionUpdate,
}: UseTiptapEditorOptions) {
  // Track the last segments to avoid redundant updates
  const segmentsRef = useRef<TranscriptionSegment[] | null>(segments);
  const segmentsHtmlRef = useRef<any>("");
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
        underline: {},
        // Disable some features we don't need
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        paragraph: false, // We'll use our custom SpeakerParagraph instead
      }),
      SpeakerParagraph,
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
    onTransaction: ({ editor, transaction }) => {
      console.log("[Tiptap] Transaction:", transaction.steps);

      if (
        transaction.steps.length === 0 ||
        !segmentsRef.current ||
        !segmentsRef.current.length ||
        isUpdatingFromSegmentsRef.current
      ) {
        return;
      }

      if (
        transaction.steps.length === 1 &&
        transaction.steps[0] instanceof ReplaceStep &&
        transaction.steps[0].from === 0 &&
        transaction.steps[0].to >= editor.getText().length - 1
      ) {
        // This is a full replacement coming from a segmentReplaces
        return;
      }

      // console.log("[Tiptap] Transaction:", transaction);

      // Edit segments based on transactions steps
      segmentsRef.current = applyTransactionOnSegments(
        segmentsRef.current ?? [],
        transaction,
      );

      // Sync speaker IDs from editor document to segments
      segmentsRef.current = syncSpeakerIdsFromEditor(
        editor,
        segmentsRef.current ?? [],
      );

      console.log("[Tiptap] Updated segments:", segmentsRef.current);

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

  return { editor, segmentsRef };
}
