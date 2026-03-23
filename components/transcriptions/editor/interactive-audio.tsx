"use client";

import { useEffect, useRef } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import WaveSurfer from "wavesurfer.js";
import { TranscriptionSegment } from "../../../hooks/use-api";
import { useAudio } from "./audio-context";
import "./index.css"; // Import custom styles for canvas

// Generate consistent colors for speakers
const getSpeakerColor = (speakerId: string, index: number): string => {
  const colors = [
    "#3b82f6", // blue
    "#10b981", // green
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#8b5cf6", // violet
    "#f59e0b", // amber
    "#f97316", // orange
    "#ef4444", // red
  ];
  return colors[index % colors.length];
};

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
      speakerColors.set(
        word.speakerId,
        getSpeakerColor(word.speakerId, colorIndex++),
      );
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
    const lastWord = segments[segments.length - 1];
    segments.push({
      start: segmentStart,
      end: lastWord.end,
      speakerId: currentSpeaker,
      color: speakerColors.get(currentSpeaker) || "#4a5568",
    });
  }

  console.log(segments);

  return segments;
};

export const InteractiveAudio = ({
  segments,
  id,
}: {
  segments: TranscriptionSegment[];
  id: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const { setCurrentTime, registerSeekHandler } = useAudio();

  // Toggle play/pause
  const togglePlayPause = () => {
    console.log("Toggling play/pause");
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const speakerSegments = getSpeakerSegments(segments);

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
      minPxPerSec: 1,
      normalize: true,
      backend: "WebAudio",
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

          // Find which speaker segment this position belongs to
          for (const segment of speakerSegments) {
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
      wavesurfer.seekTo(time / wavesurfer.getDuration());
    });

    // Update current time as audio plays
    wavesurfer.on("timeupdate", (currentTime) => {
      setCurrentTime(currentTime);
    });

    // Also update on seek
    wavesurfer.on("seeking", (currentTime) => {
      setCurrentTime(currentTime);
    });

    // Fetch and load the audio
    const loadAudio = async () => {
      try {
        // Load audio directly from the streaming endpoint
        const audioUrl = `/api/transcriptions/${id}/audio`;
        await wavesurfer.load(audioUrl);
      } catch (err) {
        console.error("Error loading audio:", err);
      }
    };

    loadAudio();

    // Cleanup
    return () => {
      try {
        wavesurfer.destroy();
      } catch (err) {
        console.error("Error destroying wavesurfer:", err);
      }
    };
  }, [id, registerSeekHandler, setCurrentTime]);

  useHotkeys(
    ["alt+space", "ctrl+space", "cmd+space", "shift+space"],
    togglePlayPause,
    {
      preventDefault: true,
      enableOnContentEditable: true,
      useKey: true,
    },
  );
  useHotkeys(["space"], togglePlayPause, {
    preventDefault: true,
    useKey: true,
  });

  return (
    <div className="w-full px-6 pb-0">
      <div className="w-full bg-slate-100 dark:bg-slate-900 h-10 relative rounded-md overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
