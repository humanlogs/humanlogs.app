"use client";

import { CodeDot } from "@/components/codebooks/coding-menu";
import { useTranslations } from "@/components/locale-provider";
import { Select } from "@/components/ui/select";
import type { DecryptedCodebook } from "@/lib/codebooks/codebook";
import {
  codeKey,
  type CodingOption,
  type CodingScope,
} from "@/lib/codebooks/coding";
import { cn } from "@/lib/utils/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

/**
 * The always-visible coding bar: every top-level code as a button, and the legend that
 * says what the colours in the transcript mean — the same row does both, because they
 * are the same information and a separate legend would only be one more thing to
 * cross-reference.
 *
 * The letter on each chip is the shortcut, so the bar also teaches the keyboard path it
 * exists to make unnecessary.
 */
export function CodingBar({
  level,
  trail,
  onBack,
  appliedKeys,
  onPick,
  codebooks,
  codebookId,
  onCodebookChange,
  scope,
  onScopeChange,
  disabled,
}: {
  /** The codes currently shown: the top level, or the sub-codes we opened into. */
  level: CodingOption[];
  /** The codes we opened into, outermost first. Empty at the top level. */
  trail: CodingOption[];
  onBack: () => void;
  appliedKeys: Set<string>;
  onPick: (option: CodingOption) => void;
  /** The verbatim codebooks in scope — the prisms available for this study. */
  codebooks: DecryptedCodebook[];
  codebookId: string | null;
  onCodebookChange: (id: string) => void;
  scope: CodingScope;
  onScopeChange: (scope: CodingScope) => void;
  /** No selection: the chips are a legend only. */
  disabled: boolean;
}) {
  const t = useTranslations("codebook.coding");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* The prism first: it decides what the rest of the row means. */}
      <Select
        size="sm"
        className="w-52 shrink-0"
        options={codebooks.map((c) => ({
          value: c.id,
          label: c.name || t("untitled"),
        }))}
        value={codebookId ?? undefined}
        onChange={onCodebookChange}
        placeholder={t("codebook")}
        disabled={codebooks.length === 0}
      />

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {/* Inside a group, the way out comes first — a row of sub-codes with no
            visible parent reads as a different codebook, not as a level. */}
        {trail.length > 0 && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onBack();
            }}
            title={trail.map((option) => option.code.label).join(" › ")}
          >
            <span className="inline-flex h-7 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-md border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:bg-accent">
              <ChevronLeftIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {trail[trail.length - 1].code.label}
              </span>
              <kbd className="shrink-0 rounded border bg-muted px-1 font-mono text-[10px] leading-4">
                Esc
              </kbd>
            </span>
          </button>
        )}

        {level.map((option) => (
          <CodeChip
            key={codeKey(option.codebookId, option.code.id)}
            option={option}
            appliedKeys={appliedKeys}
            onPick={onPick}
            disabled={disabled}
          />
        ))}
        {level.length === 0 && (
          <span className="text-xs text-muted-foreground">{t("noCodes")}</span>
        )}
      </div>

      <Select
        size="sm"
        className="w-44 shrink-0"
        options={[
          { value: "mine", label: t("scope.mine") },
          { value: "everyone", label: t("scope.everyone") },
        ]}
        value={scope}
        onChange={(value) => onScopeChange(value as CodingScope)}
      />
    </div>
  );
}

function CodeChip({
  option,
  appliedKeys,
  onPick,
  disabled,
}: {
  option: CodingOption;
  appliedKeys: Set<string>;
  onPick: (option: CodingOption) => void;
  disabled: boolean;
}) {
  const applied = appliedKeys.has(codeKey(option.codebookId, option.code.id));

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // The selection is the thing being coded: a plain click would blur the
        // editor and collapse it before the handler ran.
        e.preventDefault();
        if (!disabled) onPick(option);
      }}
      title={option.code.description || option.code.label}
    >
      <span
        className={cn(
          "inline-flex h-7 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
          disabled ? "opacity-60" : "hover:bg-accent",
          applied && "border-foreground/30 bg-accent",
        )}
      >
        <CodeDot color={option.color} />
        <span className="truncate">{option.code.label}</span>
        <kbd className="shrink-0 rounded border bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground">
          {option.letter}
        </kbd>
        {/* A group is applied AND opened by the same press, so the arrow says
            "there is more under this", not "this is only a menu". */}
        {option.children.length > 0 && (
          <ChevronRightIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </span>
    </button>
  );
}
