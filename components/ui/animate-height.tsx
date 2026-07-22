"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Smoothly animates its own height to fit its content. Whenever the content
 * resizes (a sub-block appears, the step changes...), the container eases to the
 * new height instead of jumping. The content itself is not animated, so text
 * stays still while the block grows/shrinks.
 *
 * Overflow is only hidden while a height transition is running, so absolutely
 * positioned children (e.g. dropdown menus) are not clipped at rest.
 */
export function AnimateHeight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  const [animating, setAnimating] = useState(false);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const next = el.scrollHeight;
      setHeight((prev) => {
        if (prev !== "auto" && prev !== next) setAnimating(true);
        return next;
      });
    });
    ro.observe(el);
    setHeight(el.scrollHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={`onboarding-animate-height${className ? ` ${className}` : ""}`}
      style={{
        height: height === "auto" ? undefined : height,
        overflow: animating ? "hidden" : "visible",
      }}
      onTransitionEnd={() => setAnimating(false)}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
