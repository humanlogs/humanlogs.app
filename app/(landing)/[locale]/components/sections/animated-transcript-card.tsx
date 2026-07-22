"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { KaraokeWord, karaokeState } from "@/components/ui/karaoke-text";
import { useKaraoke } from "@/hooks/use-karaoke";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FakeToolbar } from "./fake-toolbar";

// Transcript sentences
const TRANSCRIPT_TEXTS = {
  en: [
    "So um, why did you create humanlogs?",
    "Honestly, I was just tired of switching back and forth between my text editor and audio player all the time.",
    "[laughs] That was reason enough for me.",
    "Now I click any word and it jumps straight to the audio (pause) it’s so much faster.",
  ],
  fr: [
    "Alors, pourquoi humanlogs ?",
    "C'est simple, je n'en pouvais plus de devoir constamment passer de mon éditeur de texte à mon lecteur audio.",
    "[rires] Oui c'est une bonne raison !",
    "Maintenant je clique sur n'importe quel mot et ça me mène directement à l'audio (pause) c'est tellement plus rapide.",
  ],
};

// Synonym groups - each inner array contains synonymous words
const SYNONYMS = {
  en: [
    ["um", "[uh]", "well"],
    ["create", "build"],
    ["Honestly", "To be honest", "Honestly speaking"],
    ["tired", "fed up"],
    ["switching", "jumping", "moving"],
    ["That", "This", "It"],
    ["click", "point", "select"],
    ["jumps", "skips", "moves"],
  ],
  fr: [
    ["Alors", "Donc"],
    ["simple", "facile"],
    ["constamment", "sans cesse"],
    ["passer", "basculer"],
    ["Maintenant", "Désormais"],
    ["clique", "sélectionne"],
    ["mène directement", "emmène directement"],
  ],
};

// Speaker assignments (cycles through speakers)
const SPEAKERS = [
  { name: "Speaker 2", color: "bg-green-100 text-green-900 border-green-300" },
  { name: "Speaker 1", color: "bg-blue-100 text-blue-900 border-blue-300" },
  { name: "Speaker 3", color: "bg-pink-100 text-pink-900 border-pink-300" },
  { name: "Speaker 1", color: "bg-blue-100 text-blue-900 border-blue-300" },
];

interface AnimatedTranscriptCardProps {
  showHoverOverlay?: boolean;
}

// Parse text into words with their positions
interface WordData {
  text: string;
  sentenceIdx: number;
  wordIdx: number;
  speaker: (typeof SPEAKERS)[number];
}

const parseTranscript = (locale: string): WordData[] => {
  const words: WordData[] = [];
  (TRANSCRIPT_TEXTS[locale as "en"] || TRANSCRIPT_TEXTS["en"]).forEach(
    (text, sentenceIdx) => {
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
    },
  );
  return words;
};

// Find synonym for a word (case-insensitive)
const findSynonym = (word: string, locale: string): string | null => {
  const cleanWord = word.replace(/[.,!?]/g, "").toLowerCase();

  for (const synonymGroup of SYNONYMS[locale as "en"] || SYNONYMS["en"]) {
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

export const AnimatedTranscriptCard = ({
  showHoverOverlay = true,
}: AnimatedTranscriptCardProps) => {
  const t = useTranslations("transcriptCard");
  const { locale } = useLocale() || "en";
  const [wordStates, setWordStates] = useState<Map<number, string>>(new Map());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Parsed once (stable identity) from the initial locale.
  const [words] = useState<WordData[]>(() => parseTranscript(locale));
  const [wordTexts] = useState<string[]>(() => words.map((w) => w.text));

  // The "currently spoken" cursor is driven by the shared karaoke timeline
  // (dwell scales with word length). Editable words also get typed into: the
  // synonym replacement runs as a side effect while the timeline holds on the
  // word for the extra dwell we return.
  const activeWordIndex = useKaraoke(wordTexts, {
    loop: true,
    onWord: (index, word) => {
      const synonym = findSynonym(word, locale);
      const shouldEdit = synonym && Math.random() < 0.5; // 50% chance to edit
      if (!shouldEdit || !synonym) return; // length-based default dwell

      // Clear the word, then type the synonym letter by letter.
      setWordStates((prev) => new Map(prev).set(index, ""));
      timeoutRef.current = setTimeout(() => {
        let typedText = "";
        intervalRef.current = setInterval(() => {
          if (typedText.length < synonym.length) {
            typedText += synonym[typedText.length];
            setWordStates((prev) => new Map(prev).set(index, typedText));
          } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setWordStates((prev) => new Map(prev).set(index, synonym));
          }
        }, 50);
      }, 150);

      // Hold on the word for the type-in plus a short pause before moving on.
      return 150 + 50 * synonym.length + (50 * synonym.length + Math.random() * 100);
    },
    isLineEnd: (index) =>
      words[index + 1]?.sentenceIdx !== words[index]?.sentenceIdx,
  });

  // Tear down any in-flight typing timers on unmount.
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    [],
  );

  // Group words by sentence
  const groupedBySentence: { [key: number]: WordData[] } = {};
  words.forEach((word) => {
    if (!groupedBySentence[word.sentenceIdx]) {
      groupedBySentence[word.sentenceIdx] = [];
    }
    groupedBySentence[word.sentenceIdx].push(word);
  });

  return (
    <div className="relative group bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
      {/* Hover Overlay */}
      {showHoverOverlay && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex items-center justify-center">
          <Link
            href="/app/login"
            className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {t("tryItYourself")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

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
                    const customText = wordStates.get(globalIdx);
                    const displayText =
                      customText !== undefined ? customText : word.text;

                    return (
                      <KaraokeWord
                        key={idx}
                        state={karaokeState(globalIdx, activeWordIndex)}
                        tone="muted"
                        snapActive
                        className="mx-[-1px]"
                      >
                        {displayText || "\u00A0"}
                      </KaraokeWord>
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
