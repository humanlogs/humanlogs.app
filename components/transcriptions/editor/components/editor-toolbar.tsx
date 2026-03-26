"use client";

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
import { Button } from "../../../ui/button";
import { AudioControls } from "../interactive-audio";
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
    matchCount: number;
    currentMatchIndex: number;
    nextMatch: () => void;
    previousMatch: () => void;
    replaceCurrent: () => void;
    replaceAll: () => void;
    isOpen: boolean;
    toggleReplace: () => void;
  };
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  audioControls: AudioControls | null;
}

export function EditorToolbar({
  applyFormat,
  activeFormats,
  searchReplace,
  searchInputRef,
  audioControls,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center gap-0 px-6 shrink-0">
      <Button
        variant={activeFormats.has("b") ? "default" : "ghost"}
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault(); // keep focus in editor
          audioControls?.togglePlayPause();
        }}
        className="h-7 w-7 p-0 font-bold"
        title="Play / Pause (Alt+Space)"
      >
        {audioControls?.isPlaying ? (
          <PauseIcon className="h-3.5 w-3.5 text-red-500 animation-pulse" />
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
            title="Playback Speed (Alt+Ctrl)"
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
      <Button
        variant={activeFormats.has("b") ? "default" : "ghost"}
        size="sm"
        onMouseDown={(e) => {
          e.preventDefault(); // keep focus in editor
          applyFormat("b");
        }}
        className="h-7 w-7 p-0 font-bold"
        title="Bold (⌘B)"
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
        title="Italic (⌘I)"
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
        title="Underline (⌘U)"
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
        title="Strikethrough (⌘⇧X)"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>

      <SearchReplaceToolbar
        searchTerm={searchReplace.searchTerm}
        onSearchTermChange={searchReplace.setSearchTerm}
        replaceTerm={searchReplace.replaceTerm}
        onReplaceTermChange={searchReplace.setReplaceTerm}
        caseSensitive={searchReplace.caseSensitive}
        onCaseSensitiveChange={searchReplace.setCaseSensitive}
        matchCount={searchReplace.matchCount}
        currentMatchIndex={searchReplace.currentMatchIndex}
        onNextMatch={searchReplace.nextMatch}
        onPreviousMatch={searchReplace.previousMatch}
        onReplaceCurrent={searchReplace.replaceCurrent}
        onReplaceAll={searchReplace.replaceAll}
        showReplace={searchReplace.isOpen}
        onToggleReplace={searchReplace.toggleReplace}
        searchInputRef={searchInputRef}
      />
    </div>
  );
}
