"use client";

import { useTranslations } from "@/components/locale-provider";
import {
  WORKSPACE_ACCENT,
  WORKSPACE_AREAS,
  type WorkspaceArea,
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
 * Moves between the spaces of the work. Sits next to the title because the space
 * qualifies the document you are looking at — "this interview, being coded" — rather
 * than being one more action in the toolbar.
 *
 * Shaped as a chevron rather than as equal pills: the spaces are a PROGRESSION, not
 * unrelated views — you transcribe, then you code, then you analyse. Each step points
 * into the next, which says that much without a word of interface text, and the
 * selected one carries the colour of its space, the same one the rule under the
 * header and the sidebar's section headers use.
 *
 * `analysis` is offered only when the document belongs to a study, because it is not
 * a pass over this document: it leaves for the study's excerpt table, filtered to the
 * interview you were reading. A loose document has no corpus to analyse.
 */
export function DocumentPhaseSwitch({
  area,
  areas = WORKSPACE_AREAS,
  onChange,
}: {
  area: WorkspaceArea;
  /** Which steps to offer, in order. Defaults to all three. */
  areas?: readonly WorkspaceArea[];
  onChange: (area: WorkspaceArea) => void;
}) {
  const t = useTranslations("codebook.coding.phase");

  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className="flex shrink-0 items-center overflow-hidden rounded-md border bg-muted/40"
    >
      {areas.map((value, index) => {
        const first = index === 0;
        const last = index === areas.length - 1;
        const selected = area === value;
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
