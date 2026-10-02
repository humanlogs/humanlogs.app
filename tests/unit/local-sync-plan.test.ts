import { describe, expect, it } from "vitest";
import type { LocalDocumentRow } from "@/lib/local/db.browser";
import type { PhraseRow } from "@/lib/local/phrase-index";
import {
  codingSignature,
  phraseIndexSignature,
  planSync,
  type CodingManifestEntry,
} from "@/lib/local/sync.browser";

/**
 * The sync plan is the protocol. It decides, per document, whether the browser
 * downloads and decrypts a whole interview or does nothing at all — and it is the
 * one place where being wrong is silent: too eager and every load re-downloads the
 * corpus, too lazy and the excerpt panel keeps answering with codes retracted last
 * week.
 */

const entry = (
  id: string,
  overrides: Partial<CodingManifestEntry> = {},
): CodingManifestEntry => ({
  id,
  updatedAt: "2026-01-01T00:00:00.000Z",
  projectId: "study1",
  codings: 3,
  codingLatest: "2026-01-02T00:00:00.000Z",
  ...overrides,
});

const indexed = (
  from: CodingManifestEntry,
  overrides: Partial<LocalDocumentRow> = {},
): LocalDocumentRow => ({
  id: from.id,
  studyKey: from.projectId ?? "",
  title: "Interview",
  indexedUpdatedAt: from.updatedAt,
  indexedCodingSignature: codingSignature(from),
  indexedAt: 0,
  phraseCount: 5,
  ...overrides,
});

describe("planSync", () => {
  it("does nothing when every document is already indexed at the right version", () => {
    const manifest = [entry("a"), entry("b")];
    const plan = planSync({
      manifest,
      local: manifest.map((e) => indexed(e)),
      scope: "study1",
    });
    expect(plan.stale).toEqual([]);
    expect(plan.removable).toEqual([]);
  });

  it("rebuilds a document whose transcript moved", () => {
    const before = entry("a");
    const plan = planSync({
      manifest: [entry("a", { updatedAt: "2026-02-01T00:00:00.000Z" })],
      local: [indexed(before)],
      scope: "study1",
    });
    expect(plan.stale.map((e) => e.id)).toEqual(["a"]);
  });

  it("rebuilds a document that was only CODED — its transcript never moved", () => {
    // The case a single `updatedAt` cursor would miss entirely: applying a code
    // writes a Coding row now and an anchor whenever the save leader next flushes,
    // so the transcript's timestamp can sit unchanged for minutes.
    const before = entry("a", { codings: 3 });
    const plan = planSync({
      manifest: [
        entry("a", { codings: 4, codingLatest: "2026-01-03T00:00:00.000Z" }),
      ],
      local: [indexed(before)],
      scope: "study1",
    });
    expect(plan.stale.map((e) => e.id)).toEqual(["a"]);
  });

  it("rebuilds when a coding was retracted, even though the count stayed", () => {
    // Delete one code and apply another: same count, later timestamp.
    const before = entry("a", {
      codings: 3,
      codingLatest: "2026-01-02T00:00:00.000Z",
    });
    const plan = planSync({
      manifest: [
        entry("a", { codings: 3, codingLatest: "2026-01-05T00:00:00.000Z" }),
      ],
      local: [indexed(before)],
      scope: "study1",
    });
    expect(plan.stale.map((e) => e.id)).toEqual(["a"]);
  });

  it("never downloads a document nobody has coded", () => {
    const plan = planSync({
      manifest: [entry("a", { codings: 0, codingLatest: null })],
      local: [],
      scope: "study1",
    });
    expect(plan.stale).toEqual([]);
  });

  it("DOES rebuild a document whose last code was retracted, so its rows go", () => {
    const before = entry("a", { codings: 2 });
    const plan = planSync({
      manifest: [entry("a", { codings: 0, codingLatest: null })],
      local: [indexed(before)],
      scope: "study1",
    });
    expect(plan.stale.map((e) => e.id)).toEqual(["a"]);
  });

  it("forgets a document the server no longer lists", () => {
    const gone = indexed(entry("gone"));
    const plan = planSync({
      manifest: [entry("a")],
      local: [gone, indexed(entry("a"))],
      scope: "study1",
    });
    expect(plan.removable.map((row) => row.id)).toEqual(["gone"]);
  });

  it("leaves the other studies alone — a scoped manifest is not a census", () => {
    const other = indexed(entry("other", { projectId: "study2" }), {
      studyKey: "study2",
    });
    const plan = planSync({
      manifest: [entry("a")],
      local: [other, indexed(entry("a"))],
      scope: "study1",
    });
    expect(plan.removable).toEqual([]);
  });

  it("sweeps every study when the manifest covered the whole corpus", () => {
    const other = indexed(entry("other", { projectId: "study2" }), {
      studyKey: "study2",
    });
    const plan = planSync({
      manifest: [entry("a")],
      local: [other],
      scope: null,
    });
    expect(plan.removable.map((row) => row.id)).toEqual(["other"]);
  });

  it("distinguishes a document filed in no study from one in a study", () => {
    const loose = indexed(entry("loose", { projectId: null }), {
      studyKey: "",
    });
    expect(
      planSync({ manifest: [], local: [loose], scope: "" }).removable,
    ).toEqual([loose]);
    expect(
      planSync({ manifest: [], local: [loose], scope: "study1" }).removable,
    ).toEqual([]);
  });
});

/**
 * The other half of "do proportional work": the open document is re-derived several
 * times a second while someone types, and almost none of those derivations change a
 * coded passage. This is what decides whether the rewrite happens at all.
 */
describe("phraseIndexSignature", () => {
  const phrase = (id: string, text: string): PhraseRow => ({
    id,
    documentId: "doc1",
    projectId: "study1",
    speakerId: "speaker_0",
    text,
    offset: 0,
    codingIds: [id],
  });
  const index = (...phrases: PhraseRow[]) => ({ phrases, links: [] });

  it("is stable for an unchanged index — which is what skips the write", () => {
    expect(phraseIndexSignature(index(phrase("p1", "on nous crie")))).toBe(
      phraseIndexSignature(index(phrase("p1", "on nous crie"))),
    );
  });

  it("moves when a passage is coded", () => {
    expect(phraseIndexSignature(index(phrase("p1", "un")))).not.toBe(
      phraseIndexSignature(index(phrase("p1", "un"), phrase("p2", "deux"))),
    );
  });

  it("moves when the text INSIDE a coded passage is edited, ids unchanged", () => {
    // The case an id-only fingerprint would miss: the anchors are untouched, but
    // the excerpt the table shows is no longer the one it was showing.
    expect(phraseIndexSignature(index(phrase("p1", "on nous crie")))).not.toBe(
      phraseIndexSignature(index(phrase("p1", "on nous crie dessus"))),
    );
  });

  it("keeps the id and the text apart, so a shift between them is not a match", () => {
    expect(phraseIndexSignature(index(phrase("a", "b")))).not.toBe(
      phraseIndexSignature(index(phrase("ab", ""))),
    );
  });
});
