/**
 * Which cached queries a `db:change` event invalidates.
 *
 * The server names the table that changed (the singular Prisma model, e.g.
 * "transcription"); the client holds TanStack Query keys naming resources in the
 * plural. This is the one rule that maps one onto the other, kept out of the socket
 * hook so it can be stated — and tested — on its own: get it too narrow and a
 * collaborator's change never shows up, too wide and every keystroke's autosave pulls
 * down half the app.
 */

/**
 * Query-key segments that name something living under another resource's key while
 * changing for their own reasons.
 *
 * `["transcriptions", id, "participants"]` is a list of people, not of transcriptions:
 * it changes when a document is shared, not when its text is saved. Left to the general
 * rule below it was refetched on every autosave, together with the comment-thread
 * subscriptions — three round trips per save, none about anything that had changed.
 * Whoever changes one of these says so explicitly (see the share and transfer routes).
 */
export const INDEPENDENT_SUBRESOURCES = new Set([
  "participants",
  "subscriptions",
]);

/** Whether a key segment names `table`, in either direction of pluralisation. */
function names(segment: string, table: string): boolean {
  const k = segment.toLowerCase();
  const t = table.toLowerCase();
  return k === t || `${k}s` === t || k === `${t}s`;
}

export function queryMatchesTable(
  queryKey: readonly unknown[],
  table: string,
): boolean {
  if (!Array.isArray(queryKey)) return false;

  // The last string decides only when it names a sub-resource. It cannot decide in
  // general: `["transcriptions", id]` ends on the id, which is a string too.
  const last = [...queryKey]
    .reverse()
    .find((key): key is string => typeof key === "string");
  if (last && INDEPENDENT_SUBRESOURCES.has(last.toLowerCase())) {
    return names(last, table);
  }

  return queryKey.some((key) =>
    typeof key === "string" ? names(key, table) : false,
  );
}
