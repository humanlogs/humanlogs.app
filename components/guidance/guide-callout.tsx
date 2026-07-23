"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";

type GuideAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
};

type GuideCalloutProps = {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: GuideAction;
  secondaryAction?: GuideAction;
  className?: string;
};

/**
 * A friendly, reusable guidance callout used to nudge the user toward the next
 * key action (typically importing an audio / creating a study). Rendered in
 * several places: the home when there is no study yet, an empty study page,
 * etc. Keep it presentational — callers wire the actions.
 */
export function GuideCallout({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: GuideCalloutProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-pink-500/5 via-primary/10 to-background p-6 sm:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
          )}
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground max-w-prose">
                {description}
              </p>
            )}
          </div>
        </div>

        {(action || secondaryAction) && (
          <div className="flex shrink-0 items-center gap-2">
            {secondaryAction && (
              <Button
                variant="ghost"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.icon}
                {secondaryAction.label}
              </Button>
            )}
            {action && (
              <Button onClick={action.onClick} disabled={action.disabled}>
                {action.icon ?? null}
                {action.label}
                {!action.icon && <ArrowRightIcon className="h-4 w-4" />}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
