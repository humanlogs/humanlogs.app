/**
 * How much of an interview a grille covers.
 *
 * Both lengths are counted by the CLIENT and stored as snapshots — the server may
 * never see the transcript in clear, so it cannot count either of them. Neither is
 * maintained afterwards: a coding is an anchor that moves with the text, and its
 * recorded length is what the passage measured the moment it was applied.
 *
 * Two codings overlapping the same sentence count twice, so the raw ratio can
 * legitimately exceed 1; a transcript can also shrink under codings already
 * written, so it can go the other way. Clamped rather than corrected, because the
 * figure is a sense of progress, not an audit, and a number that reads 104% reads
 * as a bug whatever it means.
 */

/** Characters this grille's codings span, over characters of transcript, 0–100. */
export function coveragePercent(
  codedLength: number,
  textLength: number | null | undefined,
): number | null {
  // No denominator is a different answer from zero: a document saved before the
  // column existed has no length recorded, and a 0% there would be a lie.
  if (!textLength || textLength <= 0) return null;
  // NaN would clamp to NaN; anything else (including an infinity, which only a
  // corrupt row could produce) falls through to the clamp below.
  if (Number.isNaN(codedLength)) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((codedLength / textLength) * 100)),
  );
}

/** The characters covered by the codings of one codebook. */
export function codedLengthOf(
  codings: ReadonlyArray<{ codebookId: string; textLength?: number }>,
  codebookId: string,
): number {
  let total = 0;
  for (const row of codings) {
    if (row.codebookId !== codebookId) continue;
    total += row.textLength ?? 0;
  }
  return total;
}
