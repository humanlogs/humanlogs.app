/** Small helpers shared across import parsers. */

/** Coerce a value to a finite number of seconds, or undefined. */
export function toNum(v: unknown): number | undefined {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Normalize a speaker identifier. Bare numbers become `speaker_N` (matching the
 * provider convention); non-empty strings are kept as-is; empty → undefined.
 */
export function asSpeakerId(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  if (/^\d+$/.test(s)) return `speaker_${s}`;
  return s;
}

/**
 * Parse a timestamp string into seconds. Accepts `HH:MM:SS`, `MM:SS`,
 * `HH:MM:SS,mmm`, `HH:MM:SS.mmm`, `SS.mmm`, and bare seconds.
 */
export function timeToSeconds(raw: string): number | undefined {
  const s = raw.trim().replace(",", ".");
  if (!s) return undefined;
  const parts = s.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || isNaN(Number(p)))) {
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  let seconds = 0;
  for (const p of parts) {
    seconds = seconds * 60 + Number(p);
  }
  return Number.isFinite(seconds) ? seconds : undefined;
}
