"use client";

import { AmbientBackground } from "@/components/ui/ambient-background";
import { useEffect, useLayoutEffect, useState } from "react";

// useLayoutEffect on the client (so the app doesn't paint full-size for a frame
// before shrinking), useEffect on the server to avoid the SSR warning.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Phase = "idle" | "playing" | "done";

/**
 * Plays the app's entrance on every full load of the product (after login,
 * on reload, and after onboarding): the whole app zooms in (ease-out) over the
 * same warm backdrop the funnel used, and the backdrop is destroyed once the
 * app has settled into full view. It only fires on mount of the app layout, so
 * client-side navigation within the app doesn't replay it. When it isn't
 * playing it is a no-op passthrough (renders children with no extra box, via
 * `display: contents`, so the app layout is untouched).
 */
export function WelcomeIntro({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("idle");

  useIsoLayoutEffect(() => {
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
