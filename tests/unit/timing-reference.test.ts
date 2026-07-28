import { describe, expect, it } from "vitest";
import { docToSegments } from "@/components/transcriptions/editor/text/collab/doc-to-segments";
import {
  chooseTimingReference,
  isUnsyncedBlank,
} from "@/components/transcriptions/editor/text/collab/timing-reference";
import { doc, ref, timeOf } from "../helpers/pm-doc";

/**
 * Regression cover for a session-wide loss of audio positions: opening a document
 * occasionally left every word seeking to t=0 until a reload.
 *
 * The projection is debounced, so it can run while the Y.Doc is still empty — the
 * seed is late because the room's authority is still the socket of the page we
 * just reloaded, and its state reply never comes. That derivation returned an
 * empty projection, which replaced the loaded segments, which the seed then pinned
 * as the SHARED timing reference. Every client in the room then derived words with
 * no start/end, and clicking one moved the playhead nowhere.
 *
 * These two helpers are what stands between that sequence and the reference.
 */

const loaded = ref(["Bonjour", 0, 0.5], ["le", 0.5, 0.8], ["monde", 0.8, 1.5]);

describe("chooseTimingReference", () => {
  it("prefers the reference shared in the Y.Doc", () => {
    const shared = ref(["Bonjour", 2, 2.5]);
    expect(chooseTimingReference(shared, loaded, loaded)).toBe(shared);
  });

  it("falls back to the current projection when nothing is shared yet", () => {
    expect(chooseTimingReference(null, loaded, [])).toBe(loaded);
  });

  it("treats an EMPTY shared reference as no reference at all", () => {
    // The exact failure: an empty array is a valid Y.Map value, and taking it
    // means "no word has a timestamp".
    expect(chooseTimingReference([], null, loaded)).toBe(loaded);
  });

  it("treats an emptied projection as no reference at all", () => {
    expect(chooseTimingReference([], [], loaded)).toBe(loaded);
  });

  it("keeps the document's own timings when a reference survives", () => {
    const segs = docToSegments(
      doc("Bonjour le monde"),
      chooseTimingReference([], [], loaded),
    );
    expect(timeOf(segs, "monde")).toEqual([0.8, 1.5]);
  });

  it("is what stands between the blank reference and t=0 everywhere", () => {
    // What the broken build did: derive against the empty reference directly.
    const segs = docToSegments(doc("Bonjour le monde"), []);
    expect(
      segs.filter((s) => s.type === "word").every((w) => w.start === undefined),
    ).toBe(true);
  });
});

describe("isUnsyncedBlank", () => {
  it("flags the projection of a document that has not arrived yet", () => {
    expect(
      isUnsyncedBlank([], { hadInitialContent: true, localEdits: false }),
    ).toBe(true);
  });

  it("lets the user empty a document by hand", () => {
    expect(
      isUnsyncedBlank([], { hadInitialContent: true, localEdits: true }),
    ).toBe(false);
  });

  it("lets a genuinely empty document be empty", () => {
    expect(
      isUnsyncedBlank([], { hadInitialContent: false, localEdits: false }),
    ).toBe(false);
  });

  it("never flags a projection that has content", () => {
    expect(
      isUnsyncedBlank(loaded, { hadInitialContent: true, localEdits: false }),
    ).toBe(false);
  });
});
