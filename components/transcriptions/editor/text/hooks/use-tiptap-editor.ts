"use client";

import { useUserProfile } from "@/hooks/use-api";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { getSocket } from "@/lib/sockets/socket-client";
import { YjsSocketIOProvider } from "@/lib/sockets/yjs-socket-provider";
import {
  YjsCollabProvider,
  plaintextCodec,
} from "@/lib/sockets/yjs-collab-provider";
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
import { EditorAPI } from "../api";
import { CollabCaret } from "../collab/collab-caret";
import { getUserColor } from "../components/remote-cursors";
import { docToSegments } from "../collab/doc-to-segments";
import { AutoWrapExtension } from "../extensions/auto-wrap-extension";
import { segmentsToHtml } from "../utils/html";
import { applyTransactionOnSegments } from "../utils/transaction-on-segments";
import { normalizeEditorSegments } from "./use-normalize-editor-segments";

/** `?collab` opt-in (client only). */
function isCollabEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("collab");
}

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
  speakers?: Array<{ id: string; name?: string }>;
  onChange: (segments: TranscriptionSegment[]) => void;
  editable: boolean;
  onTransaction?: (editor: any) => void;
  onUpdate?: (editor: any) => void;
  onSelectionUpdate?: (editor: any) => void;
  editorAPI: EditorAPI;
}

/**
 * Creates a Tiptap editor instance configured for transcription editing.
 *
 * In `?collab` mode the editor uses the STANDARD TipTap Collaboration binding
 * (Y.XmlFragment ↔ ProseMirror via @tiptap/y-tiptap) for robust text/structure/
 * cursor/undo sync, plus CollaborationCursor for remote carets. The flat
 * `TranscriptionSegment[]` projection (timestamps for audio, autosave, speaker UI)
 * is DERIVED from the converged doc via {@link docToSegments}, debounced.
 * Persistence is gated to a single save leader. Transport is our blind-relay
 * provider. Non-collab keeps the original behavior.
 */
