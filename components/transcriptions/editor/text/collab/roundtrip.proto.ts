/**
 * Stage 0 verification (runnable): proves that the Yjs schema + conversion are
 * a stable round-trip and that two independently-edited docs converge.
 *
 *   npx tsx components/transcriptions/editor/text/collab/roundtrip.proto.ts
 *
 * Not a CI test (there is no test runner in this repo) — a self-checking proto in
 * the spirit of the project's existing *.proto.ts convention. Exits non-zero on
 * failure so it can gate manual runs.
 */
import * as Y from "yjs";
import type {
  TranscriptionContent,
  TranscriptionSegment,
} from "@/hooks/use-transcriptions";
import {
  enforceTimestampInvariant,
  getBlocks,
  getBlockTokens,
  newTokenMap,
  seedYDoc,
  ydocToContent,
} from "./ydoc-schema";
import { reconcileYDoc } from "./reconcile";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.error(`  ✗ ${name}`);
    if (extra !== undefined)
      console.error(JSON.stringify(extra, null, 2).slice(0, 2000));
  }
}

const eq = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Full pipeline: stored content -> Y.Doc -> derived content. */
function project(content: TranscriptionContent): TranscriptionContent {
  const doc = new Y.Doc();
  seedYDoc(content, doc);
  return ydocToContent(doc);
}

// ---------------------------------------------------------------------------
// Fixtures — shapes that mirror what the STT webhooks / editor actually store.
// ---------------------------------------------------------------------------

const w = (
  text: string,
  start: number,
  end: number,
  speakerId: string,
  modifiers?: ("b" | "i" | "u" | "s")[],
): TranscriptionSegment => ({ type: "word", text, start, end, speakerId, modifiers });

const sp = (
  text: string,
  speakerId: string,
): TranscriptionSegment => ({ type: "spacing", text, speakerId });

// Single speaker, plain words separated by spaces.
const singleSpeaker: TranscriptionContent = {
  speakers: [{ id: "speaker_0", name: "Alice" }],
  words: [
    w("Bonjour", 0, 0.5, "speaker_0"),
    sp(" ", "speaker_0"),
    w("tout", 0.5, 0.8, "speaker_0"),
    sp(" ", "speaker_0"),
    w("le", 0.8, 0.9, "speaker_0"),
    sp(" ", "speaker_0"),
    w("monde", 0.9, 1.4, "speaker_0", ["b"]),
  ],
};

// Two speakers → one paragraph boundary.
const twoSpeakers: TranscriptionContent = {
  speakers: [
    { id: "speaker_0", name: "Alice" },
    { id: "speaker_1", name: "Bob" },
  ],
  words: [
    w("Salut", 0, 0.4, "speaker_0"),
    sp(" ", "speaker_0"),
    w("Bob", 0.4, 0.7, "speaker_0"),
    sp(" ", "speaker_0"),
    w("Oui", 1.0, 1.3, "speaker_1"),
    sp(" ", "speaker_1"),
    w("bonjour", 1.3, 1.9, "speaker_1"),
  ],
};

// Explicit hard paragraph break within the same speaker.
const paragraphBreak: TranscriptionContent = {
  speakers: [{ id: "speaker_0" }],
  words: [
    w("Premier", 0, 0.5, "speaker_0"),
    sp(" ", "speaker_0"),
    w("paragraphe.", 0.5, 1.0, "speaker_0"),
    sp("\n\n", "speaker_0"),
    w("Deuxième", 1.5, 2.0, "speaker_0"),
    sp(" ", "speaker_0"),
    w("paragraphe.", 2.0, 2.6, "speaker_0"),
  ],
};

// Words with spaces baked into the text (STT-style, no spacing tokens).
const bakedSpaces: TranscriptionContent = {
  speakers: [{ id: "speaker_0" }],
  words: [
    { type: "word", text: "un ", start: 0, end: 0.3, speakerId: "speaker_0" },
    { type: "word", text: "deux ", start: 0.3, end: 0.7, speakerId: "speaker_0" },
    { type: "word", text: "trois", start: 0.7, end: 1.1, speakerId: "speaker_0" },
  ],
};

const fixtures: [string, TranscriptionContent][] = [
  ["singleSpeaker", singleSpeaker],
  ["twoSpeakers", twoSpeakers],
  ["paragraphBreak", paragraphBreak],
  ["bakedSpaces", bakedSpaces],
];

