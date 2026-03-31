"use client";

import { ChevronDown, ChevronUp, ReplaceIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Label } from "../../../ui/label";
import { Checkbox } from "../../../ui/checkbox";
import { useTranslations } from "@/components/locale-provider";

export interface SearchReplaceToolbarProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  replaceTerm: string;
  onReplaceTermChange: (value: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveChange: (value: boolean) => void;
  wholeWord: boolean;
  onWholeWordChange: (value: boolean) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNextMatch: () => void;
  onPreviousMatch: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  showReplace: boolean;
  onToggleReplace: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  hideReplace?: boolean;
}

export function SearchReplaceToolbar({
  searchTerm,
  onSearchTermChange,
  replaceTerm,
  onReplaceTermChange,
  caseSensitive,
  onCaseSensitiveChange,
  wholeWord,
  onWholeWordChange,
  matchCount,
  currentMatchIndex,
  onNextMatch,
  onPreviousMatch,
  onReplaceCurrent,
  onReplaceAll,
  showReplace,
  onToggleReplace,
  searchInputRef,
  hideReplace = false,
}: SearchReplaceToolbarProps) {
  const t = useTranslations("editor");
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplaceInput, setShowReplaceInput] = useState(false);
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
      <div className="relative">
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
            placeholder={t("search.findPlaceholder")}
            className="pl-7 pr-8"
          />
          {searchTerm && (
            <span className="text-xs text-gray-500 whitespace-nowrap absolute right-2 top-1/2 -translate-y-1/2">
              {matchCount > 0 ? `${currentMatchIndex + 1}/${matchCount}` : "0"}
            </span>
          )}
        </div>

        {/* Search/Replace Options Panel */}
        {isExpanded && (
          <div className="absolute right-0 top-full mt-2 w-60 rounded-md border bg-popover p-3 shadow-md z-50">
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="case-sensitive-toolbar"
                    checked={caseSensitive}
                    onCheckedChange={(value) => onCaseSensitiveChange(!!value)}
                  />
                  <Label
                    htmlFor="case-sensitive-toolbar"
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t("search.matchCase")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="whole-word-toolbar"
                    checked={wholeWord}
                    onCheckedChange={(value) => onWholeWordChange(!!value)}
                  />
                  <Label
                    htmlFor="whole-word-toolbar"
                    className="text-sm font-normal cursor-pointer"
                  >
                    {t("search.wholeWord")}
                  </Label>
                </div>
                {!hideReplace && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="replace-toggle-toolbar"
                      checked={showReplaceInput}
                      onCheckedChange={(value) => setShowReplaceInput(!!value)}
                    />
                    <Label
                      htmlFor="replace-toggle-toolbar"
                      className="text-sm font-normal cursor-pointer"
                    >
                      {t("search.replace")}
                    </Label>
                  </div>
                )}
              </div>

              {/* Replace Input */}
              {showReplaceInput && (
                <div>
                  <Label htmlFor="replace-input" className="text-xs mb-1 block">
                    {t("search.replaceWith")}
                  </Label>
                  <Input
                    id="replace-input"
                    type="text"
                    value={replaceTerm}
                    onChange={(e) => onReplaceTermChange(e.target.value)}
                    placeholder={t("search.replacePlaceholder")}
                    className="h-7 text-sm"
                  />
                </div>
              )}

              {/* Replace Actions */}
              {showReplaceInput && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      onReplaceCurrent();
                    }}
                    disabled={matchCount === 0}
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                  >
                    {t("search.replace")}
                  </Button>
                  <Button
                    onClick={() => {
                      onReplaceAll();
                    }}
                    disabled={matchCount === 0}
                    variant="outline"
                    size="sm"
                    className="flex-1 h-7 text-xs"
                  >
                    {t("search.replaceAll", { count: matchCount })}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="space-x-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreviousMatch}
          disabled={matchCount === 0 || !searchTerm}
          className="h-7 w-7 p-0"
          title={t("search.previous")}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNextMatch}
          disabled={matchCount === 0 || !searchTerm}
          className="h-7 w-7 p-0"
          title={t("search.next")}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