export function useTiptapEditor({
  transcriptionId,
  segments,
  onChange,
  editorAPI,
  editable,
  onSelectionUpdate,
}: UseTiptapEditorOptions) {
  // `?collab` opt-in — resolved once, stable for the editor's lifetime.
  const [collabEnabled] = useState(isCollabEnabled);

  // Create Y.js document + awareness immediately (must exist before the editor is
  // created, so the Collaboration / CollaborationCursor extensions can bind them).
  const yjsDoc = useRef<Y.Doc | null>(null);
  if (!yjsDoc.current && typeof window !== "undefined") {
    yjsDoc.current = new Y.Doc();
  }
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);
  if (collabEnabled && yjsDoc.current && !awarenessRef.current) {
    awarenessRef.current = new awarenessProtocol.Awareness(yjsDoc.current);
  }
  const providerRef = useRef<YjsCollabProvider | null>(null);
  const cursorColorRef = useRef<string>("");
  if (!cursorColorRef.current) cursorColorRef.current = getRandomColor();

  // The flat projection. In collab it is DERIVED from the doc on each change, but is
  // seeded here with the normalized initial segments so the first derivation has a
  // timestamp reference to carry from (the doc itself holds no timestamps).
  const segmentsRef = useRef<TranscriptionSegment[] | null>(null);
  if (segmentsRef.current === null) {
    segmentsRef.current = normalizeEditorSegments(segments, {
      initialFormatting: true,
    });
  }

  // Initial HTML — used as the seed content the authority writes into the fragment
  // (collab), or as the editor's initial content (non-collab).
  const segmentsHtmlRef = useRef<any>("");
  if (!segmentsHtmlRef.current)
    segmentsHtmlRef.current = segmentsToHtml(segmentsRef.current);

  const editorRef = useRef<Editor>(null);
  const isUpdatingFromSegmentsRef = useRef(false);
  const normalizeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const { data: userProfile } = useUserProfile();
  const [isMounted, setIsMounted] = useState(false);

  // Collab persistence is gated to a single "save leader" (the seed authority, or a
  // standalone client with no working transport) so multiple writers don't race and
  // corrupt the stored utterances JSON. Non-leaders never save.
  const isCollabSaverRef = useRef(false);

  // Derive the flat projection from the (converged) doc, then update consumers and
  // (save-leader only) persist. Kept in a ref so once-created closures call the
  // latest version.
  const collabDeriveRef = useRef<() => void>(() => {});
  collabDeriveRef.current = () => {
    const ed = editorRef.current;
    if (!ed) return;
    segmentsRef.current = docToSegments(ed.state.doc, segmentsRef.current);
    editorAPI.emit("speakersOffsets");
    if (isCollabSaverRef.current && onChange) onChange(segmentsRef.current);
    else editorAPI.emit("change");
  };

  // Legacy (non-collab) provider (kept for the non-collab path only).
  const yjsProvider = useRef<YjsSocketIOProvider | null>(null);

  // Detect client-side rendering - only mount after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Legacy awareness/provider — non-collab only (collab uses the blind-relay
  // provider + standard Collaboration wired below).
  useEffect(() => {
    if (!isMounted || collabEnabled) return;

    const socket = getSocket();
    if (!socket || !transcriptionId || !yjsDoc.current) return;

    if (!awarenessRef.current) {
      awarenessRef.current = new awarenessProtocol.Awareness(yjsDoc.current);
    }
    if (userProfile && awarenessRef.current) {
      awarenessRef.current.setLocalStateField("user", {
        name: userProfile.name || userProfile.email || "Anonymous",
        color: cursorColorRef.current,
      });
    }
    if (!yjsProvider.current && awarenessRef.current) {
      yjsProvider.current = new YjsSocketIOProvider(
        socket,
        transcriptionId,
        yjsDoc.current,
        awarenessRef.current,
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
          // Collaboration provides its own CRDT-aware undo/redo (Mod-z).
          ...(collabEnabled ? { undoRedo: false as const } : {}),
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
        // Real-time collaboration (standard Yjs binding) + remote carets (built on
        // the same y-tiptap package, so plugin keys match).
        ...(collabEnabled && yjsDoc.current
          ? [
              Collaboration.configure({ document: yjsDoc.current }),
              CollabCaret.configure({ awareness: awarenessRef.current }),
            ]
          : []),
      ],
      editable,
      // Collab content comes from the Yjs fragment (do NOT pass content). Non-collab
      // keeps the original behavior.
      content: collabEnabled
        ? undefined
        : isMounted && yjsDoc.current
          ? ""
          : segmentsHtmlRef.current,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class:
            "text-base leading-relaxed focus:outline-none relative w-full max-w-full min-w-0 break-words",
          spellcheck: "true",
        },
        // Format shortcuts while editing. We own them here (ProseMirror) rather
        // than only via the toolbar's document-level useHotkeys because:
        //  - Cmd/Ctrl+U triggers the browser's NATIVE contentEditable underline;
        //    handling it here (before the default action) lets us override it.
        //  - Cmd/Ctrl+Shift+X (strikethrough) is the advertised shortcut (⌘⇧X).
        // We stopPropagation so the event never bubbles to the toolbar's
        // document-level hotkey (bubble phase) — otherwise it would toggle twice
        // and cancel out. When the editor is NOT focused (navigate mode), this
        // handler doesn't run and the toolbar hotkey applies to the current
        // segment instead.
        handleKeyDown: (_view, event) => {
          if (!(event.metaKey || event.ctrlKey) || event.altKey) return false;
          const key = event.key.toLowerCase();
          let toggle: "toggleUnderline" | "toggleStrike" | null = null;
          if (key === "u" && !event.shiftKey) toggle = "toggleUnderline";
          else if (key === "x" && event.shiftKey) toggle = "toggleStrike";
          if (!toggle) return false;

          const ed = editorRef.current;
          if (!ed || !ed.isEditable) return false;

          event.preventDefault();
          event.stopPropagation();
          toggleMarkExpandingWord(ed, toggle);
          return true;
        },
      },
      onTransaction: ({ editor, transaction }) => {
        if (collabEnabled) {
          // Standard Collaboration keeps text/structure/cursors in sync natively.
          if (!transaction.docChanged) return;
          // Reposition/relabel the speaker column IMMEDIATELY on every doc change
          // (local AND remote) — the DOM is already updated by Collaboration, and
          // useSpeakerPositions coalesces the recompute via requestAnimationFrame.
          editorAPI.emit("speakersOffsets");
          // The heavier flat-projection derivation (audio sync / autosave) stays
          // debounced — it doesn't need to run on every keystroke.
          if (normalizeDebounceRef.current)
            clearTimeout(normalizeDebounceRef.current);
          normalizeDebounceRef.current = setTimeout(() => {
            collabDeriveRef.current();
            normalizeDebounceRef.current = null;
          }, 300);
          return;
        }

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

        editorAPI.emit("speakersOffsets");

        // Debounce normalize and onChange call
        if (onChange) {
          if (normalizeDebounceRef.current) {
            clearTimeout(normalizeDebounceRef.current);
          }
          normalizeDebounceRef.current = setTimeout(() => {
            if (segmentsRef.current) {
              segmentsRef.current = normalizeEditorSegments(
                segmentsRef.current,
              );
              onChange(segmentsRef.current ?? []);
            }
            normalizeDebounceRef.current = null;
          }, 300);
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

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (normalizeDebounceRef.current) {
        clearTimeout(normalizeDebounceRef.current);
      }
    };
  }, []);

  // Legacy (non-collab): load initial content via the XmlFragment-empty check.
  useEffect(() => {
    if (collabEnabled || !editor || !isMounted || !yjsDoc.current) return;

    const yjsFragment = yjsDoc.current.getXmlFragment("default");
    const isEmpty = yjsFragment.length === 0;
    if (isEmpty && segmentsHtmlRef.current) {
      editor.commands.setContent(segmentsHtmlRef.current);
    }
  }, [editor, isMounted]);

  // Collab transport: wire the blind-relay provider (doc + awareness). The seed
  // authority writes the initial content into the fragment; late joiners pull full
  // state. Standard Collaboration handles doc↔PM; we don't touch the editor here.
  useEffect(() => {
    if (!collabEnabled || !editor || !isMounted || !yjsDoc.current) return;
    const ydoc = yjsDoc.current;

    // --- Speaker names: shared "content" metadata that isn't in the XmlFragment.
    // The fragment carries speakerId per paragraph; the id->name mapping lives in a
    // Y.Map so renames sync live. The save leader persists it into
    // transcription.speakers, which refreshes sidebars via db:change on real saves.
    const speakersMap = ydoc.getMap<string>("speakers");
    let speakersReady = false; // gate local->map writes until seeded/synced
    let applyingRemoteSpeakers = false;

    const seedSpeakersMap = () => {
      if (speakersMap.size > 0) return;
      ydoc.transact(() => {
        for (const s of editorAPI.getSpeakers())
          if (s.name != null) speakersMap.set(s.id, s.name);
      }, "sp-seed");
    };

    const adoptSpeakersFromMap = () => {
      if (speakersMap.size === 0) return;
      applyingRemoteSpeakers = true;
      try {
        const current = editorAPI.getSpeakers();
        const seen = new Set(current.map((s) => s.id));
        const merged = current.map((s) => {
          const name = speakersMap.get(s.id);
          return name != null ? { ...s, name } : s;
        });
        speakersMap.forEach((name, id) => {
          if (!seen.has(id)) merged.push({ id, name });
        });
        editorAPI.setSpeakers(merged);
      } finally {
        applyingRemoteSpeakers = false;
      }
    };

    const onSpeakersMapChange = (
      _e: Y.YMapEvent<string>,
      txn: Y.Transaction,
    ) => {
      if (txn.origin === "sp-local" || txn.origin === "sp-seed") return;
      adoptSpeakersFromMap(); // remote rename → reflect into the speaker column
    };
    speakersMap.observe(onSpeakersMapChange);

    const onLocalSpeakersChange = () => {
      if (!speakersReady || applyingRemoteSpeakers) return;
      ydoc.transact(() => {
        for (const s of editorAPI.getSpeakers()) {
          if (s.name != null && speakersMap.get(s.id) !== s.name)
            speakersMap.set(s.id, s.name);
        }
      }, "sp-local");
    };
    editorAPI.addListener("speakersChange", onLocalSpeakersChange);

    const seedNow = () => {
      const frag = ydoc.getXmlFragment("default");
      if (frag.length === 0) editor.commands.setContent(segmentsHtmlRef.current);
      seedSpeakersMap();
      speakersReady = true;
    };

    const debug =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("collabdebug");

    let cancelled = false;
    let attempts = 0;
    const trySetupProvider = () => {
      if (cancelled || providerRef.current) return;
      const socket = getSocket();
      if (socket) {
        if (debug) console.log("[collab] provider created, socket", socket.id);
        providerRef.current = new YjsCollabProvider(
          socket,
          transcriptionId,
          ydoc,
          plaintextCodec,
          {
            onSeed: seedNow,
            onSynced: () => {
              adoptSpeakersFromMap();
              speakersReady = true;
            },
            awareness: awarenessRef.current ?? undefined,
            debug,
            onRole: (isSaver) => {
              isCollabSaverRef.current = isSaver;
              if (isSaver) {
                collabDeriveRef.current(); // derive current segments + schedule save
                editorAPI.emit("becameSaver"); // force-flush now (robust handoff)
              }
            },
          },
        );
        return;
      }
      if (debug && attempts % 10 === 0)
        console.log("[collab] waiting for socket…", attempts);
      if (attempts++ < 40) {
        setTimeout(trySetupProvider, 150); // ~6s of retries
      } else if (!cancelled) {
        // No socket ever appeared → standalone: seed locally and save on our own.
        if (debug) console.log("[collab] no socket — standalone seed");
        seedNow();
        isCollabSaverRef.current = true;
        collabDeriveRef.current();
      }
    };
    trySetupProvider();

    return () => {
      cancelled = true;
      speakersMap.unobserve(onSpeakersMapChange);
      editorAPI.removeListener("speakersChange", onLocalSpeakersChange);
      providerRef.current?.destroy();
      providerRef.current = null;
    };
  }, [editor, isMounted]);

  // Collab: publish our identity (name/color) into awareness so peers can label our
  // remote caret. yCursorPlugin writes our selection into awareness automatically.
  useEffect(() => {
    if (!collabEnabled || !awarenessRef.current) return;
    awarenessRef.current.setLocalStateField("user", {
      name: userProfile?.name || userProfile?.email || "Anonymous",
      // Deterministic per-user color so the remote caret matches this user's audio
      // waveform tick color (both go through getUserColor(userId)).
      color: userProfile?.id
        ? getUserColor(userProfile.id)
        : cursorColorRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile]);

  editorRef.current = editor;

  return { editor, segmentsRef };
}

/**
 * Toggle a mark from a keyboard shortcut while editing. Mirrors the toolbar's
 * `applyFormat` focused behavior: with an empty selection (just a caret) it first
 * expands to the surrounding word so the whole word is (un)formatted, matching
 * what the toolbar buttons do.
 */
function toggleMarkExpandingWord(
  editor: Editor,
  toggle: "toggleUnderline" | "toggleStrike",
): void {
  const { from, to } = editor.state.selection;

  if (from === to) {
    const $pos = editor.state.doc.resolve(from);
    const textContent = $pos.parent.textContent;
    const posInParent = $pos.parentOffset;

    let start = posInParent;
    let end = posInParent;
    while (start > 0 && /[\w']/.test(textContent[start - 1])) start--;
    while (end < textContent.length && /[\w']/.test(textContent[end])) end++;

    if (start < end) {
      const absStart = from - posInParent + start;
      const absEnd = from - posInParent + end;
      editor
        .chain()
        .setTextSelection({ from: absStart, to: absEnd })
        [toggle]()
        .run();
      return;
    }
  }

  editor.chain()[toggle]().run();
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
