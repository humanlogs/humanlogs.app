"use client";

import { Separator } from "@base-ui/react";
import {
  Bold,
  Italic,
  PauseIcon,
  PlayIcon,
  Strikethrough,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useState } from "react";

export const FakeToolbar = () => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  return (
    <div className="flex items-center gap-0 shrink-0 bg-white border-b border-gray-200 p-2">
      <Button
        variant={isPlaying ? "default" : "ghost"}
        size="sm"
        onClick={() => setIsPlaying(!isPlaying)}
        className="h-7 w-7 p-0 font-bold"
      >
        {isPlaying ? (
          <PauseIcon
            className="h-3.5 w-3.5 text-pink-500 fill-pink-500"
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
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            {`${playbackSpeed}`.replace(/^0+/, "")}x
          </Button>
        }
      >
        {[0.5, 1, 2, 4].map((speed) => (
          <DropdownMenuItem key={speed} onClick={() => setPlaybackSpeed(speed)}>
            {`${speed}`.replace(/^0+/, "")}x
          </DropdownMenuItem>
        ))}
      </DropdownMenu>

      <Separator
        orientation="vertical"
        className="mx-2 h-4 w-px bg-slate-500/20"
      />

      <span className="text-xs mx-2">
        <strong className="font-mono">0:08.32</strong>
        <span className="text-muted-foreground"> / 0:15.50</span>
      </span>

      <Separator
        orientation="vertical"
        className="mx-2 h-4 w-px bg-slate-500/20"
      />

      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 font-bold">
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 italic">
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 underline">
        <Underline className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
        <Strikethrough className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};
