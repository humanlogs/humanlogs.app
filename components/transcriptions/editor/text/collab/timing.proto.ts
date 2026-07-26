/**
 * Stage A verification (runnable): deterministic timestamp derivation.
 *
 *   npx tsx components/transcriptions/editor/text/collab/timing.proto.ts
 *
 * Proves docToSegments(doc, reference) is a PURE function — unchanged words keep the
 * reference's exact times even with scattered edits, new words interpolate, and two
 * clients with the same (doc, reference) derive identical timestamps → convergence.
 * Also measures the LCS cost on a large doc (the open perf question).
 */
import { Schema, type Node as PMNode } from "@tiptap/pm/model";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { docToSegments } from "./doc-to-segments";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`);
    if (extra !== undefined)
      console.error(JSON.stringify(extra, null, 2).slice(0, 1500));
  }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Minimal PM schema matching what docToSegments reads.
const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      attrs: { speakerId: { default: "speaker_0" } },
    },
    text: { group: "inline" },
  },
  marks: { bold: {}, italic: {}, underline: {}, strike: {} },
});
const doc = (text: string, speakerId = "speaker_0"): PMNode =>
  schema.node("doc", null, [
    schema.node(
      "paragraph",
      { speakerId },
      text ? [schema.text(text)] : [],
    ),
  ]);

/** Build a timing reference from "word:start:end" specs. */
const ref = (...specs: [string, number, number][]): TranscriptionSegment[] =>
  specs.map(([text, start, end]) => ({ type: "word", text, start, end }));

const words = (segs: TranscriptionSegment[]) =>
  segs.filter((s) => s.type === "word");
const timeOf = (segs: TranscriptionSegment[], text: string) => {
  const w = words(segs).find((s) => s.text === text);
  return w ? [w.start, w.end] : null;
};

const reference = ref(
  ["Bonjour", 0, 0.5],
  ["tout", 0.5, 0.8],
  ["le", 0.8, 0.9],
  ["monde", 0.9, 1.5],
);

// 1. Identical text → exact reference timestamps.
console.log("Deterministic derivation:");
{
  const segs = docToSegments(doc("Bonjour tout le monde"), reference);
  check("unchanged doc → exact times", eq(timeOf(segs, "Bonjour"), [0, 0.5]) &&
    eq(timeOf(segs, "monde"), [0.9, 1.5]));
}

// 2. Word inserted in the middle → neighbours keep exact times, new word interpolates.
{
  const segs = docToSegments(doc("Bonjour tout le grand monde"), reference);
  check("neighbours keep exact times across an insertion",
    eq(timeOf(segs, "le"), [0.8, 0.9]) && eq(timeOf(segs, "monde"), [0.9, 1.5]));
  const grand = words(segs).find((s) => s.text === "grand");
  check("inserted word interpolated within the gap",
    !!grand && grand.start! >= 0.9 && grand.end! <= 0.9, { grand });
}

// 3. Scattered edits (change first and last word) → the UNCHANGED middle keeps exact
//    times (this is what prefix/suffix-only would lose; LCS preserves it).
{
  const segs = docToSegments(doc("Salut tout le pays"), reference);
  check("scattered edits: middle stays exact via LCS",
    eq(timeOf(segs, "tout"), [0.5, 0.8]) && eq(timeOf(segs, "le"), [0.8, 0.9]),
    { segs: words(segs) });
}

// 4. Determinism + convergence: same (doc, reference) → identical result (twice, and
//    "two clients").
{
  const d = doc("Bonjour tout le grand monde");
  const a = docToSegments(d, reference);
  const b = docToSegments(d, reference);
  check("pure function: identical output for identical input", eq(a, b));
  // Two clients that converged the doc + share the reference derive the same.
  const clientA = docToSegments(doc("Bonjour beau monde"), reference);
  const clientB = docToSegments(doc("Bonjour beau monde"), reference);
  check("two clients converge to identical timestamps", eq(clientA, clientB));
}

// 5. Monotonicity always holds.
{
  const segs = words(docToSegments(doc("un deux trois quatre cinq"), reference));
  let mono = true;
  for (let i = 1; i < segs.length; i++)
    if ((segs[i].start ?? 0) < (segs[i - 1].end ?? 0)) mono = false;
  check("timestamps monotonic non-decreasing", mono, segs);
}

// 5b. Refresh stability: refreshing the shared reference to the derived words, then
//     re-deriving from it (same doc), must be a FIXED POINT (no further drift).
{
  const d = doc("Bonjour tout le grand monde");
  const segs1 = docToSegments(d, reference);
  const ref1 = words(segs1); // the save leader would publish this as the new reference
  const segs2 = docToSegments(d, ref1);
  check("refresh is a fixed point (re-derive == derive)", eq(segs1, segs2), {
    segs1: words(segs1),
    segs2: words(segs2),
  });
}

// 6. Perf.
console.log("\nPerf (large doc):");
const N = 3000;
const bigRef: TranscriptionSegment[] = [];
for (let i = 0; i < N; i++)
  bigRef.push({ type: "word", text: `w${i}`, start: i * 0.3, end: i * 0.3 + 0.25 });

// (a) Realistic per-derivation shape: edits CLUSTERED in one region → prefix/suffix
//     trim leaves a tiny middle → LCS is exact everywhere else and fast.
{
  const parts = bigRef.map((w, i) =>
    i >= 1000 && i < 1010 ? `x${i}` : (w.text as string),
  );
  const bigDoc = doc(parts.join(" "));
  const t0 = process.hrtime.bigint();
  const segs = docToSegments(bigDoc, bigRef);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`  clustered edit (10 words) → ${ms.toFixed(1)} ms`);
  check("clustered: far unchanged word exact", eq(timeOf(segs, "w1550"), [465, 465.25]));
  check("clustered: near unchanged word exact", eq(timeOf(segs, "w990"), [297, 297.25]));
  check("clustered fast (<60ms)", ms < 60);
}

// (b) Pathological: edits scattered across the WHOLE doc → the changed span is the
//     whole doc, LCS cap kicks in → the middle interpolates (minor offsets accepted).
//     We only require it stays fast and monotonic (still converges — pure function).
{
  const parts = bigRef.map((w, i) => (i % 100 === 0 ? `x${i}` : (w.text as string)));
  const bigDoc = doc(parts.join(" "));
  const t0 = process.hrtime.bigint();
  const segs = words(docToSegments(bigDoc, bigRef));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`  scattered edit (whole doc) → ${ms.toFixed(1)} ms (LCS cap → interpolate)`);
  let mono = true;
  for (let i = 1; i < segs.length; i++)
    if ((segs[i].start ?? 0) < (segs[i - 1].end ?? 0)) mono = false;
  check("scattered: still monotonic (converges)", mono);
  check("scattered fast (<120ms)", ms < 120);
}

console.log(
  failures === 0
    ? "\n✅ Stage A: all checks passed"
    : `\n❌ ${failures} check(s) failed`,
);
process.exit(failures === 0 ? 0 : 1);
