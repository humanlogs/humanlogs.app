import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteDocState,
  deleteDocumentIndex,
  destroyAllLocalDbs,
  destroyLocalDb,
  pruneDocStates,
  putDocState,
  putDocumentIndex,
  readDocState,
  readDocumentRows,
  readStudyIndex,
} from "@/lib/local/db.browser";
import { buildPhraseIndex } from "@/lib/local/phrase-index";
import {
  SyncThrottledError,
  syncStudyIndex,
  type CodingManifestEntry,
  type FetchedDocument,
} from "@/lib/local/sync.browser";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";

/**
 * The store and the engine, against a real IndexedDB implementation.
 *
 * The pure halves are covered elsewhere; what is left is exactly the part that
 * cannot be reasoned about on paper — transactions that replace a document's rows
 * atomically, cursors that must not leak across studies, and an engine that has to
 * come back from a rate limit rather than record a hole in the index.
 */

const USER = "user-1";

/** A one-speaker projection whose Nth word carries the given anchors. */
function segments(text: string, codings: Record<number, string[]>) {
  const out: TranscriptionSegment[] = [];
  text.split(" ").forEach((word, i) => {
    if (i > 0) out.push({ type: "spacing", text: " ", speakerId: "speaker_0" });
    out.push({
      type: "word",
      text: word,
      speakerId: "speaker_0",
      ...(codings[i] ? { codings: codings[i] } : {}),
    });
  });
  return out;
}

function indexOf(
  documentId: string,
  projectId: string | null,
  text: string,
  codings: Record<number, string[]>,
  rows: Array<{ id: string; codeId: string; userId?: string }>,
) {
  return buildPhraseIndex({
    documentId,
    projectId,
    segments: segments(text, codings),
    codings: rows.map((row) => ({
      id: row.id,
      codebookId: "cb1",
      codeId: row.codeId,
      userId: row.userId ?? "u1",
    })),
  });
}

async function store(
  documentId: string,
  projectId: string | null,
  text: string,
  codings: Record<number, string[]>,
  rows: Array<{ id: string; codeId: string; userId?: string }>,
) {
  const index = indexOf(documentId, projectId, text, codings, rows);
  await putDocumentIndex(USER, {
    document: {
      id: documentId,
      studyKey: projectId ?? "",
      title: `Interview ${documentId}`,
      indexedUpdatedAt: "2026-01-01T00:00:00.000Z",
      indexedCodingSignature: "sig",
    },
    ...index,
  });
  return index;
}

beforeEach(async () => {
  await destroyLocalDb(USER);
});

