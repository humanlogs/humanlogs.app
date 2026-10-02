"use client";

import { useTranslations } from "@/components/locale-provider";
import {
  DOCUMENT_PHASES,
  type DocumentPhase,
} from "@/components/transcriptions/editor/phase";
import { cn } from "@/lib/utils/utils";

/**
 * Switches the document between its phases. Sits next to the title because the phase
 * qualifies the document you are looking at — "this interview, being coded" — rather
 * than being one more action in the toolbar.
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
      className="flex shrink-0 items-center gap-0.5 rounded-md border bg-muted/40 p-0.5"
    >
      {DOCUMENT_PHASES.map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={phase === value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded px-2 py-1 text-xs font-medium transition-colors",
            phase === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(value)}
        </button>
      ))}
    </div>
  );
}
