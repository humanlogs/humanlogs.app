"use client";

/**
 * Decorative animated backdrops for the onboarding flow.
 *
 * Three interchangeable directions so the look can be chosen by taste:
 *  - "aurora"  — soft, cohesive cool mesh (indigo/violet/blue), premium & calm.
 *  - "warm"    — warm, human mesh (amber/rose/violet), inviting.
 *  - "minimal" — near-white with a single brand glow + a faint dot grid, clean.
 *
 * All are purely decorative (aria-hidden) and respect prefers-reduced-motion
 * (the drift animations are disabled there via globals.css).
 */
export type OnboardingBgVariant = "aurora" | "warm" | "minimal";

// A very subtle film grain (inline SVG noise) to keep large gradients from
// looking flat/banded. Kept extremely light.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Grain() {
  return (
    <div
      className="absolute inset-0 opacity-[0.035] mix-blend-overlay dark:opacity-[0.05]"
      style={{ backgroundImage: GRAIN }}
    />
  );
}

function AuroraBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#fafaff] dark:bg-[#08080c]"
    >
      <div
        className="animate-onboarding-aurora-1 absolute -left-[15%] -top-[20%] h-[75vh] w-[75vh] rounded-full opacity-70 blur-[110px] dark:opacity-50"
        style={{
          background:
            "radial-gradient(circle at center, #8b5cf6 0%, rgba(139,92,246,0) 70%)",
        }}
      />
      <div
        className="animate-onboarding-aurora-2 absolute -right-[15%] top-[15%] h-[70vh] w-[70vh] rounded-full opacity-60 blur-[110px] dark:opacity-45"
        style={{
          background:
            "radial-gradient(circle at center, #6366f1 0%, rgba(99,102,241,0) 70%)",
        }}
      />
      <div
        className="animate-onboarding-aurora-3 absolute -bottom-[20%] left-[20%] h-[65vh] w-[65vh] rounded-full opacity-55 blur-[120px] dark:opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, #38bdf8 0%, rgba(56,189,248,0) 70%)",
        }}
      />
      <Grain />
    </div>
  );
}

// Flowing, blurred, colourful "silk veil": wide ribbons following soft S-curves
// that undulate horizontally across the backdrop — like a draped fabric, but
// heavily blurred and in a warm palette (amber → rose → violet).
function SilkRibbon({
  paths,
  className,
}: {
  paths: { d: string; grad: string; width: number; opacity?: number }[];
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        {paths.map((p, i) => (
          <linearGradient
            key={i}
            id={`silk-${p.grad}-${i}`}
            x1="0"
            y1="0"
            x2="1"
            y2="0.3"
          >
            {GRADS[p.grad].map((s, j) => (
              <stop key={j} offset={s.o} stopColor={s.c} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={`url(#silk-${p.grad}-${i})`}
          strokeWidth={p.width}
          strokeLinecap="round"
          opacity={p.opacity ?? 1}
        />
      ))}
    </svg>
  );
}

const GRADS: Record<string, { o: number; c: string }[]> = {
  a: [
    { o: 0, c: "#fbbf24" },
    { o: 0.5, c: "#fb7185" },
    { o: 1, c: "#a855f7" },
  ],
  b: [
    { o: 0, c: "#f472b6" },
    { o: 0.5, c: "#fb923c" },
    { o: 1, c: "#c084fc" },
  ],
};

function WarmBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#fff8f2] dark:bg-[#0b0708]"
    >
      <SilkRibbon
        className="animate-onboarding-silk-a absolute inset-0 h-full w-full opacity-70 blur-[64px] dark:opacity-60"
        paths={[
          {
            d: "M-260 500 C 250 300 620 640 1000 470 S 1500 300 1760 400",
            grad: "a",
            width: 230,
          },
        ]}
      />
      <SilkRibbon
        className="animate-onboarding-silk-b absolute inset-0 h-full w-full opacity-55 blur-[72px] dark:opacity-45"
        paths={[
          {
            d: "M-260 600 C 320 440 760 740 1080 540 S 1520 360 1760 300",
            grad: "b",
            width: 170,
          },
        ]}
      />
      <Grain />
    </div>
  );
}

function MinimalBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden bg-white dark:bg-[#0a0a0b]"
    >
      {/* Faint dot grid */}
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
      {/* Single soft brand-tinted glow behind the card */}
      <div
        className="animate-onboarding-aurora-1 absolute left-1/2 top-1/3 h-[60vh] w-[80vh] -translate-x-1/2 rounded-full opacity-60 blur-[120px] dark:opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, #c7d2fe 0%, rgba(199,210,254,0) 70%)",
        }}
      />
    </div>
  );
}

export function OnboardingBackground({
  variant = "aurora",
}: {
  variant?: OnboardingBgVariant;
}) {
  if (variant === "warm") return <WarmBackground />;
  if (variant === "minimal") return <MinimalBackground />;
  return <AuroraBackground />;
}
