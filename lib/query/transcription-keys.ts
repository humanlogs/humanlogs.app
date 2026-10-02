/**
 * The query keys a transcription owns, and what a save invalidates.
 *
 * They are written out here because TanStack matches by PREFIX, and these keys
 * nest three deep:
 *
 *   ["transcriptions"]                       the sidebar's list
 *   ["transcriptions", id]                   one document, transcript included
 *   ["transcriptions", id, "participants"]   who can read it
 *   ["transcriptions", id, "subscriptions"]  which comment threads are followed
 *
 * So `invalidateQueries({ queryKey: ["transcriptions"] })` — the obvious thing to
 * write — matches ALL FOUR, for every document the session has open, and refetches
 * them. That is how a save came to pull the transcript, the participants and the
 * subscriptions of every open document down the wire; during a coding pass a save
 * follows every code applied, about once a second, and the transcript is the
 * largest payload in the app.
 *
 * The fix is `exact` on both filters, which is easy to write and just as easy to
 * drop again — hence a named function, and a test that drives a real QueryClient
 * through it rather than reading the options back.
 */

/** What a save does to the cache. See the two comments inside. */
export function invalidationsAfterTranscriptionSave(transcriptionId: string) {
  return [
    // The document itself: marked stale so a later visit reloads it, and NOT
    // refetched — we are the ones who just wrote it, so the answer would be what
    // we sent.
    {
      queryKey: ["transcriptions", transcriptionId] as const,
      exact: true,
      refetchType: "none" as const,
    },
    // The list DOES come back. It orders the sidebar by `updatedAt`; the query
    // client leaves window-focus refetching to the socket
    // (`refetchOnWindowFocus: false`); and the save route deliberately does not
    // notify the author of a content-only write. Nothing else would bring it up
    // to date, so this is the one refetch a save is worth.
    { queryKey: ["transcriptions"] as const, exact: true },
  ];
}
