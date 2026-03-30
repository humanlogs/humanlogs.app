"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { FakeToolbar } from "./fake-toolbar";

// Transcript sentences
const TRANSCRIPT_TEXTS = [
  "So um, why did you create humanlogs?",
  "Honestly, I was just tired of switching back and forth between my text editor and audio player all the time.",
  "[laughs] That was reason enough for me.",
  "Now I click any word and it jumps straight to the audio (pause) it’s so much faster.",
];

// Synonym groups - each inner array contains synonymous words
const SYNONYMS = [
  ["um", "[uh]", "well"],
  ["create", "build"],
  ["Honestly", "To be honest", "Honestly speaking"],
  ["tired", "fed up"],
  ["switching", "jumping", "moving"],
  ["That", "This", "It"],
  ["click", "point", "select"],
  ["jumps", "skips", "moves"],
];

// Speaker assignments (cycles through speakers)
const SPEAKERS = [
  { name: "Speaker 2", color: "bg-green-100 text-green-900 border-green-300" },
  { name: "Speaker 1", color: "bg-blue-100 text-blue-900 border-blue-300" },
  { name: "Speaker 3", color: "bg-pink-100 text-pink-900 border-pink-300" },
  { name: "Speaker 1", color: "bg-blue-100 text-blue-900 border-blue-300" },
];

// Parse text into words with their positions
interface WordData {
  text: string;
  sentenceIdx: number;
  wordIdx: number;
  speaker: (typeof SPEAKERS)[number];
}

const parseTranscript = (): WordData[] => {
  const words: WordData[] = [];
  TRANSCRIPT_TEXTS.forEach((text, sentenceIdx) => {
    const wordsInSentence = text.split(/(\s+)/); // Preserve spaces
    wordsInSentence.forEach((word, wordIdx) => {
      if (word.trim()) {
        words.push({
          text: word,
          sentenceIdx,
          wordIdx,
          speaker: SPEAKERS[sentenceIdx % SPEAKERS.length],
        });
      }
    });
  });
  return words;
};

// Find synonym for a word (case-insensitive)
const findSynonym = (word: string): string | null => {
  const cleanWord = word.replace(/[.,!?]/g, "").toLowerCase();

  for (const synonymGroup of SYNONYMS) {
    const normalizedGroup = synonymGroup.map((s) => s.toLowerCase());
    const index = normalizedGroup.indexOf(cleanWord);

    if (index !== -1) {
      // Found a match, pick a different random synonym
      const otherSynonyms = synonymGroup.filter((_, i) => i !== index);
      if (otherSynonyms.length > 0) {
        const randomSynonym =
          otherSynonyms[Math.floor(Math.random() * otherSynonyms.length)];

        // Preserve punctuation and capitalization
        const hasPunctuation = word.match(/[.,!?]$/);
        const isCapitalized = word[0] === word[0].toUpperCase();

        let result = randomSynonym;
        if (isCapitalized) {
          result = result.charAt(0).toUpperCase() + result.slice(1);
        }
        if (hasPunctuation) {
          result += hasPunctuation[0];
        }

        return result;
      }
    }
  }

  return null;
};

export const AnimatedTranscriptCard = () => {
  const [wordStates, setWordStates] = useState<Map<number, string>>(new Map());
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wordsRef = useRef<WordData[]>(parseTranscript());

  useEffect(() => {
    const words = wordsRef.current;
    let currentIndex = 0;

    const animateWord = () => {
      if (currentIndex >= words.length) {
        // Loop back to start (keep current word states)
        currentIndex = 0;
        timeoutRef.current = setTimeout(() => animateWord(), 1000);
        return;
      }

      const word = words[currentIndex];
      const synonym = findSynonym(word.text);
      const shouldEdit = synonym && Math.random() < 0.5; // 50% chance to edit

      setActiveWordIndex(currentIndex);

      if (shouldEdit && synonym) {
        // Word has a synonym and we decided to edit it
        setIsEditing(true);

        // Instantly clear the word
        setWordStates((prev) => new Map(prev).set(currentIndex, ""));

        // Small delay before starting to type
        timeoutRef.current = setTimeout(() => {
          // Type new synonym letter by letter
          let typedText = "";
          intervalRef.current = setInterval(() => {
            if (typedText.length < synonym.length) {
              typedText += synonym[typedText.length];
              setWordStates((prev) =>
                new Map(prev).set(currentIndex, typedText),
              );
            } else {
              if (intervalRef.current) clearInterval(intervalRef.current);
              setIsEditing(false);
              setWordStates((prev) => new Map(prev).set(currentIndex, synonym));

              // Pause before moving to next word (slower timing)
              const pauseTime = 50 * synonym.length + Math.random() * 100;
              timeoutRef.current = setTimeout(() => {
                currentIndex++;
                animateWord();
              }, pauseTime);
            }
          }, 50);
        }, 150);
      } else {
        // No synonym or decided not to edit - just pause and move on
        setIsEditing(false);

        const lastOfLine = words.some(
          (w, i) =>
            w.wordIdx === word.wordIdx &&
            w.sentenceIdx === word.sentenceIdx &&
            words[i + 1]?.sentenceIdx !== words[i].sentenceIdx,
        );

        const pauseTime =
          50 * word.text.length + Math.random() * 50 + (lastOfLine ? 200 : 0); // Longer pause at end of sentences
        timeoutRef.current = setTimeout(() => {
          currentIndex++;
          animateWord();
        }, pauseTime);
      }
    };

    animateWord();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const words = wordsRef.current;

  // Group words by sentence
  const groupedBySentence: { [key: number]: WordData[] } = {};
  words.forEach((word) => {
    if (!groupedBySentence[word.sentenceIdx]) {
      groupedBySentence[word.sentenceIdx] = [];
    }
    groupedBySentence[word.sentenceIdx].push(word);
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      <FakeToolbar />
      <div className="p-6 space-y-4">
        {Object.entries(groupedBySentence).map(
          ([sentenceIdx, sentenceWords]) => {
            const speaker = sentenceWords[0].speaker;

            return (
              <div key={sentenceIdx} className="space-y-2">
                <Badge variant="outline" className={speaker.color}>
                  {speaker.name}
                </Badge>
                <div className="text-base leading-relaxed">
                  {sentenceWords.map((word, idx) => {
                    const globalIdx = words.indexOf(word);
                    const isActive = globalIdx === activeWordIndex;
                    const isPast = globalIdx < activeWordIndex;
                    const customText = wordStates.get(globalIdx);
                    const displayText =
                      customText !== undefined ? customText : word.text;

                    return (
                      <span
                        key={idx}
                        className={`
                      inline-block rounded-[5px] px-[1px] mx-[-1px]
                      ${
                        isActive
                          ? "transition-none"
                          : "transition-all duration-200"
                      }
                      ${
                        isActive
                          ? "bg-[color-mix(in_oklab,_rgb(59_130_246)_25%,_transparent)] outline outline-1 outline-[color-mix(in_oklab,_rgb(59_130_246)_50%,_transparent)] outline-offset-1"
                          : isPast
                            ? "text-gray-900"
                            : "text-gray-400"
                      }
                    `}
                        style={{
                          marginRight: "0.25rem",
                        }}
                      >
                        {displayText || "\u00A0"}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          },
        )}
      </div>
    </div>
  );
};
