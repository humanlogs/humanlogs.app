/**
 * The freshness protocol, in one file both ends can import.
 *
 * The server produces a manifest (`app/api/codings/manifest`), the browser compares
 * it with what it holds (`sync.browser.ts`). They only ever agree if they agree on
 * the SHAPE of a fingerprint, so the shape lives here rather than being written
 * twice — this module is deliberately free of Prisma, of IndexedDB and of React so
 * that costs neither side anything.
 */

/**
 * One line per document, saying only how fresh it is.
 *
 * `updatedAt` is the transcript's; `codings` and `codingLatest` fingerprint the
 * codes applied to it. Both are needed because they move independently: editing a
 * transcript does not code it, and coding a passage writes a `Coding` row now and
 * an anchor the save leader may not persist for minutes. A cursor on either alone
 * would leave one of the two silently stale.
 */
export type CodingManifestEntry = {
  id: string;
  updatedAt: string;
  projectId: string | null;
  codings: number;
  /** ISO date of the most recent coding, or null when there are none. */
  codingLatest: string | null;
};

/**
 * The fingerprint stored alongside a document's index.
 *
 * A count alone would miss a code retracted and another applied; a latest-date
 * alone would miss a retraction with nothing after it. Together they miss only
 * two changes landing in the same millisecond and cancelling out, which is not a
 * sequence a human hand produces.
 *
 * The `v1:` prefix is a kill switch: changing the rule changes the prefix, every
 * stored fingerprint stops matching, and every document is re-derived. That is the
 * intended behaviour — a client that fingerprints differently must not trust rows
 * built under the old rule.
 */
export function codingSignature(entry: {
  codings: number;
  codingLatest: string | null;
}): string {
  return `v1:${entry.codings}:${entry.codingLatest ?? "-"}`;
}
