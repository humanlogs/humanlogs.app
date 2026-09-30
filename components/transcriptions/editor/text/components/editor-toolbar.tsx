"use client";

import { useTranslations } from "@/components/locale-provider";
import { AudioTransport } from "./audio-transport";
import { Separator } from "@base-ui/react";
import {
  Bold,
  Italic,
  MessageSquarePlus,
  SpellCheck,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Button } from "../../../../ui/button";
import { AudioControls } from "../../audio/helpers";
import { SearchReplaceToolbar } from "./search-replace-toolbar";

interface EditorToolbarProps {
  applyFormat: (modifier: "b" | "i" | "u" | "s") => void;
  activeFormats: Set<"b" | "i" | "u" | "s">;
  searchReplace: {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    replaceTerm: string;
    setReplaceTerm: (value: string) => void;
    caseSensitive: boolean;
    setCaseSensitive: (value: boolean) => void;
    wholeWord: boolean;
    setWholeWord: (value: boolean) => void;
    ignoreAccents: boolean;
    setIgnoreAccents: (value: boolean) => void;
    matchCount: number;
    currentMatchIndex: number;
    nextMatch: () => void;
    previousMatch: () => void;
    replaceCurrent: () => void;
    replaceAll: () => void;
    isOpen: boolean;
    toggleReplace: (value?: boolean) => void;
  };
  audioControls: AudioControls | null;
  hasWriteAccess: boolean;
  hasListenAccess: boolean;
  /** Anchor a comment on the current selection (expands to the whole word). */
  onComment?: () => void;
  /** Whether doubtful words are underlined, and the switch for it. */
  showConfidence?: boolean;
  onToggleConfidence?: () => void;
}

