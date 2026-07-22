"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

export type InlineOption = { value: string; label: string; desc?: string };

/**
 * A discreet, inline editable choice: renders the current value as an
 * underlined link with a chevron, and opens a small dropdown to change it.
 *
 * Used to keep secondary onboarding settings (data residency, volume, language)
 * present but unobtrusive — they read like text, yet stay configurable.
 */
export function InlineChoice({
  value,
  options,
  onChange,
  icon,
  align = "left",
}: {
  value: string;
  options: InlineOption[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {icon}
        {current?.label ?? value}
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Click-outside catcher */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            className={`absolute z-50 mt-1.5 min-w-[240px] rounded-xl border bg-popover p-1 text-popover-foreground shadow-xl ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent ${
                  o.value === value ? "bg-accent" : ""
                }`}
              >
                <span className="text-sm font-medium">{o.label}</span>
                {o.desc && (
                  <span className="text-xs text-muted-foreground">{o.desc}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}