describe("the local store", () => {
  it("reads back what one document put in", async () => {
    await store("doc1", "study1", "on nous crie dessus", { 2: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);

    const { phrases, links } = await readStudyIndex(USER, "study1");
    expect(phrases.map((p) => p.text)).toEqual(["crie"]);
    expect(links.map((l) => l.codeId)).toEqual(["violence"]);
  });

  it("REPLACES a document's rows rather than adding to them", async () => {
    // The property the whole design rests on: the index is derived, so re-indexing
    // must leave exactly what the new derivation says — a passage whose code was
    // retracted has no row to update, only a row to be gone.
    await store("doc1", "study1", "un deux trois", { 0: ["c1"], 1: ["c2"] }, [
      { id: "c1", codeId: "violence" },
      { id: "c2", codeId: "institution" },
    ]);
    await store("doc1", "study1", "un deux trois", { 0: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);

    const { phrases, links } = await readStudyIndex(USER, "study1");
    expect(phrases.map((p) => p.text)).toEqual(["un"]);
    expect(links).toHaveLength(1);
  });

  it("never mixes two studies", async () => {
    await store("doc1", "study1", "un deux", { 0: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);
    await store("doc2", "study2", "trois quatre", { 0: ["c2"] }, [
      { id: "c2", codeId: "violence" },
    ]);

    expect(
      (await readStudyIndex(USER, "study1")).phrases.map((p) => p.text),
    ).toEqual(["un"]);
    expect(
      (await readStudyIndex(USER, "study2")).phrases.map((p) => p.text),
    ).toEqual(["trois"]);
  });

  it("finds the documents filed in no study, which an index would skip on null", async () => {
    await store("doc1", null, "un deux", { 0: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);
    const { phrases } = await readStudyIndex(USER, null);
    expect(phrases).toHaveLength(1);
    expect(phrases[0].projectId).toBeNull();
  });

  it("forgets a document whole — rows and metadata together", async () => {
    await store("doc1", "study1", "un deux", { 0: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);
    await deleteDocumentIndex(USER, "doc1");

    expect(await readDocumentRows(USER)).toEqual([]);
    expect((await readStudyIndex(USER, "study1")).phrases).toEqual([]);
    expect((await readStudyIndex(USER, "study1")).links).toEqual([]);
  });

  it("records what it holds, for the security page to report", async () => {
    await store("doc1", "study1", "un deux trois", { 0: ["c1"], 2: ["c2"] }, [
      { id: "c1", codeId: "violence" },
      { id: "c2", codeId: "institution" },
    ]);
    const [row] = await readDocumentRows(USER);
    expect(row).toMatchObject({
      id: "doc1",
      studyKey: "study1",
      phraseCount: 2,
    });
  });

  it("keeps one user's corpus out of another's", async () => {
    await store("doc1", "study1", "un deux", { 0: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);
    // A different user is a different database, not a different column.
    expect(await readDocumentRows("user-2")).toEqual([]);
    await destroyLocalDb("user-2");
  });

  it("wipes every user's copy when the device is not trusted", async () => {
    await store("doc1", "study1", "un deux", { 0: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);
    await destroyAllLocalDbs();
    expect(await readDocumentRows(USER)).toEqual([]);
  });
});

describe("syncStudyIndex", () => {
  const entry = (
    id: string,
    overrides: Partial<CodingManifestEntry> = {},
  ): CodingManifestEntry => ({
    id,
    updatedAt: "2026-02-01T00:00:00.000Z",
    projectId: "study1",
    codings: 1,
    codingLatest: "2026-02-01T00:00:00.000Z",
    ...overrides,
  });

  const document = (): FetchedDocument => ({
    title: "Interview",
    projectId: "study1",
    segments: segments("on nous crie dessus", { 2: ["c1"] }),
    codings: [
      { id: "c1", codebookId: "cb1", codeId: "violence", userId: "u1" },
    ],
  });

  it("indexes the documents the manifest says have moved", async () => {
    const result = await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest: [entry("doc1"), entry("doc2")],
      fetchDocument: async () => document(),
      documentsPerMinute: 0,
    });

    expect(result).toMatchObject({
      total: 2,
      done: 2,
      failed: 0,
      upToDate: false,
    });
    expect((await readStudyIndex(USER, "study1")).phrases).toHaveLength(2);
  });

  it("does nothing on a second pass over an unchanged study", async () => {
    const manifest = [entry("doc1")];
    const fetchDocument = vi.fn(async () => document());

    await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest,
      fetchDocument,
      documentsPerMinute: 0,
    });
    const second = await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest,
      fetchDocument,
      documentsPerMinute: 0,
    });

    expect(second.upToDate).toBe(true);
    expect(fetchDocument).toHaveBeenCalledTimes(1);
  });

  it("comes back from a rate limit instead of leaving a hole", async () => {
    let attempts = 0;
    const result = await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest: [entry("doc1")],
      fetchDocument: async () => {
        // `retryAfterMs` of 0 keeps the test honest about the retry without making
        // it wait for the real backoff.
        if (attempts++ === 0) throw new SyncThrottledError(0);
        return document();
      },
      documentsPerMinute: 0,
    });

    expect(attempts).toBe(2);
    expect(result).toMatchObject({ done: 1, failed: 0 });
  });

  it("gives up on a document that stays throttled, rather than looping", async () => {
    let attempts = 0;
    const result = await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest: [entry("doc1")],
      fetchDocument: async () => {
        attempts++;
        throw new SyncThrottledError(0);
      },
      documentsPerMinute: 0,
    });

    expect(attempts).toBeLessThanOrEqual(5);
    expect(result).toMatchObject({ done: 0, failed: 1 });
  });

  it("counts an unreadable document as one the panel is not showing", async () => {
    const result = await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest: [entry("doc1")],
      // No key on this device.
      fetchDocument: async () => null,
      documentsPerMinute: 0,
    });
    expect(result).toMatchObject({ done: 0, failed: 1 });
  });

  it("drops the documents the server stopped listing", async () => {
    await store("gone", "study1", "un deux", { 0: ["c1"] }, [
      { id: "c1", codeId: "violence" },
    ]);

    const result = await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest: [],
      fetchDocument: async () => document(),
      documentsPerMinute: 0,
    });

    expect(result.removed).toBe(1);
    expect((await readStudyIndex(USER, "study1")).phrases).toEqual([]);
  });

  it("stops when the pass is aborted", async () => {
    const controller = new AbortController();
    const fetchDocument = vi.fn(async () => {
      controller.abort();
      return document();
    });

    await syncStudyIndex({
      userId: USER,
      projectId: "study1",
      manifest: [entry("doc1"), entry("doc2"), entry("doc3")],
      fetchDocument,
      signal: controller.signal,
      documentsPerMinute: 0,
    });

    // The two workers already in flight finish their fetch; nothing beyond starts.
    expect(fetchDocument.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

/**
 * The transcript cache. Its budget is the one place in the local model where
 * being wrong costs the user something they cannot rebuild cheaply: a browser
 * that hits its storage quota evicts the whole origin, and the coded-passage
 * index goes with it.
 */
describe("the document-state cache", () => {
  const state = (id: string, bytes: number) =>
    putDocState(USER, {
      id,
      update: new ArrayBuffer(bytes),
      serverUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

  it("reads back a state that was written", async () => {
    await state("doc1", 1024);
    const row = await readDocState(USER, "doc1");
    expect(row?.update.byteLength).toBe(1024);
  });

  it("keeps everything while it fits", async () => {
    await state("doc1", 1000);
    await state("doc2", 1000);
    expect(
      await pruneDocStates(USER, { maxBytes: 10_000, maxDocuments: 10 }),
    ).toBe(0);
    expect(await readDocState(USER, "doc1")).not.toBeNull();
  });

  it("evicts by BYTES, oldest first — a count would not have caught this", async () => {
    // Three documents, well under any sane count cap, well over the byte one.
    await state("old", 4000);
    await state("middle", 4000);
    await state("newest", 4000);

    const dropped = await pruneDocStates(USER, {
      maxBytes: 9000,
      maxDocuments: 100,
    });

    expect(dropped).toBe(1);
    expect(await readDocState(USER, "old")).toBeNull();
    expect(await readDocState(USER, "middle")).not.toBeNull();
    expect(await readDocState(USER, "newest")).not.toBeNull();
  });

  it("still bounds the count, for documents too small to reach the bytes", async () => {
    for (const id of ["a", "b", "c", "d"]) await state(id, 10);
    const dropped = await pruneDocStates(USER, {
      maxBytes: 10_000_000,
      maxDocuments: 2,
    });
    expect(dropped).toBe(2);
  });

  it("never evicts the state just written, whatever the budget", async () => {
    // A budget smaller than one document would otherwise delete the write that
    // triggered the prune, and the next open would find nothing.
    await state("only", 5000);
    await pruneDocStates(USER, { maxBytes: 10, maxDocuments: 10 });
    expect(await readDocState(USER, "only")).not.toBeNull();
  });

  it("forgets a state and its metadata together", async () => {
    await state("doc1", 1000);
    await state("doc2", 1000);
    await deleteDocState(USER, "doc1");
    // If the metadata outlived the blob, eviction would keep budgeting for bytes
    // that are no longer there and drop live states to make room for a ghost.
    expect(
      await pruneDocStates(USER, { maxBytes: 1500, maxDocuments: 10 }),
    ).toBe(0);
    expect(await readDocState(USER, "doc2")).not.toBeNull();
  });
});
