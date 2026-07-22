"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Smoothly animates its own height to fit its content. Whenever the content
 * resizes (a sub-block appears, the step changes, a child's internal state
 * toggles...), the container eases from its previous height to the new one
 * instead of jumping. The content itself is not animated, so text stays still
 * while the block grows or shrinks.
 *
 * Implementation notes:
 *  - A ResizeObserver watches the inner content, so it reacts to changes that
 *    happen inside child components too (not just when this component re-renders).
 *  - Height is driven imperatively (FLIP): the observer fires after layout and
 *    before paint, so we can pin the old height, force a reflow, then set the
 *    new height for the transition to run without a flash.
 *  - At rest the height is "auto" and overflow is visible, so absolutely
 *    positioned children (e.g. dropdown menus) are never clipped.
 */
export function AnimateHeight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const prev = useRef<number | null>(null);

  useLayoutEffect(() => {
    const outerEl = outer.current;
    const innerEl = inner.current;
    if (!outerEl || !innerEl) return;

    let raf = 0;
    const animateTo = (target: number) => {
      const from = prev.current;
      prev.current = target;
      if (raf) cancelAnimationFrame(raf);
      // First measure (or no change): settle without animating.
      if (from === null || from === target) {
        outerEl.style.height = "auto";
        return;
      }
      // Pin the previous height this frame; ease to the new one next frame.
      // Setting both in one frame would let the browser collapse it to a jump.
      outerEl.style.height = `${from}px`;
      outerEl.style.overflow = "hidden";
      raf = requestAnimationFrame(() => {
        outerEl.style.height = `${target}px`;
      });
    };

    animateTo(innerEl.offsetHeight);

    const ro = new ResizeObserver(() => animateTo(innerEl.offsetHeight));
    ro.observe(innerEl);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // When the transition ends, release back to auto so content can flow and
  // overflow is visible again (dropdowns, etc.).
  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.propertyName !== "height") return;
    const outerEl = outer.current;
    const innerEl = inner.current;
    if (!outerEl || !innerEl) return;
    outerEl.style.height = "auto";
    outerEl.style.overflow = "";
    prev.current = innerEl.offsetHeight;
  };

  return (
    <div
      ref={outer}
      className={`onboarding-animate-height${className ? ` ${className}` : ""}`}
      onTransitionEnd={handleTransitionEnd}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
