"use client";

import { useCallback, useMemo, useState } from "react";
import { TranscriptionSegment } from "@/hooks/use-transcriptions";

export interface SearchMatch {
  segmentIndex: number;
  matchIndex: number; // Index within the segment's text
  length: number;
}

export function useSearchReplace(
  segments: TranscriptionSegment[],
  onChange: (segments: TranscriptionSegment[]) => void,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Find all matches in the segments
  const findMatches = useCallback(
    (
      term: string,
      isCaseSensitive: boolean,
      isWholeWord: boolean,
    ): SearchMatch[] => {
      if (!term) return [];

      const matches: SearchMatch[] = [];
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = isWholeWord ? `\\b${escapedTerm}\\b` : escapedTerm;
      const searchRegex = new RegExp(pattern, isCaseSensitive ? "g" : "gi");

      segments.forEach((segment, segmentIndex) => {
        if (segment.type !== "word") return;

        const text = segment.text;
        let match;
        searchRegex.lastIndex = 0; // Reset regex state
        while ((match = searchRegex.exec(text)) !== null) {
          matches.push({
            segmentIndex,
            matchIndex: match.index,
            length: match[0].length,
          });
        }
      });

      return matches;
    },
    [segments],
  );

  // Get all matches
  const matches = useMemo(
    () => (searchTerm ? findMatches(searchTerm, caseSensitive, wholeWord) : []),
    [searchTerm, caseSensitive, wholeWord, findMatches],
  );
  const matchCount = matches.length;

  // Navigate to next match
  const nextMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => {
      const next = (prev + 1) % matchCount;
      return next;
    });
  }, [matchCount]);

  // Navigate to previous match
  const previousMatch = useCallback(() => {
    if (matchCount === 0) return;
    setCurrentMatchIndex((prev) => {
      const next = (prev - 1 + matchCount) % matchCount;
      return next;
    });
  }, [matchCount]);

  // Replace all occurrences
  const replaceAll = useCallback(() => {
    if (!searchTerm) return;

    const allMatches = findMatches(searchTerm, caseSensitive, wholeWord);
    if (allMatches.length === 0) return;

    // Create new segments array with replacements
    const newSegments = [...segments];
    const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = wholeWord ? `\\b${escapedTerm}\\b` : escapedTerm;
    const searchRegex = new RegExp(pattern, caseSensitive ? "g" : "gi");

    allMatches.forEach(({ segmentIndex }) => {
      const segment = newSegments[segmentIndex];
      if (segment.type === "word") {
        newSegments[segmentIndex] = {
          ...segment,
          text: segment.text.replace(searchRegex, replaceTerm),
        };
      }
    });

    onChange(newSegments);
  }, [
    searchTerm,
    replaceTerm,
    caseSensitive,
    wholeWord,
    segments,
    onChange,
    findMatches,
  ]);

  // Replace current occurrence
  const replaceCurrent = useCallback(() => {
    if (!searchTerm || matches.length === 0) return;

    const match = matches[currentMatchIndex];
    const newSegments = [...segments];
    const segment = newSegments[match.segmentIndex];

    if (segment.type === "word") {
      const text = segment.text;
      const newText =
        text.substring(0, match.matchIndex) +
        replaceTerm +
        text.substring(match.matchIndex + match.length);

      newSegments[match.segmentIndex] = {
        ...segment,
        text: newText,
      };
    }

    onChange(newSegments);
    // After replace, go to next match (or stay at 0 if it was the last one)
    if (currentMatchIndex >= matches.length - 1) {
      setCurrentMatchIndex(0);
    }
  }, [searchTerm, replaceTerm, matches, currentMatchIndex, segments, onChange]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleReplace = useCallback(() => setIsOpen((prev) => !prev), []);

  // Reset current match index when search or case sensitivity changes
  const effectiveCurrentIndex = matchCount > 0 ? currentMatchIndex : 0;

  return {
    isOpen,
    open,
    close,
    toggleReplace,
    searchTerm,
    setSearchTerm,
    replaceTerm,
    setReplaceTerm,
    caseSensitive,
    setCaseSensitive,
    wholeWord,
    setWholeWord,
    matches,
    matchCount,
    currentMatchIndex: effectiveCurrentIndex,
    nextMatch,
    previousMatch,
    replaceCurrent,
    replaceAll,
  };
}
