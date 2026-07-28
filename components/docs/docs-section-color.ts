/**
 * One colour per documentation section, so a reader can tell at a glance which
 * part of the docs they are in. Classes are written out in full (never built by
 * interpolation) so Tailwind keeps them, and an unknown section falls back to
 * grey rather than disappearing.
 */
const SECTION_COLORS: Record<string, { dot: string; rule: string }> = {
  "getting-started": { dot: "bg-emerald-500", rule: "border-emerald-100" },
  transcribe: { dot: "bg-blue-500", rule: "border-blue-100" },
  coding: { dot: "bg-violet-500", rule: "border-violet-100" },
  analysis: { dot: "bg-amber-500", rule: "border-amber-100" },
  organize: { dot: "bg-teal-500", rule: "border-teal-100" },
  privacy: { dot: "bg-rose-500", rule: "border-rose-100" },
  "self-hosting": { dot: "bg-slate-500", rule: "border-slate-200" },
};

const FALLBACK = { dot: "bg-gray-400", rule: "border-gray-200" };

export function sectionColor(slug: string) {
  return SECTION_COLORS[slug] ?? FALLBACK;
}
