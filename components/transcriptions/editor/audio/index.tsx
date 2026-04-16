"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { UserCursor } from "../../../../hooks/use-transcription-cursors";
import { TranscriptionSegment } from "../../../../hooks/use-transcriptions";
import { downloadAndDecryptAudio } from "../../../../lib/audio/audio-decryption.browser";
import "../index.css"; // Import custom styles for canvas
import { EditorAPI } from "../text/api";
import { useAudio } from "./audio-context";
import { CollaborationTicks } from "./collaboration";
import {
  AudioControls,
  getSpeakerSegments,
  loadWaveformPeaks,
  saveWaveformPeaks,
  WaveformLoader,
} from "./helpers";

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
  const audioMediaRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const onTimeUpdateRef = useRef<(currentTime: number) => void>(() => {});
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speakerSegmentsRef = useRef<
    (Partial<TranscriptionSegment> & { color: string })[]
  >([]);
  const wasPlayingRef = useRef<boolean>(false); // Track playing state across re-renders
  const { setCurrentTime, registerSeekHandler } = useAudio();
  const segmentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeedVal] = useState(1);
  const [totalDuration, setTotalDuration] = useState<number | undefined>(0);
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (audioMediaRef.current) {
      if (audioMediaRef.current.paused) {
        audioMediaRef.current.play();
      } else {
        audioMediaRef.current.pause();
      }
    }
  }, []);

  // Pause audio
  const pause = useCallback(() => {
    if (audioMediaRef.current) {
      audioMediaRef.current.pause();
    }
    if (segmentTimeoutRef.current) {
      clearTimeout(segmentTimeoutRef.current);
      segmentTimeoutRef.current = null;
    }
  }, []);

  // Play audio
  const play = useCallback(() => {
    if (audioMediaRef.current) {
      audioMediaRef.current.play();
    }
  }, []);

  // Seek to specific time
  const seekTo = useCallback((time: number) => {
    if (audioMediaRef.current) {
      const duration = audioMediaRef.current.duration;
      if (duration > 0) {
        audioMediaRef.current.currentTime = Math.min(time, duration);
        if (wavesurferRef.current) {
          wavesurferRef.current.seekTo(time / duration);
        }
      }
    }
  }, []);

  // Set playback speed (with pitch preservation)
  const setPlaybackSpeed = useCallback((speed: number) => {
    if (audioMediaRef.current) {
      audioMediaRef.current.preservesPitch = true;
      audioMediaRef.current.playbackRate = speed;
      setPlaybackSpeedVal(speed);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create audio element for this effect lifecycle
    audioMediaRef.current = new Audio();
    (window as any).audioMedia = audioMediaRef.current; // Expose for debugging

    // Show loading state
    setIsLoadingWaveform(true);

    // Initialize speaker segments from current segments
    speakerSegmentsRef.current = getSpeakerSegments(editorAPI.getSegments());

    // Initialize wavesurfer and load cached peaks asynchronously
    const initWavesurfer = async () => {
      // Check for cached waveform peaks and duration
      const cachedData = await loadWaveformPeaks(id);
      if (cachedData) {
        console.log("[Audio] Using cached waveform, skipping audio decode");
        // Set duration from cache immediately
        setTotalDuration(cachedData.duration);
      }

      // Initialize wavesurfer with symmetrical mono waveform
      const wavesurfer = WaveSurfer.create({
        container: containerRef.current!,
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
        peaks: cachedData?.peaks || undefined, // Use cached peaks if available
        duration: cachedData?.duration || undefined, // Use cached duration if available
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
            const barHeight = value * halfHeight;

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

      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      wavesurferRef.current = wavesurfer;

      wavesurfer.on("ready", () => {
        const duration = wavesurfer.getDuration();
        console.log("[Audio] Wavesurfer finished loading, duration:", duration);
        setIsLoadingWaveform(false);

        // Cache the waveform peaks and duration if not already cached
        if (!cachedData) {
          (async () => {
            try {
              const peaks = wavesurfer.exportPeaks();
              await saveWaveformPeaks(id, peaks, duration);
            } catch (e) {
              console.warn("[Audio] Failed to export/cache peaks:", e);
            }
          })();
        }
      });

      wavesurfer.on("interaction", (currentTime) => {
        seekTo(currentTime);
      });

      // Register seek handler for audio context
      registerSeekHandler((time: number) => {
        try {
          seekTo(time);
        } catch (e) {
          console.log("Error seeking audio:", e);
        }
      });

      // Also update on seek
      audioMediaRef.current?.addEventListener("seeking", () => {
        const currentTime = audioMediaRef.current?.currentTime || 0;
        setCurrentTime(currentTime);
        if (onTimeUpdateRef.current) onTimeUpdateRef.current(currentTime);
        if (wavesurferRef.current)
          wavesurferRef.current.seekTo(
            currentTime / (audioMediaRef.current?.duration || 1),
          );
      });

      audioMediaRef.current?.addEventListener("load", () => {
        const duration = audioMediaRef.current?.duration || 0;
        setTotalDuration(duration);
      });

      // Track play/pause state
      audioMediaRef.current?.addEventListener("play", () => {
        clearInterval(timeUpdateIntervalRef.current!);
        timeUpdateIntervalRef.current = setInterval(() => {
          // Update time as audio plays
          const currentTime = audioMediaRef.current?.currentTime || 0;
          setCurrentTime(currentTime);
          if (onTimeUpdateRef.current) onTimeUpdateRef.current(currentTime);
        }, 43);
        wasPlayingRef.current = true;
        setIsPlaying(true);
      });

      audioMediaRef.current?.addEventListener("pause", () => {
        clearInterval(timeUpdateIntervalRef.current!);
        wasPlayingRef.current = false;
        setIsPlaying(false);
      });

      // Fetch and load the audio
      const loadAudio = async () => {
        if (!audioMediaRef.current) return;
        try {
          if (!audioFileEncryption) {
            // No encryption, load directly
            const audioUrl = `/api/transcriptions/${id}/audio`;
            console.log("[Audio] Loading audio from server:", audioUrl);
            audioMediaRef.current!.src = audioUrl;
            audioMediaRef.current!.load(); // Explicitly load the audio element
            await wavesurfer.load(audioUrl!);
            console.log("[Audio] Got audio from server");
          } else {
            // Download and decrypt the audio file
            console.log("[Audio] Downloading encrypted audio from server");
            const decryptedBlob = await downloadAndDecryptAudio(
              id,
              audioFileEncryption,
            );
            console.log(
              "[Audio] Got audio from server and decrypted it - blob size:",
              (decryptedBlob.size / 1024 / 1024).toFixed(2),
              "MB, type:",
              decryptedBlob.type,
            );

            // Create blob URL and load into wavesurfer
            // Keep the blob URL alive for the entire component lifecycle to support seeking
            const blobUrl = URL.createObjectURL(decryptedBlob);
            blobUrlRef.current = blobUrl;
            console.log("[Audio] Created blob URL, loading into WaveSurfer...");
            audioMediaRef.current!.src = blobUrl;
            audioMediaRef.current!.load(); // Explicitly load the audio element
            await wavesurfer.load(blobUrl!);
            console.log("[Audio] WaveSurfer load() completed");
          }
        } catch (err) {
          console.error("Error loading audio:", err);
        }
      };

      loadAudio();
    };

    initWavesurfer();

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
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      clearInterval(timeUpdateIntervalRef.current!);
      if (audioMediaRef.current) {
        console.log("[Audio] Cleaning up audio element");
        audioMediaRef.current.pause();
        audioMediaRef.current.src = "";
        audioMediaRef.current.load();
        audioMediaRef.current = null;
      }
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
    if (onAudioControlsReady) {
      onAudioControlsReady({
        isPlaying,
        playbackSpeed,
        totalDuration,
        togglePlayPause,
        pause,
        play,
        seekTo,
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
    setPlaybackSpeed,
  ]);

  return (
    <div className="w-full pb-0 px-4">
      <div className="w-full bg-slate-100 dark:bg-slate-900 h-10 relative overflow-visible rounded-b-md mb-5">
        {/* Show loading placeholder while waveform is loading */}
        {isLoadingWaveform && (
          <div className="absolute inset-0 z-20">
            <WaveformLoader />
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
        {/* Render cursor indicators */}
        <CollaborationTicks
          totalDuration={totalDuration || 0}
          cursors={cursors}
          editorAPI={editorAPI}
        />
      </div>
    </div>
  );
};
