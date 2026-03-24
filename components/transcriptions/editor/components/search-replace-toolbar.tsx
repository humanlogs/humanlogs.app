"use client";

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";

interface SearchReplaceToolbarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  replaceTerm: string;
  onReplaceTermChange: (value: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: (value: boolean) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPreviousMatch: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  showReplace: boolean;
  onToggleReplace: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function SearchReplaceToolbar({
  searchTerm,
  onSearchTermChange,
  replaceTerm,
  onReplaceTermChange,
  caseSensitive,
  onCaseSensitiveChange,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPreviousMatch,
  onReplaceCurrent,
  onReplaceAll,
  showReplace,
  onToggleReplace,
  searchInputRef,
}: SearchReplaceToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isExpanded]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-1.5 ml-auto"
    >
      {/* Search Input with Navigation */}
      <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 rounded-md px-2 py-1 border border-gray-200 dark:border-gray-700">
        <Search className="h-3.5 w-3.5 text-gray-400" />
        <Input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) {
                onPreviousMatch();
              } else {
                onNextMatch();
              }
            } else if (e.key === "Escape") {
              e.currentTarget.blur();
              setIsExpanded(false);
            }
          }}
          placeholder="Find..."
          className="h-6 text-sm border-0 bg-transparent px-1 py-0 focus-visible:ring-0 focus-visible:ring-offset-0 w-32"
        />
        {searchTerm && (
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : "0"}
          </span>
        )}
      </div>

      {/* Navigation Buttons */}
      {searchTerm && (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPreviousMatch}
            disabled={matchCount === 0}
            className="h-7 w-7 p-0"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNextMatch}
            disabled={matchCount === 0}
            className="h-7 w-7 p-0"
            title="Next (Enter)"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      {/* Replace Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleReplace}
        className={`h-7 px-2 text-xs ${showReplace ? "bg-gray-100 dark:bg-gray-800" : ""}`}
        title="Toggle Replace"
      >
        Replace
      </Button>

      {/* Expanded Options Dropdown */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-50 w-72">
          <div className="space-y-3">
            {/* Replace Input */}
            {showReplace && (
              <div>
                <Label htmlFor="replace-input" className="text-xs mb-1 block">
                  Replace with
                </Label>
                <Input
                  id="replace-input"
                  type="text"
                  value={replaceTerm}
                  onChange={(e) => onReplaceTermChange(e.target.value)}
                  placeholder="Replace..."
                  className="h-7 text-sm"
                />
              </div>
            )}

            {/* Options */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="case-sensitive-toolbar"
                checked={caseSensitive}
                onChange={(e) => onCaseSensitiveChange(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              <Label
                htmlFor="case-sensitive-toolbar"
                className="text-xs cursor-pointer"
              >
                Match case
              </Label>
            </div>

            {/* Replace Actions */}
            {showReplace && (
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    onReplaceCurrent();
                    setIsExpanded(false);
                  }}
                  disabled={matchCount === 0}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                >
                  Replace
                </Button>
                <Button
                  onClick={() => {
                    onReplaceAll();
                    setIsExpanded(false);
                  }}
                  disabled={matchCount === 0}
                  variant="outline"
                  size="sm"
                  className="flex-1 h-7 text-xs"
                >
                  All ({matchCount})
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
