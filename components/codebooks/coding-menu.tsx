"use client";

import {
  DropdownMenuItem,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { codeKey, type CodingOption } from "@/lib/codebooks/coding";
import { PROJECT_COLORS } from "@/lib/projects/appearance";
import { cn } from "@/lib/utils/utils";
import { CheckIcon } from "lucide-react";
import * as React from "react";

/**
 * The verbatim code menu — the one thing the coding phase is driven from, whether the
 * researcher reaches it with the mouse (this menu) or with the keyboard (the same
 * letters, handled by `use-coding-shortcuts`).
 *
 * Sub-codes are a real submenu rather than an indented list: a codebook with three
 * themes and twenty sub-themes is a wall of text flat, and the letter shortcuts already
 * describe the tree ("A" then "B"), so the menu should show the same shape.
 */

/** The coloured dot that doubles as the legend key. */
export function CodeDot({
  color,
  className,
}: {
  color: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        (color && PROJECT_COLORS[color]) || "bg-muted-foreground/40",
        className,
      )}
    />
  );
}

/** The letter to press, shown as a key cap so it reads as a shortcut, not a bullet. */
export function CodeLetter({ sequence }: { sequence: string | null }) {
  if (!sequence) return null;
  return (
    <kbd className="ml-auto shrink-0 rounded border bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground">
      {sequence}
    </kbd>
  );
}

function CodeRow({
  option,
  applied,
  /** Sub-codes carry no colour of their own yet, so their row shows no dot. */
  showDot,
}: {
  option: CodingOption;
  applied: boolean;
  showDot: boolean;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {showDot && <CodeDot color={option.color} />}
      <span className="truncate">{option.code.label}</span>
      {applied && <CheckIcon className="ml-1 h-3.5 w-3.5 shrink-0" />}
      <CodeLetter sequence={option.sequence} />
    </span>
  );
}

export function CodingMenuItems({
  options,
  appliedKeys,
  onPick,
  depth = 0,
}: {
  options: CodingOption[];
  /** `codebookId:codeId` of every code the current selection already carries. */
  appliedKeys: Set<string>;
  onPick: (option: CodingOption) => void;
  depth?: number;
}) {
  // Every row acts on the passage currently selected, so none of them may take the
  // selection away on mousedown — see `preventBlur`.
  // Name the codebook when the list crosses from one to the next: two codebooks may
  // well hold codes with the same label, and a flat list would not say which is which.
  // Only at the top level — a submenu is already inside one codebook.
  const headers = options.map((option, index) =>
    depth === 0 && option.codebookName !== options[index - 1]?.codebookName
      ? option.codebookName
      : null,
  );

  return (
    <>
      {options.map((option, index) => {
        const header = headers[index];
        const applied = appliedKeys.has(
          codeKey(option.codebookId, option.code.id),
        );

        return (
          <React.Fragment key={`${option.codebookId}:${option.code.id}`}>
            {header && (
              <div className="truncate px-2 py-1 text-xs font-medium text-muted-foreground">
                {header}
              </div>
            )}
            {option.children.length > 0 ? (
              <DropdownMenuSub
                preventBlur
                onTriggerClick={() => onPick(option)}
                trigger={
                  <CodeRow
                    option={option}
                    applied={applied}
                    showDot={depth === 0}
                  />
                }
              >
                <CodingMenuItems
                  options={option.children}
                  appliedKeys={appliedKeys}
                  onPick={onPick}
                  depth={depth + 1}
                />
              </DropdownMenuSub>
            ) : (
              <DropdownMenuItem
                preventClose
                preventBlur
                className="gap-2"
                onClick={() => onPick(option)}
              >
                <CodeRow
                  option={option}
                  applied={applied}
                  showDot={depth === 0}
                />
              </DropdownMenuItem>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
