"use client";

/**
 * Reusable decorative animated backdrop (onboarding, login, empty states...).
 *
 * Three interchangeable directions so the look can be chosen by taste:
 *  "aurora": soft, cohesive cool mesh (indigo/violet/blue), premium and calm.
 *  "warm": warm, human silk (amber/rose/violet), inviting.
 *  "minimal": near-white with a single brand glow and a faint dot grid, clean.
 *
 * ## Why this is a canvas and not blurred DOM
 *
 * The previous implementation stacked full-viewport layers under a CSS
 * `filter: blur(40–120px)` and animated them. That makes the compositor
 * re-rasterize viewport-sized surfaces through a very large blur kernel on
 * every frame — the cost scales with the window, and on integrated GPUs or
 * software compositing it drops the whole page to single-digit FPS.
 *
 * The shapes here are only wide, soft colour gradients, so we render them into
 * a deliberately tiny canvas (a couple hundred pixels wide) and let the browser
 * stretch that canvas over the viewport. Bilinear upscaling *is* the blur, and
 * it is free: it happens in the same texture sample the compositor already
 * does. Any extra softening uses `ctx.filter`, which is likewise cheap because
 * it runs on the small backing store, not on the viewport.
 *
 * The result costs a fixed fraction of a millisecond per frame regardless of
 * screen size. On top of that the loop is capped at 24fps (the motion is a
 * ~30s drift; nobody can tell), pauses when the tab is hidden or the backdrop
 * scrolls out of view, and renders a single static frame under
 * `prefers-reduced-motion`.
 */

import { useEffect, useRef } from "react";

export type AmbientBgVariant = "aurora" | "warm" | "minimal";

/** Backing-store width. Everything is drawn in this coordinate space. */
const BASE_W = 220;
/** Clamp on the backing-store height so extreme aspect ratios stay bounded. */
const MIN_BASE_H = 56;
const MAX_BASE_H = 360;

/** The drift is a 30s-scale motion; 24fps is indistinguishable and ~2.5x cheaper. */
const FRAME_MS = 1000 / 24;

// There is no film-grain layer here on purpose. It used to be an inline SVG
// noise data: URI, which the app's CSP (`default-src 'self'`, no `img-src`)
// blocks — so it never actually rendered, in production either, while still
// costing a full-viewport compositing layer and a console error on every load.
// To bring it back, add `img-src 'self' data:` to the CSP in `proxy.ts` first.

type Rgb = [number, number, number];

interface Blob {
  /** Centre, in fractions of the canvas box. */
  x: number;
  y: number;
  /** Radius as a fraction of the canvas diagonal. */
  r: number;
  colour: Rgb;
  /** Peak alpha, light and dark theme. */
  alpha: number;
  darkAlpha: number;
  /** Drift amplitude (fractions of the box) and period in seconds. */
  dx: number;
  dy: number;
  period: number;
  phase: number;
}

interface Ribbon {
  /** Bezier control points in a 1440x900 design space, matching the old SVG. */
  d: [number, number][];
  width: number;
  stops: { at: number; colour: Rgb }[];
  alpha: number;
  darkAlpha: number;
  /** Softening, expressed as the CSS blur radius the old DOM version used, so
   *  the look is identical at any window size. Converted to (much smaller)
   *  backing-store pixels at draw time. */
  cssBlur: number;
  dx: number;
  dy: number;
  period: number;
  phase: number;
}

interface Scene {
  /** Base fill, light and dark, for the canvas. */
  base: [string, string];
  /** The same base as Tailwind classes, painted under the canvas so there is
   *  no white flash before hydration and no wrong colour in dark mode. */
  baseClass: string;
  blobs?: Blob[];
  ribbons?: Ribbon[];
}

