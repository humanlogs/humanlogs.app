import { describe, expect, it } from "vitest";
import { queryMatchesTable } from "@/lib/sockets/db-change-match";

/**
 * What a `db:change` event refetches.
 *
 * This rule sits between the server naming a table and the client holding query keys,
 * and it is wrong in two directions. Too narrow and a collaborator's comment never
 * appears. Too wide and it costs a round trip per keystroke: a transcript autosave used
 * to drag the document list, the document itself, who has access to it and who follows
 * its threads down the wire — four requests, three of them about things that had not
 * changed, on every save of a coding pass.
 *
 * The keys below are the real ones the app registers.
 */

const ID = "86261076-6e37-44a1-9f2e-000000000000";

describe("queryMatchesTable", () => {
  it("refreshes a document's list and detail when it changes", () => {
    expect(queryMatchesTable(["transcriptions"], "transcription")).toBe(true);
    expect(queryMatchesTable(["transcriptions", ID], "transcription")).toBe(
      true,
    );
  });

  it("leaves a document's sub-resources alone", () => {
    // They hang off the same key because that is where they belong in the URL, not
    // because saving the text changes who has access to it.
    expect(
      queryMatchesTable(
        ["transcriptions", ID, "participants"],
        "transcription",
      ),
    ).toBe(false);
    expect(
      queryMatchesTable(
        ["transcriptions", ID, "subscriptions"],
        "transcription",
      ),
    ).toBe(false);
  });

  it("refreshes a sub-resource when it is named", () => {
    expect(
      queryMatchesTable(["transcriptions", ID, "participants"], "participants"),
    ).toBe(true);
    expect(
      queryMatchesTable(
        ["transcriptions", ID, "subscriptions"],
        "subscription",
      ),
    ).toBe(true);
  });

  it("matches whichever way round the plural falls", () => {
    // The server emits the singular Prisma model, the keys use the plural.
    expect(queryMatchesTable(["comments", ID], "comment")).toBe(true);
    expect(queryMatchesTable(["codings", ID], "coding")).toBe(true);
    expect(queryMatchesTable(["notifications"], "notification")).toBe(true);
  });

  it("still reaches a key whose last segment is not its resource", () => {
    // "counts" names neither a table nor a sub-resource: the notification badge has
    // to refresh when a notification arrives.
    expect(queryMatchesTable(["notifications", "counts"], "notification")).toBe(
      true,
    );
    expect(queryMatchesTable(["notifications", 20], "notification")).toBe(true);
  });

  it("does not confuse one resource for another", () => {
    expect(queryMatchesTable(["codebooks"], "coding")).toBe(false);
    expect(queryMatchesTable(["codings", ID], "codebook")).toBe(false);
    expect(queryMatchesTable(["projects"], "transcription")).toBe(false);
  });

  it("ignores a key with nothing to match on", () => {
    expect(queryMatchesTable([], "transcription")).toBe(false);
    expect(queryMatchesTable([42], "transcription")).toBe(false);
  });
});
