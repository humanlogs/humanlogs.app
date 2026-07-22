"use client";

import { AmbientBackground } from "@/components/ui/ambient-background";
import { useEffect, useLayoutEffect, useState } from "react";

/**
 * Session flag set by the onboarding flow right before it navigates into the
 * app, so the app knows to play its entrance once (and only once).
 */
export const WELCOME_INTRO_FLAG = "humanlogs:welcome-intro";

// useLayoutEffect on the client (so the app doesn't paint full-size for a frame
// before shrinking), useEffect on the server to avoid the SSR warning.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Phase = "idle" | "playing" | "done";

/**
 * Plays a one-shot entrance for the main app right after onboarding: the whole
 * app zooms in (ease-out) over the same warm backdrop the funnel used, and the
 * backdrop is destroyed once the app has settled into full view. Any other
 * time it is a no-op passthrough (renders children with no extra box, via
 * `display: contents`, so the app layout is untouched).
 */
export function WelcomeIntro({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");

  useIsoLayoutEffect(() => {
    let armed = false;
    try {
      armed = !!sessionStorage.getItem(WELCOME_INTRO_FLAG);
      if (armed) sessionStorage.removeItem(WELCOME_INTRO_FLAG);
    } catch {
      // sessionStorage can throw (private mode); just skip the intro.
    }
    if (!armed) return;

    // Respect reduced-motion: land straight in the app with no animation.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    setPhase("playing");
    // Backstop in case the animationend event is missed.
    const t = setTimeout(() => setPhase("done"), 1200);
    return () => clearTimeout(t);
  }, []);

  const playing = phase === "playing";

  return (
    <>
      {playing && (
        <div className="animate-welcome-bg-fade pointer-events-none fixed inset-0 z-0">
          <AmbientBackground variant="warm" />
        </div>
      )}
      <div
        className={
          playing ? "animate-welcome-zoom-in relative z-[1]" : "contents"
        }
        onAnimationEnd={(e) => {
          // Child animations bubble up here too; only our own zoom ends it.
          if (e.target === e.currentTarget) setPhase("done");
        }}
      >
        {children}
      </div>
    </>
  );
}
