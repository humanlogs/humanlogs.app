"use client";

import { cn } from "@/lib/utils/utils";
import { ChevronLeftIcon } from "lucide-react";
import {
  AmbientBackground,
  type AmbientBgVariant,
} from "@/components/ui/ambient-background";

/**
 * Shared chrome for the onboarding/welcome flow.
 *
 * Provides:
 *  - an animated, blurred, colourful ambient background (Stripe-like blobs +
 *    slowly sliding diagonal bands) so the flow feels warm rather than cold,
 *  - a Snapchat/stories-style segmented stepper showing progress,
 *  - a card that animates in on mount.
 *
 * Each welcome step renders its own inner content as children; the shell owns
 * the background, the stepper and the card wrapper.
 */
// Default backdrop for the whole onboarding flow. Change this one constant to
// switch the look everywhere.
const DEFAULT_BG: AmbientBgVariant = "warm";

export function OnboardingShell({
  step,
  stepCount,
  children,
  wide,
  bgVariant = DEFAULT_BG,
  topRight,
  onBack,
}: {
  /** Zero-based index of the current step. */
  step: number;
  /** Total number of steps in the flow. */
  stepCount: number;
  children: React.ReactNode;
  wide?: boolean;
  bgVariant?: AmbientBgVariant;
  /** Optional discreet control pinned to the top-right corner of the screen. */
  topRight?: React.ReactNode;
  /** When provided, a back button is shown before the stepper. */
  onBack?: () => void;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <AmbientBackground variant={bgVariant} />

      {topRight && (
        <div className="absolute right-4 top-4 z-20">{topRight}</div>
      )}

      <div
        className={cn(
          "animate-onboarding-card relative z-10 w-full",
          wide ? "max-w-lg" : "max-w-md",
        )}
      >
        <div className="rounded-2xl border border-white/60 bg-white/80 p-8 shadow-2xl shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="-ml-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
            )}
            <OnboardingStepper step={step} stepCount={stepCount} />
          </div>
          {/* Height animates on step change / sub-block reveal; text does not. */}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Segmented, stories-style progress bar. */
function OnboardingStepper({
  step,
  stepCount,
}: {
  step: number;
  stepCount: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: stepCount }).map((_, i) => {
        const isComplete = i < step;
        const isActive = i === step;
        return (
          <div
            key={i}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15"
          >
            {isComplete && <div className="h-full w-full bg-primary" />}
            {isActive && (
              <div className="animate-onboarding-stepper-fill h-full w-full bg-primary" />
            )}
          </div>
        );
      })}
    </div>
  );
}
