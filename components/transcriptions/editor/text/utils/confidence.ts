import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { readConfidence } from "@/lib/stt/confidence";

export { readConfidence };

/** Name of the ProseMirror mark on doubtful words (extensions/confidence-mark.ts). */
export const LOW_CONFIDENCE_MARK = "lowConfidence";

/**
 * Below this, a word is shown as doubtful. Providers express confidence as a
 * probability in [0, 1] (Gladia's `confidence`, Whisper's `probability`, and
 * ElevenLabs' `logprob` once exponentiated), so one threshold serves all three.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Transaction meta telling the clearing plugin to leave the marks alone: set on the
 * seed, which REPLACES the whole document and would otherwise read as the user having
 * edited every word of it.
 */
export const PRESERVE_CONFIDENCE_META = "preserveConfidence";

export function isLowConfidence(seg: TranscriptionSegment): boolean {
  const c = readConfidence(seg);
  return c !== undefined && c < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * The stored attribute value. Two decimals are plenty for a threshold decision, and
 * rounding keeps neighbouring words from carrying needlessly distinct attributes.
 */
export function formatConfidence(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function parseConfidence(raw: unknown): number | undefined {
  const n = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
