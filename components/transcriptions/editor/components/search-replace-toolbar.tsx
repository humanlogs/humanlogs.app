"use client";

import { ChevronDown, ChevronUp, ReplaceIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export interface SearchReplaceToolbarProps {
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
      className="relative items-center gap-1 ml-auto flex"
    >
      {/* Search Input with Navigation */}
      <DropdownMenu
        trigger={
          <div className="relative">
            <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              autoComplete="off"
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
              className="pl-7 pr-8"
            />
            {searchTerm && (
              <span className="text-xs text-gray-500 whitespace-nowrap absolute right-2 top-1/2 -translate-y-1/2">
                {matchCount > 0
                  ? `${currentMatchIndex + 1}/${matchCount}`
                  : "0"}
              </span>
            )}
          </div>
        }
        align="end"
        position="bottom"
      >
        <DropdownMenuItem>
          <div
            className=""
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="space-y-3">
              {/* Replace Input */}

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
        </DropdownMenuItem>
      </DropdownMenu>

      {/* Navigation Buttons */}
      <div className="space-x-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreviousMatch}
          disabled={matchCount === 0 || !searchTerm}
          className="h-7 w-7 p-0"
          title="Previous (Shift+Enter)"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNextMatch}
          disabled={matchCount === 0 || !searchTerm}
          className="h-7 w-7 p-0"
          title="Next (Enter)"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleReplace}
          className="h-7 w-7 p-0"
          title="Toggle Replace"
          disabled={!searchTerm}
        >
          <ReplaceIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
