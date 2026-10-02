/**
 * The STT confidence of a word, in [0, 1], whichever provider produced it.
 *
 * `confidence` is our own field (Gladia, and every projection saved since). The two
 * others are raw provider fields that ride along on the stored words until the first
 * save, or arrive in an imported file: ElevenLabs' `logprob` (a natural log, hence
 * the `exp`) and Whisper's `probability`. Reading them here, rather than rewriting them at ingestion, is what
 * makes transcripts that were produced before this field existed show their doubts
 * too.
 */
export function readConfidence(word: {
  type?: unknown;
  confidence?: unknown;
  logprob?: unknown;
  probability?: unknown;
}): number | undefined {
  // Spacing (and ElevenLabs' audio events) are scored too, but a doubt is about a word.
  if (word.type !== undefined && word.type !== "word") return undefined;
  let value: number | undefined;
  if (typeof word.confidence === "number") value = word.confidence;
  else if (typeof word.logprob === "number") value = Math.exp(word.logprob);
  else if (typeof word.probability === "number") value = word.probability;
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}