const SCENES: Record<AmbientBgVariant, Scene> = {
  aurora: {
    base: ["#fafaff", "#08080c"],
    baseClass: "bg-[#fafaff] dark:bg-[#08080c]",
    blobs: [
      {
        x: 0.1,
        y: 0.05,
        r: 0.5,
        colour: [139, 92, 246],
        alpha: 0.7,
        darkAlpha: 0.5,
        dx: 0.08,
        dy: 0.1,
        period: 22,
        phase: 0,
      },
      {
        x: 0.92,
        y: 0.4,
        r: 0.47,
        colour: [99, 102, 241],
        alpha: 0.6,
        darkAlpha: 0.45,
        dx: -0.1,
        dy: 0.06,
        period: 26,
        phase: 0.3,
      },
      {
        x: 0.42,
        y: 1.0,
        r: 0.44,
        colour: [56, 189, 248],
        alpha: 0.55,
        darkAlpha: 0.4,
        dx: 0.06,
        dy: -0.08,
        period: 30,
        phase: 0.6,
      },
    ],
  },
  warm: {
    base: ["#fafafa", "#0b0b0e"],
    baseClass: "bg-[#fafafa] dark:bg-[#0b0b0e]",
    ribbons: [
      {
        d: [
          [-260, 500],
          [250, 300],
          [620, 640],
          [1000, 470],
          [1380, 300],
          [1760, 400],
        ],
        width: 230,
        stops: [
          { at: 0, colour: [16, 185, 129] },
          { at: 0.2, colour: [16, 185, 129] },
          { at: 1, colour: [59, 130, 246] },
        ],
        alpha: 0.7,
        darkAlpha: 0.6,
        cssBlur: 40,
        dx: 0.02,
        dy: 0.015,
        period: 34,
        phase: 0,
      },
      {
        d: [
          [-260, 600],
          [320, 440],
          [760, 740],
          [1080, 540],
          [1400, 360],
          [1760, 300],
        ],
        width: 170,
        stops: [
          { at: 0, colour: [236, 72, 153] },
          { at: 0.2, colour: [236, 72, 153] },
          { at: 1, colour: [59, 130, 246] },
        ],
        alpha: 0.55,
        darkAlpha: 0.45,
        cssBlur: 80,
        dx: -0.03,
        dy: -0.01,
        period: 42,
        phase: 0.35,
      },
      {
        d: [
          [-260, 400],
          [320, 240],
          [760, 540],
          [1080, 340],
          [1400, 160],
          [1760, 200],
        ],
        width: 170,
        stops: [
          { at: 0, colour: [59, 130, 246] },
          { at: 0.2, colour: [59, 130, 246] },
          { at: 1, colour: [16, 185, 129] },
        ],
        alpha: 0.55,
        darkAlpha: 0.45,
        cssBlur: 60,
        dx: 0.025,
        dy: -0.02,
        period: 38,
        phase: 0.7,
      },
    ],
  },
  minimal: {
    base: ["#ffffff", "#0a0a0b"],
    baseClass: "bg-white dark:bg-[#0a0a0b]",
    blobs: [
      {
        x: 0.5,
        y: 0.33,
        r: 0.42,
        colour: [199, 210, 254],
        alpha: 0.6,
        darkAlpha: 0.4,
        dx: 0.08,
        dy: 0.1,
        period: 22,
        phase: 0,
      },
    ],
  },
};

/** Design space the ribbon paths are authored in (the old SVG viewBox). */
const RIBBON_W = 1440;
const RIBBON_H = 900;

