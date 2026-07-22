"use client";

import { cn } from "@/lib/utils/utils";

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
export function OnboardingShell({
  step,
  stepCount,
  children,
  wide,
}: {
  /** Zero-based index of the current step. */
  step: number;
  /** Total number of steps in the flow. */
  stepCount: number;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 p-4 dark:bg-zinc-950">
      <OnboardingBackground />

      <div
        className={cn(
          "animate-onboarding-card relative z-10 w-full",
          wide ? "max-w-lg" : "max-w-md",
        )}
      >
        <div className="rounded-2xl border border-white/60 bg-white/90 p-8 shadow-2xl shadow-black/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/85">
          <OnboardingStepper step={step} stepCount={stepCount} />
          {/* Re-key on step so the content re-animates on each transition. */}
          <div key={step} className="animate-onboarding-step mt-6 space-y-6">
            {children}
          </div>
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

/** Purely decorative animated backdrop. */
function OnboardingBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {/* Colour blobs */}
      <div className="animate-onboarding-blob absolute -left-24 -top-24 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-400/40 to-sky-400/40 blur-3xl dark:from-indigo-600/30 dark:to-sky-600/30" />
      <div
        className="animate-onboarding-blob absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-gradient-to-br from-fuchsia-400/40 to-rose-400/40 blur-3xl dark:from-fuchsia-600/25 dark:to-rose-600/25"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="animate-onboarding-blob absolute -bottom-24 left-1/4 h-96 w-96 rounded-full bg-gradient-to-br from-emerald-400/40 to-teal-400/40 blur-3xl dark:from-emerald-600/25 dark:to-teal-600/25"
        style={{ animationDelay: "-12s" }}
      />
      {/* Diagonal Stripe-style bands */}
      <div
        className="animate-onboarding-bands absolute inset-0 text-primary opacity-[0.12] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, transparent 0 60px, currentColor 60px 62px)",
        }}
      />
    </div>
  );
}
