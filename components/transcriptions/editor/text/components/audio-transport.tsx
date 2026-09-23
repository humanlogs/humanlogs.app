"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { useAudio } from "../../audio/audio-context";
import type { AudioControls } from "../../audio/helpers";

/**
 * Play, speed, position: the transport, on its own.
 *
 * Extracted because BOTH passes over a document need it and only one had it. The
 * transcription toolbar owned these buttons, and the coding bar replaces that
 * toolbar wholesale, so entering the coding phase took the play button and the
 * speed away from a researcher listening to the interview they are coding. Coding
 * an interview means listening to it.
 */
export function AudioTransport({
  audioControls,
  /** Whether the reader may hear the audio at all. */
  enabled,
}: {
  audioControls: AudioControls | null;
  enabled: boolean;
}) {
  const t = useTranslations("editor");
  if (!enabled) return null;

  return (
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
        ))}
      </DropdownMenu>

      <Separator
        orientation="vertical"
        className="mx-2 h-4 w-px bg-slate-500/20"
      />

      <TimeCode audioControls={audioControls} />
    </>
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
