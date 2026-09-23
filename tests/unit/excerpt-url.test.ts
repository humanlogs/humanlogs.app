import { describe, expect, it } from "vitest";
import {
  decodeExcerptState,
  encodeExcerptState,
  excerptStateKey,
  hasExcerptParams,
  writeExcerptParams,
  type ExcerptUrlState,
} from "@/lib/codebooks/excerpt-url";

/**
 * The address bar is now the record of what the table was asked. Two properties
 * carry the whole feature and both are quiet when they break: a round trip must
 * not lose anything a researcher set, and the encoding must be CANONICAL —
 * the sync loop tells "the URL moved under me" from "I wrote that" by comparing
 * strings, so a state that encodes two ways would write forever.
 */

const FULL: ExcerptUrlState = {
  scope: "document",
  authors: "mine",
  search: "violence",
  codes: [{ codebookId: "cb1", codeId: "violence" }],
  contextCodes: [{ codebookId: "cb2", codeId: "cadre" }],
  rules: [{ kind: "speaker" }, { kind: "code", codebookId: "cb1" }],
};

function roundTrip(state: Partial<ExcerptUrlState>) {
  const params = new URLSearchParams(encodeExcerptState(state));
  return decodeExcerptState(params);
}

describe("round trip", () => {
  it("keeps everything that was set", () => {
    expect(roundTrip(FULL)).toEqual(FULL);
  });

  it("is canonical: encoding what it decoded gives the same string", () => {
    const once = excerptStateKey(FULL);
    expect(excerptStateKey(roundTrip(FULL))).toBe(once);
  });

  it("keeps several codes, in order", () => {
    const state = {
      codes: [
        { codebookId: "cb1", codeId: "a" },
        { codebookId: "cb1", codeId: "b" },
      ],
    };
    expect(roundTrip(state).codes).toEqual(state.codes);
  });

  it("keeps the grouping chain in order", () => {
    const rules = [
      { kind: "context" as const, codebookId: "roles" },
      { kind: "code" as const },
      { kind: "document" as const },
    ];
    expect(roundTrip({ rules }).rules).toEqual(rules);
  });
});

describe("defaults are absence", () => {
  it("writes nothing for a table nobody has touched", () => {
    expect(
      encodeExcerptState({
        scope: "study",
        authors: "everyone",
        search: "",
        codes: [],
        contextCodes: [],
      }),
    ).toEqual([]);
  });

  it("writes an empty grouping, because ungrouped is a choice", () => {
    // Without this, "flat" and "this link says nothing about grouping" would be
    // the same URL, and following one would silently regroup the table.
    expect(encodeExcerptState({ rules: [] })).toEqual([["g", ""]]);
    expect(roundTrip({ rules: [] }).rules).toEqual([]);
  });

  it("trims a search down to nothing", () => {
    expect(encodeExcerptState({ search: "   " })).toEqual([]);
  });
});

describe("decoding what a URL actually holds", () => {
  const of = (query: string) => decodeExcerptState(new URLSearchParams(query));

  it("says nothing about what the URL does not mention", () => {
    expect(of("phase=coding")).toEqual({});
    expect(hasExcerptParams(new URLSearchParams("phase=coding"))).toBe(false);
  });

  it("notices a single parameter", () => {
    expect(hasExcerptParams(new URLSearchParams("q=x"))).toBe(true);
  });

  it("drops a malformed code rather than the whole filter", () => {
    expect(of("c=cb1:violence,rubbish,:x,y:").codes).toEqual([
      { codebookId: "cb1", codeId: "violence" },
    ]);
  });

  it("drops a rule it does not recognise", () => {
    expect(of("g=speaker,weather,code").rules).toEqual([
      { kind: "speaker" },
      { kind: "code" },
    ]);
  });

  it("reads anything but the known token as the default", () => {
    expect(of("sc=whatever").scope).toBe("study");
    expect(of("au=whatever").authors).toBe("everyone");
  });

  it("keeps a code id containing a colon", () => {
    // Split on the FIRST colon: the codebook id is a uuid and never holds one.
    expect(of("c=cb1:a:b").codes).toEqual([
      { codebookId: "cb1", codeId: "a:b" },
    ]);
  });
});

describe("writeExcerptParams", () => {
  it("leaves the rest of the route alone", () => {
    const params = new URLSearchParams("phase=coding&coding=abc&q=old");
    writeExcerptParams(params, { search: "new" });
    expect(params.get("phase")).toBe("coding");
    expect(params.get("coding")).toBe("abc");
    expect(params.get("q")).toBe("new");
  });

  it("removes what the state no longer says", () => {
    const params = new URLSearchParams("q=old&c=cb1:x&au=mine");
    writeExcerptParams(params, { search: "", codes: [] });
    expect(params.get("q")).toBeNull();
    expect(params.get("c")).toBeNull();
    expect(params.get("au")).toBeNull();
  });
});
