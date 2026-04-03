"use client";

import { useTranslations } from "@/components/locale-provider";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Separator } from "@base-ui/react";
import {
  Bold,
  Italic,
  PauseIcon,
  PlayIcon,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Button } from "../../../../ui/button";
import { AudioControls } from "../../audio";
import { useAudio } from "../../audio/audio-context";
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
}

export function EditorToolbar({
  applyFormat,
  activeFormats,
  searchReplace,
  audioControls,
  hasWriteAccess,
  hasListenAccess,
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
    ["mod+shift+s", "ctrl+shift+s", "cmd+shift+s"],
    (e) => {
      e.preventDefault();
      applyFormat("s");
    },
    [applyFormat],
    {
      enableOnContentEditable: true,
    },
  );

  return (
    <div className="flex items-center gap-0 shrink-0">
      {hasListenAccess && (
        <>
          <Button
            variant={audioControls?.isPlaying ? "default" : "ghost"}
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus in editor
              audioControls?.togglePlayPause();
            }}
            className="h-7 w-7 p-0 font-bold"
            title={t("toolbar.playPause")}
          >
            {audioControls?.isPlaying ? (
              <PauseIcon
                className="h-3.5 w-3.5 text-pink-500 fill-pink-500 animation-pulse"
                fill="filled"
              />
            ) : (
              <PlayIcon className="h-3.5 w-3.5" />
            )}
          </Button>

          <DropdownMenu
            position="bottom"
            align="start"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title={t("toolbar.playbackSpeed")}
              >
                {`${audioControls?.playbackSpeed || 1}`.replace(/^0+/, "")}x
              </Button>
            }
          >
            {[0.5, 1, 2, 4].map((a) => (
              <DropdownMenuItem
                key={a}
                onClick={() => audioControls?.setPlaybackSpeed(a)}
              >
                {`${a}`.replace(/^0+/, "")}x
              </DropdownMenuItem>
            ))}{" "}
          </DropdownMenu>

          <Separator
            orientation="vertical"
            className="mx-2 h-4 w-px bg-slate-500/20"
          />

          <TimeCode audioControls={audioControls} />

          <Separator
            orientation="vertical"
            className="mx-2 h-4 w-px bg-slate-500/20"
          />
        </>
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
        </>
      )}

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

export const TimeCode = ({
  audioControls,
}: {
  audioControls: AudioControls | null;
}) => {
  const context = useAudio();

  const hasHours = (audioControls?.totalDuration || 0) >= 3600;
  const hasMinutes = (audioControls?.totalDuration || 0) >= 60;

  const formatTime = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    const tensOfSeconds = Math.floor((time * 100) % 100);
    return `${hasHours ? hours + ":" : ""}${
      hasMinutes || hasHours ? minutes.toString().padStart(2, "0") + ":" : ""
    }${seconds.toString().padStart(2, "0")}.${tensOfSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <span className="text-xs mx-2">
      <strong className="font-mono">{formatTime(context.currentTime)}</strong>
      <span className="text-muted-foreground">
        {" / "}
        {formatTime(audioControls?.totalDuration || 0)}
      </span>
    </span>
  );
};
