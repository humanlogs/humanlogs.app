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

// Cache keys for waveform peaks
const WAVEFORM_DB_NAME = "waveform_cache";
const WAVEFORM_STORE_NAME = "peaks";
const WAVEFORM_VERSION = 1;

// Initialize IndexedDB for waveform peaks
function getWaveformDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WAVEFORM_DB_NAME, WAVEFORM_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(WAVEFORM_STORE_NAME)) {
        db.createObjectStore(WAVEFORM_STORE_NAME);
      }
    };
  });
}

// Loading placeholder with animated bars
const WaveformLoader = () => {
  const bars = 600; // Number of bars to show (4x more since they're smaller)
  return (
    <div className="w-full h-full flex items-center justify-center gap-[0.5px] px-2">
      {Array.from({ length: bars }).map((_, i) => {
        const randomHeight = Math.random() * 30 + 10; // 10-40% height (2x smaller)
        const randomDelay = Math.random() * 2; // 0-2s delay
        return (
          <div
            key={i}
            className="bg-gray-400 dark:bg-gray-600 rounded-sm animate-pulse"
            style={{
              width: "1px", // 4x smaller width
              height: `${randomHeight}%`,
              animationDelay: `${randomDelay}s`,
              animationDuration: "1.5s",
            }}
          />
        );
      })}
    </div>
  );
};

// Save waveform peaks to IndexedDB
async function saveWaveformPeaks(
  transcriptionId: string,
  peaks: number[][],
): Promise<void> {
  try {
    const db = await getWaveformDB();
    const transaction = db.transaction([WAVEFORM_STORE_NAME], "readwrite");
    const store = transaction.objectStore(WAVEFORM_STORE_NAME);
    await store.put(peaks, transcriptionId);
    console.log(
      "[Audio] Cached waveform peaks in IndexedDB, size:",
      (JSON.stringify(peaks).length / 1024).toFixed(2),
      "KB",
    );
  } catch (e) {
    console.warn("[Audio] Failed to cache waveform peaks:", e);
  }
}

// Load waveform peaks from IndexedDB
async function loadWaveformPeaks(
  transcriptionId: string,
): Promise<number[][] | null> {
  try {
    const db = await getWaveformDB();
    const transaction = db.transaction([WAVEFORM_STORE_NAME], "readonly");
    const store = transaction.objectStore(WAVEFORM_STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(transcriptionId);
      request.onsuccess = () => {
        if (request.result) {
          console.log(
            "[Audio] Found cached waveform peaks in IndexedDB, size:",
            (JSON.stringify(request.result).length / 1024).toFixed(2),
            "KB",
          );
          resolve(request.result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn("[Audio] Failed to load cached waveform peaks:", e);
    return null;
  }
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
  const [isLoadingWaveform, setIsLoadingWaveform] = useState(true);

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

    // Show loading state
    setIsLoadingWaveform(true);

    // Initialize speaker segments from current segments
    speakerSegmentsRef.current = getSpeakerSegments(editorAPI.getSegments());

    // Initialize wavesurfer and load cached peaks asynchronously
    const initWavesurfer = async () => {
      // Check for cached waveform peaks
      const cachedPeaks = await loadWaveformPeaks(id);
      if (cachedPeaks) {
        console.log("[Audio] Using cached waveform, skipping audio decode");
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
        normalize: false, // Disable normalization to speed up loading for long files
        backend: "MediaElement",
        peaks: cachedPeaks || undefined, // Use cached peaks if available
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
        console.log("[Audio] Wavesurfer finished loading, duration:", duration);
        setTotalDuration(duration);
        setIsLoadingWaveform(false);

        // Cache the waveform peaks if not already cached
        if (!cachedPeaks) {
          (async () => {
            try {
              const peaks = wavesurfer.exportPeaks();
              await saveWaveformPeaks(id, peaks);
            } catch (e) {
              console.warn("[Audio] Failed to export/cache peaks:", e);
            }
          })();
        }

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
            console.log("[Audio] Loading audio from server:", audioUrl);
            await wavesurfer.load(audioUrl);
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
            await wavesurfer.load(blobUrl);
            console.log("[Audio] WaveSurfer load() completed");
          }
        } catch (err) {
          console.error("Error loading audio:", err);
        }
      };

      loadAudio();

      return wavesurfer;
    };

    // Initialize and store wavesurfer instance
    let wavesurferInstance: WaveSurfer | null = null;
    initWavesurfer().then((ws) => {
      wavesurferInstance = ws;
    });

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
      if (wavesurferInstance) {
        wavesurferInstance.destroy();
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
        {/* Show loading placeholder while waveform is loading */}
        {isLoadingWaveform && (
          <div className="absolute inset-0 z-20">
            <WaveformLoader />
          </div>
        )}
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
