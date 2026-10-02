"use client";

import { codeKey, type CodingOption } from "@/lib/codebooks/coding";
import { PROJECT_COLORS } from "@/lib/projects/appearance";
import { cn } from "@/lib/utils/utils";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

/**
 * The verbatim code list — the one thing the coding phase is driven from, whether the
 * researcher reaches it with the mouse or by typing the letter shown on each row.
 *
 * It shows ONE level at a time. A code with sub-codes is applied and opened in the
 * same gesture, replacing the list with its children; the back row (and Escape) comes
 * out again. A submenu would have hidden the sub-codes behind a hover and made the
 * keyboard path a different shape from the visible one.
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

/** The key to press, shown as a cap so it reads as a shortcut, not as a bullet. */
export function CodeLetter({ letter }: { letter: string | null }) {
  if (!letter) return null;
  return (
    <kbd className="shrink-0 rounded border bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground">
      {letter}
    </kbd>
  );
}

const ROW =
  "flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground";

/**
 * The row that leaves the level we opened into. Bound to Escape as well, which is what
 * the key cap says — a way out has to be visible, or a group with many sub-codes reads
 * as a dead end.
 */
export function CodingBackRow({
  parent,
  onBack,
}: {
  parent: CodingOption;
  onBack: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(ROW, "text-muted-foreground")}
      onMouseDown={(e) => {
        e.preventDefault(); // the selection is what all of this acts on
        onBack();
      }}
    >
      <ChevronLeftIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{parent.code.label}</span>
      <kbd className="shrink-0 rounded border bg-muted px-1 font-mono text-[10px] leading-4">
        Esc
      </kbd>
    </button>
  );
}

export function CodingLevelList({
  level,
  appliedKeys,
  onPick,
}: {
  level: CodingOption[];
  /** `codebookId:codeId` of every code the current selection already carries. */
  appliedKeys: Set<string>;
  onPick: (option: CodingOption) => void;
}) {
  return (
    <>
      {level.map((option) => {
        const applied = appliedKeys.has(
          codeKey(option.codebookId, option.code.id),
        );
        return (
          <button
            key={codeKey(option.codebookId, option.code.id)}
            type="button"
            className={ROW}
            title={option.code.description || option.code.label}
            onMouseDown={(e) => {
              // Acting on the selected passage: a plain click would blur the editor
              // and collapse it before the handler ran.
              e.preventDefault();
              onPick(option);
            }}
          >
            <CodeDot color={option.color} />
            <span className="min-w-0 flex-1 truncate">{option.code.label}</span>
            {applied && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
            <CodeLetter letter={option.letter} />
            {option.children.length > 0 && (
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </button>
        );
      })}
    </>
  );
}
