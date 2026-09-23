"use client";

import { useTranslations } from "@/components/locale-provider";
import {
  DOCUMENT_PHASES,
  WORKSPACE_ACCENT,
  type DocumentPhase,
} from "@/components/transcriptions/editor/phase";
import { cn } from "@/lib/utils/utils";

/** How deep the point of a step bites into the next one, in pixels. */
const ARROW = 8;

/**
 * The clip that turns a rectangle into one step of a chevron: a point on the
 * right, a matching notch on the left. The ends of the run keep their straight
 * edge, so the whole control is still a rounded rectangle from the outside.
 */
function stepClip(first: boolean, last: boolean): string | undefined {
  const point = last
    ? "100% 0, 100% 100%"
    : `calc(100% - ${ARROW}px) 0, 100% 50%, calc(100% - ${ARROW}px) 100%`;
  const notch = first ? "" : `, ${ARROW}px 50%`;
  return `polygon(0 0, ${point}, 0 100%${notch})`;
}

/**
 * Switches the document between its phases. Sits next to the title because the phase
 * qualifies the document you are looking at — "this interview, being coded" — rather
 * than being one more action in the toolbar.
 *
 * Shaped as a chevron rather than as two equal pills: the phases are a PROGRESSION,
 * not a pair of unrelated views — you transcribe, then you code, then (one day) you
 * analyse. Each step points into the next, which says that much without a word of
 * interface text, and the selected one carries the colour of its space, the same one
 * the rule under the header and the sidebar's phase headers use.
 */
export function DocumentPhaseSwitch({
  phase,
  onChange,
}: {
  phase: DocumentPhase;
  onChange: (phase: DocumentPhase) => void;
}) {
  const t = useTranslations("codebook.coding.phase");

  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className="flex shrink-0 items-center overflow-hidden rounded-md border bg-muted/40"
    >
      {DOCUMENT_PHASES.map((value, index) => {
        const first = index === 0;
        const last = index === DOCUMENT_PHASES.length - 1;
        const selected = phase === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(value)}
            // The notch of a step sits ON TOP of the point of the one before it,
            // so the two interlock instead of leaving a gap the container's
            // background would show through.
            style={{
              clipPath: stepClip(first, last),
              marginLeft: first ? 0 : -ARROW,
            }}
            className={cn(
              "relative isolate h-7 text-xs font-medium transition-colors",
              // Room for the geometry: the point eats into the right padding, the
              // notch into the left one.
              first ? "pl-2.5" : "pl-4",
              last ? "pr-2.5" : "pr-4",
              selected
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {selected && (
              <span
                aria-hidden
                className={cn(
                  "absolute inset-0 -z-10",
                  WORKSPACE_ACCENT[value].wash,
                )}
              />
            )}
            {t(value)}
          </button>
        );
      })}
    </div>
  );
}