export function EditorToolbar({
  applyFormat,
  activeFormats,
  searchReplace,
  audioControls,
  hasWriteAccess,
  hasListenAccess,
  onComment,
  showConfidence,
  onToggleConfidence,
}: EditorToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("editor");

  useHotkeys(
    ["mod+f", "cmd+f", "ctrl+f"],
    (e) => {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchReplace.toggleReplace(false);
    },
    [searchReplace],
    {
      enableOnContentEditable: true,
    },
  );

  useHotkeys(
    ["mod+shift+f", "ctrl+shift+f", "cmd+shift+f"],
    (e) => {
      e.preventDefault();
      searchInputRef.current?.focus();
      searchReplace.toggleReplace(true);
    },
    [searchReplace],
    {
      enableOnContentEditable: true,
    },
  );

  useHotkeys(
    ["mod+b", "cmd+b", "ctrl+b"],
    (e) => {
      e.preventDefault();
      applyFormat("b");
    },
    [applyFormat],
    {
      enableOnContentEditable: true,
    },
  );

  useHotkeys(
    ["mod+i", "cmd+i", "ctrl+i"],
    (e) => {
      e.preventDefault();
      applyFormat("i");
    },
    [applyFormat],
    {
      enableOnContentEditable: true,
    },
  );

  useHotkeys(
    ["mod+u", "cmd+u", "ctrl+u"],
    (e) => {
      e.preventDefault();
      applyFormat("u");
    },
    [applyFormat],
    {
      enableOnContentEditable: true,
    },
  );

  useHotkeys(
    ["mod+shift+x", "ctrl+shift+x", "cmd+shift+x"],
    (e) => {
      e.preventDefault();
      applyFormat("s");
    },
    [applyFormat],
    {
      enableOnContentEditable: true,
    },
  );

  // Comment: ⌘⌥M / Ctrl+Alt+M — the Google Docs binding. Owned here as a plain
  // listener instead of going through react-hotkeys-hook, which cannot express it
  // correctly for two independent reasons:
  //
  //  - The hook matches `event.code`, i.e. the key's PHYSICAL position named after
  //    QWERTY. On a French AZERTY keyboard the key labelled M sits where QWERTY has
  //    ";" and reports code "Semicolon", so any "…+m" binding silently never fires —
  //    the keystroke then falls through to the browser, and a ⌘ chord ends up on
  //    macOS's Minimize. (B/I/U/F/X are unaffected: only A/Q, Z/W and M move between
  //    the two layouts.)
  //  - Its `useKey: true` escape hatch is worse: for a single-key hotkey it matches on
  //    `event.key` alone and skips the modifier check entirely, so a bare "m" would
  //    trigger this.
  //
  // So accept the key by either identity: the physical M of both common layouts, or
  // the produced character. macOS rewrites `event.key` when Option is held (⌥M yields
  // "µ"), which is why the code check has to carry macOS while `key` carries
  // Windows/Linux.
  useEffect(() => {
    if (!onComment) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.shiftKey) return;
      const isM =
        e.code === "KeyM" || // QWERTY / QWERTZ
        e.code === "Semicolon" || // AZERTY
        e.key.toLowerCase() === "m";
      if (!isM) return;
      // Never hijack real form typing — the comment composer is a textarea.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      e.preventDefault();
      e.stopPropagation();
      onComment();
    };
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onComment]);

  // A view setting, not an edit: offered to readers too, and it never touches the
  // doubts themselves — only whether they are drawn. Sits just before the comment
  // button, with the other "review" action.
  const confidenceToggle = onToggleConfidence ? (
    <Button
      variant={showConfidence ? "secondary" : "ghost"}
      size="sm"
      onMouseDown={(e) => {
        e.preventDefault(); // keep focus/selection in editor
        onToggleConfidence();
      }}
      className="h-7 w-7 p-0"
      title={t(
        showConfidence ? "toolbar.hideConfidence" : "toolbar.showConfidence",
      )}
      aria-label={t("toolbar.confidence")}
      aria-pressed={!!showConfidence}
    >
      <SpellCheck className="h-3.5 w-3.5" />
    </Button>
  ) : null;

  return (
    <div className="flex items-center gap-0 shrink-0">
      <AudioTransport audioControls={audioControls} enabled={hasListenAccess} />
      {hasListenAccess && (
        <Separator
          orientation="vertical"
          className="mx-2 h-4 w-px bg-slate-500/20"
        />
      )}

      {hasWriteAccess && (
        <>
          <Button
            variant={activeFormats.has("b") ? "default" : "ghost"}
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus in editor
              applyFormat("b");
            }}
            className="h-7 w-7 p-0 font-bold"
            title={t("toolbar.bold")}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={activeFormats.has("i") ? "default" : "ghost"}
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat("i");
            }}
            className="h-7 w-7 p-0 italic"
            title={t("toolbar.italic")}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={activeFormats.has("u") ? "default" : "ghost"}
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat("u");
            }}
            className="h-7 w-7 p-0 underline"
            title={t("toolbar.underline")}
          >
            <Underline className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={activeFormats.has("s") ? "default" : "ghost"}
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              applyFormat("s");
            }}
            className="h-7 w-7 p-0"
            title={t("toolbar.strikethrough")}
          >
            <Strikethrough className="h-3.5 w-3.5" />
          </Button>

          <Separator
            orientation="vertical"
            className="mx-2 h-4 w-px bg-slate-500/20"
          />

          {confidenceToggle}

          <Button
            variant="ghost"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus/selection in editor
              onComment?.();
            }}
            className="h-7 w-7 p-0"
            title={t("toolbar.comment")}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      {/* Readers get the toggle alone: the formats and the comment around it are
          edits they cannot make. */}
      {!hasWriteAccess && confidenceToggle}

      <SearchReplaceToolbar
        searchTerm={searchReplace.searchTerm}
        onSearchTermChange={searchReplace.setSearchTerm}
        replaceTerm={searchReplace.replaceTerm}
        onReplaceTermChange={searchReplace.setReplaceTerm}
        caseSensitive={searchReplace.caseSensitive}
        onCaseSensitiveChange={searchReplace.setCaseSensitive}
        wholeWord={searchReplace.wholeWord}
        onWholeWordChange={searchReplace.setWholeWord}
        ignoreAccents={searchReplace.ignoreAccents}
        onIgnoreAccentsChange={searchReplace.setIgnoreAccents}
        matchCount={searchReplace.matchCount}
        currentMatchIndex={searchReplace.currentMatchIndex}
        onNextMatch={searchReplace.nextMatch}
        onPreviousMatch={searchReplace.previousMatch}
        onReplaceCurrent={searchReplace.replaceCurrent}
        onReplaceAll={searchReplace.replaceAll}
        showReplace={searchReplace.isOpen}
        onToggleReplace={searchReplace.toggleReplace}
        searchInputRef={searchInputRef}
        hideReplace={!hasWriteAccess}
      />
    </div>
  );
}

export { TimeCode } from "./audio-transport";
