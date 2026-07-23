"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useNavOrder } from "@/hooks/use-nav-order";

type Direction = "up" | "down" | "left" | "right" | "none";

function directionFor(
  prev: string,
  next: string,
  order: string[],
  isBack: boolean,
): Direction {
  const iPrev = order.indexOf(prev);
  const iNext = order.indexOf(next);
  // Both live in the sidebar: slide along its axis (down = lower item).
  if (iPrev !== -1 && iNext !== -1 && iPrev !== iNext) {
    return iNext > iPrev ? "down" : "up";
  }
  // Otherwise it's a forward push (from the right) or a back (from the left).
  return isBack ? "left" : "right";
}

/**
 * Animates the main content on route changes. The direction is derived from the
 * sidebar order (`useNavOrder`): navigating to a lower sidebar item slides up
 * from the bottom, a higher one from the top; anything off the sidebar slides
 * in from the right, and browser-back from the left. Enter-only (the outgoing
 * page is replaced immediately), which keeps it cheap and reliable on the App
 * Router without a view-transition/animation library.
 */
export function AppRouteTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const order = useNavOrder();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // The transcription editor owns the full viewport (its own internal scroll and
  // opaque background), so it keeps an exact-height wrapper and no bottom fade.
  // Every other page grows with its content and dissolves into the ambient
  // backdrop over its final 500px (see `.route-fade` in globals.css).
  const isTranscription = pathname?.startsWith("/app/transcription/") ?? false;

  // The main scroller is a custom ScrollArea viewport, which Next's built-in
  // scroll-to-top-on-navigation doesn't target — so reset it ourselves on each
  // route change, otherwise a new page can open already scrolled down.
  useEffect(() => {
    const viewport = wrapperRef.current?.closest<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (viewport) viewport.scrollTop = 0;
  }, [pathname]);

  // Everything lives in state (no refs) so it stays React-Compiler-safe.
  // `back` is armed by popstate and consumed by the next pathname change.
  const [nav, setNav] = useState<{
    prev: string;
    dir: Direction;
    back: boolean;
  }>(() => ({ prev: pathname, dir: "none", back: false }));

  useEffect(() => {
    const onPop = () => setNav((n) => ({ ...n, back: true }));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Derive the direction as the pathname changes (adjust-state-during-render:
  // React re-renders before painting, so the keyed wrapper mounts already
  // carrying the right data-dir).
  if (nav.prev !== pathname) {
    setNav((n) => ({
      prev: pathname,
      dir: directionFor(n.prev, pathname, order, n.back),
      back: false,
    }));
  }

  // Two nested layers: the outer one carries the page's opaque background and is
  // NOT animated, while the inner one runs the enter animation. Keeping the
  // background off the animated layer is what stops the fade from briefly
  // revealing the ambient backdrop behind an incoming page (a "glitch").
  return (
    <div
      key={pathname}
      ref={wrapperRef}
      className={
        isTranscription ? "h-full bg-background" : "route-fade min-h-full"
      }
    >
      <div
        data-dir={nav.dir}
        className={
          isTranscription
            ? "route-transition h-full"
            : "route-transition route-fade-content"
        }
      >
        {children}
      </div>
    </div>
  );
}
