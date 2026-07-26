"use client";

import { useUserProfile } from "@/hooks/use-api";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import {
  getSocket,
  offTranscriptionReverted,
  onTranscriptionReverted,
} from "@/lib/sockets/socket-client";
import {
  YjsCollabProvider,
  aesCodec,
  plaintextCodec,
} from "@/lib/sockets/yjs-collab-provider";
import { getUserColor } from "@/lib/utils/utils";
import Bold from "@tiptap/extension-bold";
import Collaboration from "@tiptap/extension-collaboration";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Placeholder from "@tiptap/extension-placeholder";
import Strike from "@tiptap/extension-strike";
import Underline from "@tiptap/extension-underline";
import { Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import { EditorAPI } from "../api";
import { CollabCaret } from "../collab/collab-caret";
import { docToSegments } from "../collab/doc-to-segments";
import { AutoWrapExtension } from "../extensions/auto-wrap-extension";
import { segmentsToHtml } from "../utils/html";
import { normalizeEditorSegments } from "./use-normalize-editor-segments";

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
  /** E2E: whether the transcription is encrypted, and its resolved session key. */
  isEncrypted?: boolean;
  aesKey?: string | null;
  aesKeyReady?: boolean;
  onChange: (segments: TranscriptionSegment[]) => void;
  editable: boolean;
  onTransaction?: (editor: any) => void;
  onUpdate?: (editor: any) => void;
  onSelectionUpdate?: (editor: any) => void;
  editorAPI: EditorAPI;
}

/**
 * Creates the real-time collaborative transcript editor.
 *
 * Text / structure / cursors / undo use the STANDARD TipTap Collaboration binding
 * (Y.XmlFragment ↔ ProseMirror via @tiptap/y-tiptap) + CollabCaret for remote carets.
 * The flat `TranscriptionSegment[]` projection (per-word timestamps for audio,
 * autosave, speaker UI) is DERIVED from the converged doc via {@link docToSegments},
 * debounced. Speaker names sync via a Y.Map. Persistence is gated to a single save
 * leader. Transport is the blind-relay provider (E2E-encrypted when the transcription
 * is encrypted — the provider does not start until the session key resolves).
 */
export function useTiptapEditor({
  transcriptionId,
  segments,
  isEncrypted,
  aesKey,
  onChange,
  editorAPI,
  editable,
  onSelectionUpdate,
}: UseTiptapEditorOptions) {
  // Y.Doc + awareness must exist before the editor is created (the Collaboration and
  // CollabCaret extensions bind them synchronously).
  const yjsDoc = useRef<Y.Doc | null>(null);
  if (!yjsDoc.current && typeof window !== "undefined") {
    yjsDoc.current = new Y.Doc();
  }
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);
  if (yjsDoc.current && !awarenessRef.current) {
    awarenessRef.current = new awarenessProtocol.Awareness(yjsDoc.current);
  }
  const providerRef = useRef<YjsCollabProvider | null>(null);
  const cursorColorRef = useRef<string>("");
  if (!cursorColorRef.current) cursorColorRef.current = getRandomColor();

  // The flat projection is DERIVED from the doc on each change, but is seeded here
  // with the normalized initial segments so the first derivation has a timestamp
  // reference to carry from (the doc itself holds no timestamps).
  const segmentsRef = useRef<TranscriptionSegment[] | null>(null);
  if (segmentsRef.current === null) {
    segmentsRef.current = normalizeEditorSegments(segments, {
      initialFormatting: true,
    });
  }

  // Initial HTML the seed authority writes into the Yjs fragment.
  const segmentsHtmlRef = useRef<any>("");
  if (!segmentsHtmlRef.current)
    segmentsHtmlRef.current = segmentsToHtml(segmentsRef.current);

  const editorRef = useRef<Editor>(null);
  const normalizeDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const { data: userProfile } = useUserProfile();
  const [isMounted, setIsMounted] = useState(false);

  // Persistence is gated to a single "save leader" (the seed authority, or a
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

  // Detect client-side rendering - only mount after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
          undoRedo: false,
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
        ...(yjsDoc.current
          ? [
              Collaboration.configure({ document: yjsDoc.current }),
              CollabCaret.configure({ awareness: awarenessRef.current }),
            ]
          : []),
      ],
      editable,
      // Content comes from the Yjs fragment (do NOT pass content).
      content: undefined,
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
      onTransaction: ({ transaction }) => {
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

  // Transport: wire the blind-relay provider (doc + awareness). The seed authority
  // writes the initial content into the fragment; late joiners pull full state.
  // Standard Collaboration handles doc↔PM; we don't touch the editor here.
  useEffect(() => {
    if (!editor || !isMounted || !yjsDoc.current) return;
    // E2E: do not start the transport until the session key is resolved for an
    // encrypted transcription — otherwise content would be relayed in the clear.
    if (isEncrypted && !aesKey) return;
    const codec = isEncrypted && aesKey ? aesCodec(aesKey) : plaintextCodec;
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
          codec,
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

    // A revert happened somewhere: leave the collab room IMMEDIATELY (drop the stale
    // in-memory doc so we never serve pre-revert state to a reloading peer), then let
    // the UI show a blocking "reload" prompt. The fresh session re-seeds from the
    // reverted DB row.
    const onReverted = (data: { transcriptionId: string; byName: string }) => {
      if (data.transcriptionId !== transcriptionId) return;
      cancelled = true;
      providerRef.current?.destroy();
      providerRef.current = null;
      editorAPI.emit("reverted", data);
    };
    onTranscriptionReverted(onReverted);

    return () => {
      cancelled = true;
      offTranscriptionReverted(onReverted);
      speakersMap.unobserve(onSpeakersMapChange);
      editorAPI.removeListener("speakersChange", onLocalSpeakersChange);
      providerRef.current?.destroy();
      providerRef.current = null;
    };
    // Re-runs once the E2E session key resolves (isEncrypted/aesKey).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, isMounted, isEncrypted, aesKey]);

  // Publish our identity (name/color) into awareness so peers can label our remote
  // caret. yCursorPlugin writes our selection into awareness automatically.
  useEffect(() => {
    if (!awarenessRef.current) return;
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

// Fallback cursor color used only until the user profile (and its deterministic
// getUserColor) is available.
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
