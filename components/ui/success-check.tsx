"use client";

import { cn } from "@/lib/utils/utils";
import { Loader2Icon } from "lucide-react";

/**
 * Animated success badge: a white check drawn onto a solid green disc. The disc
 * pops in and the check strokes itself on. Used wherever a loading state
 * resolves into "done" (onboarding provisioning rows, the recovery-key success,
 * the lab-licence confirmation...).
 */
export function SuccessCheck({
  className,
  size = "h-14 w-14",
}: {
  className?: string;
  /** Tailwind width/height classes for the disc (default h-14 w-14). */
  size?: string;
}) {
  return (
    <span
      className={cn("animate-success-pop inline-flex shrink-0", size, className)}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-full w-full">
        <circle cx="12" cy="12" r="12" className="fill-green-600 dark:fill-green-500" />
        <path
          d="M6.5 12.5 L10.5 16.5 L17.5 8"
          pathLength={1}
          fill="none"
          stroke="#fff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-success-draw"
        />
      </svg>
    </span>
  );
}

/**
 * A spinner that turns into the {@link SuccessCheck} once `done`. Convenient for
 * inline "step complete" rows.
 */
export function LoadingCheck({
  done,
  className,
  size = "h-5 w-5",
}: {
  done: boolean;
  className?: string;
  size?: string;
}) {
  if (done) return <SuccessCheck size={size} className={className} />;
  return (
    <Loader2Icon
      className={cn("animate-spin shrink-0 text-primary", size, className)}
    />
  );
}
