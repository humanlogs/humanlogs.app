import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidationsAfterTranscriptionSave } from "@/lib/query/transcription-keys";

/**
 * This exists because the bug happened.
 *
 * A save invalidated `["transcriptions"]` with no `exact`, TanStack matched by
 * prefix, and every open document's transcript, participants and thread
 * subscriptions came back down the wire — once per save, which during a coding
 * pass is about once a second. Nothing failed; it was only visible in a network
 * tab, which is exactly the kind of regression that returns.
 *
 * So the filters are driven through a REAL QueryClient here rather than read back
 * as options: what matters is which queries end up refetching, and that is a
 * property of TanStack's matching, not of the object we pass it.
 */

const DOC = "doc-1";
const OTHER = "doc-2";

/** A client holding every key a session with two open documents would have. */
function seeded() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const keys = [
    ["transcriptions"],
    ["transcriptions", DOC],
    ["transcriptions", DOC, "participants"],
    ["transcriptions", DOC, "subscriptions"],
    ["transcriptions", OTHER],
    ["transcriptions", OTHER, "participants"],
  ];
  for (const key of keys) client.setQueryData(key, { seeded: true });
  return client;
}

function apply(client: QueryClient, id = DOC) {
  for (const filters of invalidationsAfterTranscriptionSave(id)) {
    void client.invalidateQueries(filters);
  }
}

const isStale = (client: QueryClient, key: unknown[]) =>
  client.getQueryState(key)?.isInvalidated === true;

describe("what a save invalidates", () => {
  it("marks the document stale", () => {
    const client = seeded();
    apply(client);
    expect(isStale(client, ["transcriptions", DOC])).toBe(true);
  });

  it("marks the list stale, so the sidebar reorders by updatedAt", () => {
    const client = seeded();
    apply(client);
    expect(isStale(client, ["transcriptions"])).toBe(true);
  });

  it("leaves the participants alone — nobody's access changed", () => {
    const client = seeded();
    apply(client);
    expect(isStale(client, ["transcriptions", DOC, "participants"])).toBe(
      false,
    );
  });

  it("leaves the thread subscriptions alone", () => {
    const client = seeded();
    apply(client);
    expect(isStale(client, ["transcriptions", DOC, "subscriptions"])).toBe(
      false,
    );
  });

  it("does not reach another document at all", () => {
    // The prefix trap at its worst: `["transcriptions"]` unqualified matches
    // every document the session has open, not just the one being saved.
    const client = seeded();
    apply(client);
    expect(isStale(client, ["transcriptions", OTHER])).toBe(false);
    expect(isStale(client, ["transcriptions", OTHER, "participants"])).toBe(
      false,
    );
  });
});

describe("what a save refetches", () => {
  /**
   * `refetchType` decides whether an invalidated query is fetched again now. The
   * document must NOT be: we just wrote it, so the answer would be what we sent,
   * and it is the largest payload in the app.
   */
  it("asks for no refetch of the document", () => {
    const [document] = invalidationsAfterTranscriptionSave(DOC);
    expect(document.refetchType).toBe("none");
    expect(document.exact).toBe(true);
  });

  it("lets the list refetch", () => {
    // Not an oversight: window-focus refetching is off (the socket is meant to
    // cover it) and the save route does not notify the author of a content-only
    // write, so nothing else would ever bring the list back.
    const [, list] = invalidationsAfterTranscriptionSave(DOC);
    expect(list).not.toHaveProperty("refetchType");
    expect(list.exact).toBe(true);
  });

  it("names only the two keys a save can have changed", () => {
    expect(
      invalidationsAfterTranscriptionSave(DOC).map((f) => f.queryKey),
    ).toEqual([["transcriptions", DOC], ["transcriptions"]]);
  });
});