// ---------------------------------------------------------------------------
// 1. Idempotency: f(f(x)) === f(x)  (stable across save/load cycles)
// ---------------------------------------------------------------------------
console.log("Idempotency of project(content):");
for (const [name, content] of fixtures) {
  const once = project(content);
  const twice = project(once);
  check(`${name}: f∘f === f`, eq(once.words, twice.words), {
    once: once.words,
    twice: twice.words,
  });
  check(
    `${name}: speakers preserved`,
    once.speakers.length >= content.speakers.length,
  );
}

// ---------------------------------------------------------------------------
// 2. Structural invariants on the derived projection
// ---------------------------------------------------------------------------
console.log("\nStructural invariants:");
for (const [name, content] of fixtures) {
  const { words } = project(content);
  // word/spacing alternation (no two adjacent words, no two adjacent spacings)
  let alternates = true;
  for (let i = 1; i < words.length; i++) {
    if (words[i].type === words[i - 1].type) alternates = false;
  }
  check(`${name}: word/spacing alternate`, alternates, words);

  // every paragraph boundary is exactly a 2-char "\n\n"
  const boundaries = words.filter((s) => s.text.includes("\n\n"));
  check(
    `${name}: boundaries are 2-char \\n\\n`,
    boundaries.every((s) => s.text === "\n\n"),
    boundaries,
  );
}

// ---------------------------------------------------------------------------
// 3. Position invariant: sum(tokenLen) + 2*(blocks-1) === total flat char length
//    (the 2 chars per boundary === the "\n\n" reinserted between blocks)
// ---------------------------------------------------------------------------
console.log("\nPosition invariant (blocks vs flat length):");
for (const [name, content] of fixtures) {
  const doc = new Y.Doc();
  seedYDoc(content, doc);
  const blocks = getBlocks(doc);
  let tokenChars = 0;
  for (let b = 0; b < blocks.length; b++) {
    const toks = getBlockTokens(blocks.get(b));
    for (let t = 0; t < toks.length; t++)
      tokenChars += ((toks.get(t).get("text") as string) ?? "").length;
  }
  const flatChars = ydocToContent(doc).words.reduce(
    (acc, s) => acc + s.text.length,
    0,
  );
  const expected = tokenChars + 2 * Math.max(0, blocks.length - 1);
  check(
    `${name}: tokenChars + 2*(blocks-1) === flatChars`,
    expected === flatChars,
    { tokenChars, blocks: blocks.length, flatChars, expected },
  );
}

// ---------------------------------------------------------------------------
// 4. Convergence: two docs, concurrent independent edits, then sync -> identical
// ---------------------------------------------------------------------------
console.log("\nConvergence of two independently-edited docs:");
{
  const base = new Y.Doc();
  seedYDoc(twoSpeakers, base);
  const baseState = Y.encodeStateAsUpdate(base);

  const docA = new Y.Doc();
  Y.applyUpdate(docA, baseState);
  const docB = new Y.Doc();
  Y.applyUpdate(docB, baseState);

  // A: edit a word's text in block 0 (in place — preserves identity)
  docA.transact(() => {
    const tok = getBlockTokens(getBlocks(docA).get(0)).get(0);
    tok.set("text", "Coucou");
  }, "A");

  // B: change block 1's speaker + append a new token to block 1
  docB.transact(() => {
    const block1 = getBlocks(docB).get(1);
    block1.set("speakerId", "speaker_0");
    const toks = getBlockTokens(block1);
    toks.push([newTokenMap(sp(" ", "speaker_0"))]);
    toks.push([newTokenMap(w("vraiment", 1.9, 2.3, "speaker_0"))]);
  }, "B");

  // exchange updates both directions
  Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB));
  Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

  const a = ydocToContent(docA);
  const b = ydocToContent(docB);
  check("A and B converge to identical content", eq(a.words, b.words), {
    a: a.words,
    b: b.words,
  });
  check(
    "A's in-place text edit survived",
    a.words.some((s) => s.text === "Coucou"),
  );
  check(
    "B's appended word survived",
    a.words.some((s) => s.text === "vraiment"),
  );
}

