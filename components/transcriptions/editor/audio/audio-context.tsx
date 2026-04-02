"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

type NearestWord = {
  paragraphId: string;
  wordIndex: number;
  distance: number;
};

type AudioContextType = {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  seekTo: (time: number) => void;
  onSeek?: (time: number) => void;
  registerSeekHandler: (handler: (time: number) => void) => void;
  reportNearestWord: (
    paragraphId: string,
    wordIndex: number,
    distance: number,
  ) => void;
  shouldHighlight: (paragraphId: string, wordIndex: number) => boolean;
};

const AudioContext = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [seekHandler, setSeekHandler] = useState<
    ((time: number) => void) | null
  >(null);
  const nearestWordsRef = useRef<Map<string, NearestWord>>(new Map());
  const globalNearestRef = useRef<NearestWord | null>(null);

  const seekTo = useCallback(
    (time: number) => {
      if (seekHandler) {
        seekHandler(time);
      }
    },
    [seekHandler],
  );

  const registerSeekHandler = useCallback((handler: (time: number) => void) => {
    setSeekHandler(() => handler);
  }, []);

  const reportNearestWord = useCallback(
    (paragraphId: string, wordIndex: number, distance: number) => {
      nearestWordsRef.current.set(paragraphId, {
        paragraphId,
        wordIndex,
        distance,
      });

      // Find the global nearest word
      let globalNearest: NearestWord | null = null;
      let minDistance = Infinity;

      nearestWordsRef.current.forEach((word) => {
        if (word.distance < minDistance) {
          minDistance = word.distance;
          globalNearest = word;
        }
      });

      globalNearestRef.current = globalNearest;
    },
    [],
  );

  const shouldHighlight = useCallback(
    (paragraphId: string, wordIndex: number) => {
      const global = globalNearestRef.current;
      if (!global) return false;
      return (
        global.paragraphId === paragraphId && global.wordIndex === wordIndex
      );
    },
    [],
  );

  return (
    <AudioContext.Provider
      value={{
        currentTime,
        setCurrentTime,
        seekTo,
        registerSeekHandler,
        reportNearestWord,
        shouldHighlight,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within AudioProvider");
  }
  return context;
}