function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  w: number,
  h: number,
  dark: boolean,
  /** Seconds since mount; 0 renders the neutral "at rest" frame. */
  time: number,
  /** backing-store px per CSS px, to translate CSS-authored blur radii. */
  pixelScale: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.fillStyle = scene.base[dark ? 1 : 0];
  ctx.fillRect(0, 0, w, h);

  const diagonal = Math.hypot(w, h);
  // A blob is a radial gradient: soft by construction, no filter needed.
  for (const b of scene.blobs ?? []) {
    const t = Math.sin(((time / b.period) * 2 + b.phase * 2) * Math.PI);
    const cx = (b.x + b.dx * t * 0.5) * w;
    const cy = (b.y + b.dy * t * 0.5) * h;
    // Matches the old `scale()` breathing, folded into the radius.
    const radius = b.r * diagonal * (1 + 0.1 * t);
    const [r, g, bl] = b.colour;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, `rgba(${r},${g},${bl},${dark ? b.darkAlpha : b.alpha})`);
    gradient.addColorStop(0.7, `rgba(${r},${g},${bl},0)`);
    gradient.addColorStop(1, `rgba(${r},${g},${bl},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  // A ribbon is a thick bezier stroke. `ctx.filter` is affordable here only
  // because it operates on the small backing store.
  //
  // Reproduce the SVG's `preserveAspectRatio="xMidYMid slice"`: scale the
  // design space uniformly so it covers the box, and centre the overflow.
  // Scaling the axes independently instead would flatten the curves on short,
  // wide viewports.
  const scale = Math.max(w / RIBBON_W, h / RIBBON_H);
  const offsetX = (w - RIBBON_W * scale) / 2;
  const offsetY = (h - RIBBON_H * scale) / 2;
  const px = (x: number) => offsetX + x * scale;
  const py = (y: number) => offsetY + y * scale;
  for (const rb of scene.ribbons ?? []) {
    const t = Math.sin(((time / rb.period) * 2 + rb.phase * 2) * Math.PI);
    ctx.save();
    ctx.translate(rb.dx * t * w, rb.dy * t * h);
    // Blurring here is cheap: the surface is ~220px wide, not the viewport.
    const blur = Math.max(2, rb.cssBlur * pixelScale);
    ctx.filter = `blur(${blur.toFixed(2)}px)`;
    ctx.globalAlpha = dark ? rb.darkAlpha : rb.alpha;

    const [p0, c1, c2, p1, c3, p2] = rb.d;
    const gradient = ctx.createLinearGradient(0, 0, w, h * 0.3);
    for (const s of rb.stops) {
      const [r, g, bl] = s.colour;
      gradient.addColorStop(s.at, `rgb(${r},${g},${bl})`);
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = rb.width * scale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px(p0[0]), py(p0[1]));
    ctx.bezierCurveTo(
      px(c1[0]),
      py(c1[1]),
      px(c2[0]),
      py(c2[1]),
      px(p1[0]),
      py(p1[1]),
    );
    // The old paths used `S` (smooth continuation): reflect the last control
    // point through the current point to get the implicit first control point.
    ctx.bezierCurveTo(
      px(2 * p1[0] - c2[0]),
      py(2 * p1[1] - c2[1]),
      px(c3[0]),
      py(c3[1]),
      px(p2[0]),
      py(p2[1]),
    );
    ctx.stroke();
    ctx.restore();
  }

  ctx.filter = "none";
  ctx.globalAlpha = 1;
}

function AmbientCanvas({ variant }: { variant: AmbientBgVariant }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const scene = SCENES[variant];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let dark = document.documentElement.classList.contains("dark");
    const width = BASE_W;
    let height = MIN_BASE_H;
    let pixelScale = 1;
    let visible = true;
    let raf = 0;
    let lastFrame = -Infinity;
    const start = performance.now();

    /** Returns true when anything that affects the drawing changed. */
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width || 1;
      const ratio = rect.width > 0 ? rect.height / cssWidth : 0.6;
      const nextHeight = Math.round(
        Math.min(MAX_BASE_H, Math.max(MIN_BASE_H, BASE_W * ratio)),
      );
      const nextScale = BASE_W / cssWidth;
      const changed =
        nextHeight !== height ||
        Math.abs(nextScale - pixelScale) > 0.0005 ||
        canvas.width !== width ||
        canvas.height !== nextHeight;
      height = nextHeight;
      pixelScale = nextScale;
      // Assigning either dimension clears the canvas, so only do it on change.
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return changed;
    };

    const paint = (time: number) =>
      drawScene(ctx, scene, width, height, dark, time, pixelScale);

    // Static path: one frame, redrawn only when the theme or the box changes.
    if (reduceMotion) {
      resize();
      paint(0);
      const ro = new ResizeObserver(() => {
        if (resize()) paint(0);
      });
      ro.observe(canvas);
      const mo = new MutationObserver(() => {
        const next = document.documentElement.classList.contains("dark");
        if (next !== dark) {
          dark = next;
          paint(0);
        }
      });
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => {
        ro.disconnect();
        mo.disconnect();
      };
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastFrame < FRAME_MS) return;
      lastFrame = now;
      paint((now - start) / 1000);
    };

    const play = () => {
      if (raf || !visible || document.hidden) return;
      lastFrame = -Infinity;
      raf = requestAnimationFrame(loop);
    };
    const pause = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    paint(0);

    const ro = new ResizeObserver(() => {
      if (resize() && !raf) paint((performance.now() - start) / 1000);
    });
    ro.observe(canvas);

    const mo = new MutationObserver(() => {
      const next = document.documentElement.classList.contains("dark");
      if (next !== dark) {
        dark = next;
        if (!raf) paint((performance.now() - start) / 1000);
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Scrolled out of view (the app backdrop lives inside a scroller) or in a
    // background tab: stop burning frames entirely.
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) play();
      else pause();
    });
    io.observe(canvas);

    const onVisibility = () => (document.hidden ? pause() : play());
    document.addEventListener("visibilitychange", onVisibility);

    play();

    return () => {
      pause();
      ro.disconnect();
      mo.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
    />
  );
}

export function AmbientBackground({
  variant = "aurora",
}: {
  variant?: AmbientBgVariant;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${SCENES[variant].baseClass}`}
    >
      <AmbientCanvas variant={variant} />
      {variant === "minimal" && (
        // Static, crisp, and cheap — kept in the DOM rather than upscaled.
        <div
          className="absolute inset-0 opacity-[0.5] dark:opacity-[0.25]"
          style={{
            backgroundImage:
              "radial-gradient(circle, color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage:
              "radial-gradient(120% 90% at 50% 40%, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(120% 90% at 50% 40%, black 30%, transparent 75%)",
          }}
        />
      )}
    </div>
  );
}
