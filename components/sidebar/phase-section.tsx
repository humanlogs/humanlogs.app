"use client";

import { cn } from "@/lib/utils/utils";
import { ChevronDownIcon } from "lucide-react";

/**
 * One of the two phases of a document — writing the transcript, or coding it —
 * as a collapsible section of the sidebar.
 *
 * The two are EXCLUSIVE: opening one closes the other. They are not two folders
 * you might want open at once but two passes over the same corpus, and a
 * researcher does not switch between them on a single document. Keeping only one
 * open also keeps the column a constant height — listing every document twice
 * would otherwise put the second phase below the fold, and make collapsing a
 * chore rather than a convenience.
 *
 * The header is FILLED when open, because it has to outrank what it contains:
 * the grouping options put their own sub-headers inside, and three levels of
 * heading in a 256px column cannot be told apart by type weight alone. Study,
 * phase and group each get a different device — a tab, a fill, a rule.
 */
export function PhaseSection({
  label,
  count,
  open,
  onOpen,
  accent = false,
  action,
  children,
}: {
  label: string;
  /** Shown on the header, so a closed phase still reports what is inside it. */
  count: string;
  open: boolean;
  onOpen: () => void;
  /** Coding carries the yellow it uses in the editor, so the phase is recognisable. */
  accent?: boolean;
  /** The display-options control, on the open header only. */
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex h-8 items-center gap-1 rounded-md pr-1 transition-colors",
          open && !accent && "bg-sidebar-accent",
          open && accent && "bg-yellow-400/15",
          !open && "hover:bg-sidebar-accent/60",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={open}
          className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 text-left text-[13px] font-semibold"
        >
          <ChevronDownIcon
            className={cn(
              "h-3.5 w-3.5 shrink-0 transition-transform",
              !open && "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-sidebar-foreground/50">
            {count}
          </span>
        </button>
        {open && action}
      </div>

      {open && <div className="flex flex-col pt-0.5 pb-1.5">{children}</div>}
    </div>
  );
}

/**
 * A group header from the display options, inside a phase. Deliberately the
 * quietest of the three headings: small, spaced, trailed by a rule, and indented
 * with the documents it covers so the nesting is read from the left edge rather
 * than from the type.
 */
export function PhaseGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 flex h-6 items-center gap-1.5 pr-2 pl-3.5 text-[11px] font-semibold tracking-wide text-sidebar-foreground/50 uppercase">
      <span className="min-w-0 truncate">{children}</span>
      <span className="h-px min-w-2 flex-1 bg-sidebar-border" />
    </div>
  );
}