// ---------------------------------------------------------------------------
// 5. enforceTimestampInvariant: interpolation + monotonicity, deterministic
// ---------------------------------------------------------------------------
console.log("\nenforceTimestampInvariant:");
{
  const toks = [
    { start: 0, end: 1 },
    { start: null as number | null, end: null as number | null }, // new word
    { start: null as number | null, end: null as number | null }, // new word
    { start: 3, end: 4 },
  ];
  enforceTimestampInvariant(toks);
  const noNulls = toks.every((t) => t.start != null && t.end != null);
  check("all timestamps filled", noNulls, toks);
  let monotonic = true;
  for (let i = 1; i < toks.length; i++)
    if ((toks[i].start as number) < (toks[i - 1].end as number))
      monotonic = false;
  check("monotonic non-decreasing", monotonic, toks);

  // idempotent
  const before = JSON.stringify(toks);
  enforceTimestampInvariant(toks);
  check("idempotent", before === JSON.stringify(toks));

  // out-of-order input gets repaired
  const messy = [
    { start: 5, end: 6 },
    { start: 1, end: 2 },
  ];
  enforceTimestampInvariant(messy);
  check(
    "repairs decreasing timestamps",
    (messy[1].start as number) >= (messy[0].end as number),
    messy,
  );
}

// ---------------------------------------------------------------------------
// 6. reconcileYDoc: identity preservation + minimal ops + fresh-seed equivalence
// ---------------------------------------------------------------------------
console.log("\nreconcileYDoc (PM->Yjs bridge):");
{
  const doc = new Y.Doc();
  seedYDoc(twoSpeakers, doc);

  // Grab stable references to existing token Y.Maps to test identity preservation.
  const block0 = getBlocks(doc).get(0);
  const firstTok = getBlockTokens(block0).get(0); // "Salut"
  const secondWordTok = getBlockTokens(block0).get(2); // "Bob"
  const firstStart = firstTok.get("start");
  const firstEnd = firstTok.get("end");

  // (a) In-place text edit: "Salut" -> "Coucou"
  const target = ydocToContent(doc);
  const salut = target.words.find((s) => s.text === "Salut")!;
  salut.text = "Coucou";
  reconcileYDoc(doc, target, "local");

  check(
    "in-place edit preserves token identity (same Y.Map)",
    getBlockTokens(getBlocks(doc).get(0)).get(0) === firstTok,
  );
  check("in-place edit updated text", firstTok.get("text") === "Coucou");
  check(
    "in-place edit preserved start/end",
    firstTok.get("start") === firstStart && firstTok.get("end") === firstEnd,
  );
  check(
    "untouched neighbour token keeps identity",
    getBlockTokens(getBlocks(doc).get(0)).get(2) === secondWordTok,
  );
  check(
    "content reflects the edit",
    ydocToContent(doc).words.some((s) => s.text === "Coucou"),
  );

  // (b) Speaker change on block 1 preserves its tokens' identities.
  const block1 = getBlocks(doc).get(1);
  const b1tok0 = getBlockTokens(block1).get(0);
  const target2 = ydocToContent(doc);
  // Re-assign every "speaker_1" segment to "speaker_0".
  for (const s of target2.words)
    if (s.speakerId === "speaker_1") s.speakerId = "speaker_0";
  reconcileYDoc(doc, target2, "local");
  // A plain speaker reassignment keeps the paragraph break: two blocks, same
  // speaker (matches the non-collab editor — merging paragraphs is a distinct op).
  check("speaker reassignment keeps two blocks", getBlocks(doc).length === 2);
  check(
    "both blocks now speaker_0",
    (() => {
      const bs = getBlocks(doc);
      let ok = true;
      for (let i = 0; i < bs.length; i++)
        if ((bs.get(i).get("speakerId") as string) !== "speaker_0") ok = false;
      return ok;
    })(),
  );
  check(
    "block1 token identity preserved through in-place speaker change",
    getBlockTokens(getBlocks(doc).get(1)).get(0) === b1tok0,
  );

  // (c) Fresh-seed equivalence: reconciling to a target yields the same content
  //     as seeding that target into a brand-new doc.
  const finalContent = ydocToContent(doc);
  const fresh = new Y.Doc();
  seedYDoc(finalContent, fresh);
  check(
    "reconciled doc === fresh seed of same content",
    eq(finalContent.words, ydocToContent(fresh).words),
    { reconciled: finalContent.words, fresh: ydocToContent(fresh).words },
  );
}

console.log(
  failures === 0
    ? "\n✅ Stage 0+1 core: all checks passed"
    : `\n❌ ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
