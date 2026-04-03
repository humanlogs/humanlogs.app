"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorAPI } from "../api";
import { useSearchHighlights } from "./use-search-highlights";

export interface SearchMatch {
  position: number; // Character position in the editor text
  length: number;
}

// Remove accents and diacritics from text
function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function useSearchReplace(editorAPI: EditorAPI) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [ignoreAccents, setIgnoreAccents] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Find all matches in the editor text
  const findMatches = useCallback(
    (
      term: string,
      isCaseSensitive: boolean,
      isWholeWord: boolean,
      shouldIgnoreAccents: boolean,
    ): SearchMatch[] => {
      if (!term) return [];

      const editor = editorAPI.getEditor();
      if (!editor) return [];

      const matches: SearchMatch[] = [];
      const editorText = editor.getText();
      const searchTerm = shouldIgnoreAccents ? normalizeText(term) : term;
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = isWholeWord ? `\\b${escapedTerm}\\b` : escapedTerm;
      const searchRegex = new RegExp(pattern, isCaseSensitive ? "g" : "gi");

      const text = shouldIgnoreAccents ? normalizeText(editorText) : editorText;

      let match;
      searchRegex.lastIndex = 0; // Reset regex state
      while ((match = searchRegex.exec(text)) !== null) {
        matches.push({
          position: match.index,
          length: match[0].length,
        });
      }

      return matches;
    },
    [],
  );

  // Get all matches
  const matches = useMemo(
    () =>
      searchTerm
        ? findMatches(searchTerm, caseSensitive, wholeWord, ignoreAccents)
        : [],
    [searchTerm, caseSensitive, wholeWord, ignoreAccents, findMatches],
  );
  const matchCount = matches.length;

  // Reset current match index when matches change or become empty
  useEffect(() => {
    if (matchCount === 0) {
      setCurrentMatchIndex(0);
    } else if (currentMatchIndex >= matchCount) {
      setCurrentMatchIndex(0);
    }
  }, [matchCount, currentMatchIndex]);

  // Navigate to next match
  const nextMatch = useCallback(() => {
    if (matchCount === 0) return;

    const newIndex = (currentMatchIndex + 1) % matchCount;
    setCurrentMatchIndex(newIndex);
  }, [matchCount, currentMatchIndex, matches]);

  // Navigate to previous match
  const previousMatch = useCallback(() => {
    if (matchCount === 0) return;

    const newIndex = (currentMatchIndex - 1 + matchCount) % matchCount;
    setCurrentMatchIndex(newIndex);
  }, [matchCount, currentMatchIndex, matches]);

  // Replace all occurrences
  const replaceAll = useCallback(() => {
    if (!searchTerm) return;

    const editor = editorAPI.getEditor();
    if (!editor) return;

    const allMatches = findMatches(
      searchTerm,
      caseSensitive,
      wholeWord,
      ignoreAccents,
    );
    if (allMatches.length === 0) return;

    // Replace from end to start to maintain position accuracy
    const sortedMatches = [...allMatches].sort(
      (a, b) => b.position - a.position,
    );

    editor.chain().focus();

    sortedMatches.forEach((match) => {
      // Tiptap uses 1-based indexing
      const from = match.position + 1;
      const to = from + match.length;

      editor
        .chain()
        .setTextSelection({ from, to })
        .insertContent(replaceTerm)
        .run();
    });
  }, [
    searchTerm,
    replaceTerm,
    caseSensitive,
    wholeWord,
    ignoreAccents,
    findMatches,
  ]);

  // Replace current occurrence
  const replaceCurrent = useCallback(() => {
    if (!searchTerm || matches.length === 0) return;

    const editor = editorAPI.getEditor();
    if (!editor) return;

    const match = matches[currentMatchIndex];

    // Tiptap uses 1-based indexing
    const from = match.position + 1;
    const to = from + match.length;

    editor
      .chain()
      .focus()
      .setTextSelection({ from, to })
      .insertContent(replaceTerm)
      .run();

    // After replace, go to next match (or stay at 0 if it was the last one)
    if (currentMatchIndex >= matches.length - 1) {
      setCurrentMatchIndex(0);
    }
  }, [searchTerm, replaceTerm, matches, currentMatchIndex]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleReplace = useCallback(
    (val?: boolean) => setIsOpen((prev) => val ?? !prev),
    [],
  );

  // Reset current match index when search or case sensitivity changes
  const effectiveCurrentIndex = matchCount > 0 ? currentMatchIndex : 0;

  const highlights = useSearchHighlights(editorAPI, matches, currentMatchIndex);

  return {
    highlights,
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
    ignoreAccents,
    setIgnoreAccents,
    matches,
    matchCount,
    currentMatchIndex: effectiveCurrentIndex,
    nextMatch,
    previousMatch,
    replaceCurrent,
    replaceAll,
  };
}
