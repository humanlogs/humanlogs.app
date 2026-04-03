"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { UserCursor } from "../../../../hooks/use-transcription-cursors";
import { TranscriptionSegment } from "../../../../hooks/use-transcriptions";
import { downloadAndDecryptAudio } from "../../../../lib/audio-decryption.browser";
import { getSpeakerColor } from "../../../../lib/utils";
import "../index.css"; // Import custom styles for canvas
import { EditorAPI } from "../text/api";
import { getUserColor } from "../text/components/remote-cursors";
import { useAudio } from "./audio-context";

// Audio controls interface
export interface AudioControls {
  isPlaying: boolean;
  playbackSpeed: number;
  totalDuration?: number;
  togglePlayPause: () => void;
  pause: () => void;
  play: () => void;
  seekTo: (time: number) => void;
  playSegment: (start: number, end: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  onTimeUpdate: (callback: (currentTime: number) => void) => void;
}

// Extract speaker segments from transcription
const getSpeakerSegments = (oSegments: TranscriptionSegment[]) => {
  const segments: (Partial<TranscriptionSegment> & { color: string })[] = [];
  const speakerColors = new Map<string, string>();
  let colorIndex = 0;

  let currentSpeaker: string | null = null;
  let segmentStart = 0;

  for (const word of oSegments) {
    if (!word.speakerId) continue;

    // Assign color to new speaker
    if (!speakerColors.has(word.speakerId)) {
      speakerColors.set(word.speakerId, getSpeakerColor(colorIndex++));
    }

    // New speaker segment
    if (currentSpeaker !== word.speakerId) {
      // Save previous segment
      if (currentSpeaker) {
        segments.push({
          start: segmentStart,
          end: word.start,
          speakerId: currentSpeaker,
          color: speakerColors.get(currentSpeaker) || "#4a5568",
        });
      }
      currentSpeaker = word.speakerId;
      segmentStart = word.start || 0;
    }
  }

  // Add final segment
  if (currentSpeaker && segments.length > 0) {
    const lastWord = oSegments[oSegments.length - 1];
    segments.push({
      start: segmentStart,
      end: lastWord.end,
      speakerId: currentSpeaker,
      color: speakerColors.get(currentSpeaker) || "#4a5568",
    });
  }

  return segments;
};

// Convert character offset to time using segments
function offsetToTime(
  offset: number,
  segments: TranscriptionSegment[],
): number {
  let currentOffset = 0;

  for (const segment of segments) {
    const segmentLength = segment.text.length;

    if (currentOffset + segmentLength >= offset) {
      // Cursor is within this segment
      const positionInSegment = offset - currentOffset;
      const ratio = positionInSegment / segmentLength;
      const segmentDuration = (segment.end || 0) - (segment.start || 0);
      return (segment.start || 0) + segmentDuration * ratio;
    }

    currentOffset += segmentLength;
  }

  // If offset is beyond all segments, return the end time of the last segment
  return segments[segments.length - 1]?.end || 0;
}

export const InteractiveAudio = ({
  editorAPI,
  id,
  audioFileEncryption,
  onAudioControlsReady,
  cursors = [],
}: {
  editorAPI: EditorAPI;
  id: string;
  audioFileEncryption?: string;
  onAudioControlsReady?: (controls: AudioControls) => void;
  cursors?: UserCursor[];
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const onTimeUpdateRef = useRef<(currentTime: number) => void>(() => {});
  const speakerSegmentsRef = useRef<
    (Partial<TranscriptionSegment> & { color: string })[]
  >([]);
  const lastPositionRef = useRef<number>(0); // Track position across re-renders
  const wasPlayingRef = useRef<boolean>(false); // Track playing state across re-renders
  const { setCurrentTime, registerSeekHandler } = useAudio();
  const segmentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeedVal] = useState(1);
  const [totalDuration, setTotalDuration] = useState<number | undefined>(0);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    console.log("Toggling play/pause");
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  // Pause audio
  const pause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
    }
    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }
  }, []);

  // Play audio
  const play = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.play();
    }
  }, []);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    if (wavesurferRef.current) {
      const duration = wavesurferRef.current.getDuration();
      if (duration > 0) {
        wavesurferRef.current.seekTo(time / duration);
      }
    }
  }, []);

  // Play a specific segment (start to end time)
  const playSegment = useCallback(
    (start: number, end: number) => {
      if (!wavesurferRef.current) return;

      // Clear any existing timeout
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
      }

      // Seek to start
      seekTo(start);

      // Play
      play();

      // Stop at end
      const duration = (end - start) * 1000; // Convert to ms
      segmentTimeoutRef.current = setTimeout(() => {
        pause();
      }, duration);
    },
    [seekTo, play, pause],
  );

  // Set playback speed (with pitch preservation)
  const setPlaybackSpeed = useCallback((speed: number) => {
    if (wavesurferRef.current) {
      console.log("Setting playback speed to", speed);
      const mediaElement = wavesurferRef.current.getMediaElement();
      if (mediaElement) {
        mediaElement.preservesPitch = true;
        mediaElement.playbackRate = speed;
        setPlaybackSpeedVal(speed);
      }
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    // Initialize speaker segments from current segments
    speakerSegmentsRef.current = getSpeakerSegments(editorAPI.getSegments());

    // Initialize wavesurfer with symmetrical mono waveform
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#4a5568",
      progressColor: "#FFFFFF44",
      cursorColor: "rgb(255, 0, 0)",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 40,
      minPxPerSec: 0.05,
      normalize: true,
      backend: "MediaElement",
      renderFunction: (channels, ctx) => {
        const { width, height } = ctx.canvas;
        const halfHeight = height / 2;

        // Merge all channels into a single signal by averaging
        const channelLength = channels[0].length;
        const mergedChannel = new Float32Array(channelLength);

        for (let i = 0; i < channelLength; i++) {
          let sum = 0;
          for (let ch = 0; ch < channels.length; ch++) {
            sum += channels[ch][i] || 0;
          }
          mergedChannel[i] = sum / channels.length;
        }

        ctx.clearRect(0, 0, width, height);

        // Draw symmetrical waveform with speaker colors
        const barWidth = 3;
        const barGap = 1;
        const step = barWidth + barGap;

        for (let i = 0; i < width; i += step) {
          const index = Math.floor((i / width) * mergedChannel.length);
          const value = Math.abs(mergedChannel[index] || 0);
          const barHeight = value * halfHeight * 2;

          // Determine color based on time position and speaker
          const timePosition = (i / width) * wavesurfer.getDuration();
          let barColor = "#4a5568"; // default gray

          // Find which speaker segment this position belongs to - use ref for latest segments
          for (const segment of speakerSegmentsRef.current) {
            if (
              timePosition >= (segment.start || 0) &&
              timePosition <= (segment.end || 0)
            ) {
              barColor = segment.color;
              break;
            }
          }

          ctx.fillStyle = barColor;
          ctx.beginPath();
          ctx.roundRect(
            i - barWidth / 2,
            halfHeight - barHeight,
            barWidth,
            barHeight * 2,
            4,
          );
          ctx.fill();
        }
      },
    });

    wavesurferRef.current = wavesurfer;

    // Register seek handler for audio context
    registerSeekHandler((time: number) => {
      try {
        wavesurfer.seekTo(time / wavesurfer.getDuration());
      } catch (e) {
        console.log("Error seeking audio:", e);
      }
    });

    // Update time as audio plays
    wavesurfer.on("audioprocess", (currentTime: number) => {
      lastPositionRef.current = currentTime; // Save position
      setCurrentTime(currentTime);
      if (onTimeUpdateRef.current) onTimeUpdateRef.current(currentTime);
    });

    // Also update on seek
    wavesurfer.on("seeking", (currentTime: number) => {
      lastPositionRef.current = currentTime; // Save position
      setCurrentTime(currentTime);
      if (onTimeUpdateRef.current) onTimeUpdateRef.current(currentTime);
    });

    wavesurfer.on("ready", () => {
      const duration = wavesurfer.getDuration();
      setTotalDuration(duration);

      // Restore playback position and state after re-creation
      if (lastPositionRef.current > 0) {
        wavesurfer.seekTo(lastPositionRef.current / duration);

        // Restore playback speed
        const mediaElement = wavesurfer.getMediaElement();
        if (mediaElement) {
          mediaElement.preservesPitch = true;
          mediaElement.playbackRate = playbackSpeed;
        }

        // Restore playing state
        if (wasPlayingRef.current) {
          wavesurfer.play();
        }
      }
    });

    // Track play/pause state
    wavesurfer.on("play", () => {
      wasPlayingRef.current = true;
      setIsPlaying(true);
    });

    wavesurfer.on("pause", () => {
      wasPlayingRef.current = false;
      setIsPlaying(false);
    });

    // Fetch and load the audio
    const loadAudio = async () => {
      try {
        if (!audioFileEncryption) {
          // No encryption, load directly
          const audioUrl = `/api/transcriptions/${id}/audio`;
          await wavesurfer.load(audioUrl);
        } else {
          // Download and decrypt the audio file
          const decryptedBlob = await downloadAndDecryptAudio(
            id,
            audioFileEncryption,
          );

          // Create blob URL and load into wavesurfer
          // Keep the blob URL alive for the entire component lifecycle to support seeking
          const blobUrl = URL.createObjectURL(decryptedBlob);
          blobUrlRef.current = blobUrl;
          await wavesurfer.load(blobUrl);
        }
      } catch (err) {
        console.error("Error loading audio:", err);
      }
    };

    loadAudio();

    // Cleanup
    return () => {
      if (segmentTimeoutRef.current) {
        clearTimeout(segmentTimeoutRef.current);
      }
      // Revoke blob URL to prevent memory leaks
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      wavesurfer.destroy();
    };
  }, [id]);

  useEffect(() => {
    const handleSegmentsChange = () => {
      // Update segment colors in-place and ask WaveSurfer to redraw bars.
      speakerSegmentsRef.current = getSpeakerSegments(editorAPI.getSegments());
      wavesurferRef.current?.setOptions({});
    };

    editorAPI.addListener("change", handleSegmentsChange);

    return () => {
      editorAPI.removeListener("change", handleSegmentsChange);
    };
  }, [editorAPI]);

  // Notify parent of audio controls whenever they change
  useEffect(() => {
    if (onAudioControlsReady && wavesurferRef.current) {
      onAudioControlsReady({
        isPlaying,
        playbackSpeed,
        totalDuration,
        togglePlayPause,
        pause,
        play,
        seekTo,
        playSegment,
        setPlaybackSpeed,
        onTimeUpdate: (callback) => {
          onTimeUpdateRef.current = callback;
        },
      });
    }
  }, [
    playbackSpeed,
    isPlaying,
    totalDuration,
    onAudioControlsReady,
    togglePlayPause,
    pause,
    play,
    seekTo,
    playSegment,
    setPlaybackSpeed,
  ]);

  return (
    <div className="w-full pb-0 px-4">
      <div className="w-full bg-slate-100 dark:bg-slate-900 h-10 relative overflow-visible rounded-b-md mb-5">
        <div ref={containerRef} className="w-full h-full" />
        {/* Render cursor indicators */}
        {cursors.map((cursor) => {
          const segments = editorAPI.getSegments();
          const cursorTime = offsetToTime(cursor.endOffset, segments);
          const duration = totalDuration || 1;
          const leftPercent = (cursorTime / duration) * 100;
          const color = getUserColor(cursor.userId);

          return (
            <div
              key={cursor.socketId}
              className="absolute bottom-0 pointer-events-none z-10 transition-all duration-100 ease-out"
              style={{
                left: `${leftPercent}%`,
                transform: "translateX(-50%)",
                bottom: "-3px",
              }}
            >
              {/* Cursor line */}
              <div
                className="w-0.5 h-2 animate-pulse"
                style={{ backgroundColor: color }}
              />
              {/* Small label */}
              <div
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium px-1 rounded-full shadow-lg"
                style={{
                  backgroundColor: color,
                  color: "white",
                }}
              >
                {cursor.userName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toLocaleUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
