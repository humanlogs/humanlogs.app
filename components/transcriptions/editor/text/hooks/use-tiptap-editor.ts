"use client";

import { useUserProfile } from "@/hooks/use-api";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { getSocket } from "@/lib/socket-client";
import { YjsSocketIOProvider } from "@/lib/yjs-socket-provider";
import Bold from "@tiptap/extension-bold";
import Collaboration from "@tiptap/extension-collaboration";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Strike from "@tiptap/extension-strike";
import Underline from "@tiptap/extension-underline";
import { ReplaceStep } from "@tiptap/pm/transform";
import { Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import { AutoWrapExtension } from "../extensions/auto-wrap-extension";
import { segmentsToHtml } from "../utils/html";
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

// Extend the marks to disable their keyboard shortcuts
const BoldNoShortcut = Bold.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

const ItalicNoShortcut = Italic.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

const StrikeNoShortcut = Strike.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

const UnderlineNoShortcut = Underline.extend({
  addKeyboardShortcuts() {
    return {};
  },
});

interface UseTiptapEditorOptions {
  transcriptionId: string;
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
  transcriptionId,
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
  const { data: userProfile } = useUserProfile();
  const [isMounted, setIsMounted] = useState(false);

  // Create Y.js document immediately (not in useEffect)
  // This must be available before the editor is created
  const yjsDoc = useRef<Y.Doc | null>(null);
  if (!yjsDoc.current && typeof window !== "undefined") {
    yjsDoc.current = new Y.Doc();
  }

  // Provider will be created after the editor is initialized
  const yjsProvider = useRef<YjsSocketIOProvider | null>(null);
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);

  // Detect client-side rendering - only mount after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialize awareness and provider after socket is available
  useEffect(() => {
    if (!isMounted) return;

    const socket = getSocket();
    if (!socket || !transcriptionId || !yjsDoc.current) return;

    // Create awareness instance if not exists
    if (!awarenessRef.current) {
      awarenessRef.current = new awarenessProtocol.Awareness(yjsDoc.current);
    }

    // Set local user info for awareness
    if (userProfile && awarenessRef.current) {
      awarenessRef.current.setLocalStateField("user", {
        name: userProfile.name || userProfile.email || "Anonymous",
        color: getRandomColor(),
      });
    }

    // Create provider
    if (!yjsProvider.current && awarenessRef.current) {
      yjsProvider.current = new YjsSocketIOProvider(
        socket,
        transcriptionId,
        yjsDoc.current,
        awarenessRef.current,
      );
      console.log(
        "[Y.js] Provider created for transcription:",
        transcriptionId,
      );
    }

    return () => {
      if (yjsProvider.current) {
        yjsProvider.current.destroy();
        yjsProvider.current = null;
      }
    };
  }, [transcriptionId, userProfile, isMounted]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // Disable marks - we'll add custom versions without keyboard shortcuts
          bold: false,
          italic: false,
          strike: false,
          // Disable some features we don't need
          heading: false,
          blockquote: false,
          codeBlock: false,
          horizontalRule: false,
          bulletList: false,
          orderedList: false,
          paragraph: false, // We'll use our custom SpeakerParagraph instead
        }),
        // Add custom marks without keyboard shortcuts
        BoldNoShortcut,
        ItalicNoShortcut,
        StrikeNoShortcut,
        UnderlineNoShortcut,
        SpeakerParagraph,
        Placeholder.configure({
          placeholder: "Start typing…",
        }),
        // Auto-wrap selected text with matching pairs
        AutoWrapExtension,
        // Collaboration extensions - only on client side after mount
        ...(isMounted && yjsDoc.current
          ? [
              Collaboration.configure({
                document: yjsDoc.current,
              }),
            ]
          : []),
      ],
      editable,
      content: segmentsHtmlRef.current,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "text-base leading-relaxed focus:outline-none relative",
          spellcheck: "true",
        },
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

        if (
          transaction.steps.length === 1 &&
          transaction.steps[0] instanceof ReplaceStep &&
          transaction.steps[0].from === 0 &&
          transaction.steps[0].to >= editor.getText().length - 1
        ) {
          // This is a full replacement coming from a segmentReplaces
          return;
        }

        // Edit segments based on transactions steps
        segmentsRef.current = applyTransactionOnSegments(
          segmentsRef.current ?? [],
          transaction,
        );

        // Call custom transaction handler
        if (onChange) {
          onChange(segmentsRef.current ?? []);
        }
      },
      onSelectionUpdate: ({ editor }) => {
        if (onSelectionUpdate) {
          onSelectionUpdate(editor);
        }
      },
    },
    [],
  );

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  editorRef.current = editor;

  return { editor, segmentsRef };
}

// Generate a random color for collaboration cursors
function getRandomColor(): string {
  const colors = [
    "#958DF1",
    "#F98181",
    "#FBBC88",
    "#FAF594",
    "#70CFF8",
    "#94FADB",
    "#B9F18D",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}
