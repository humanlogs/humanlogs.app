import type { Fragment, Mark, Node as PMNode, Slice } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";

/**
 * Surgical merge of a pasted transcript back into the document.
 *
 * The round trip we care about: the user copies the whole transcript into Word,
 * fixes a few things there, selects everything and pastes it back. A plain paste
 * replaces the entire selection — which, in this editor, is catastrophic and
 * silent:
 *
 *  - Word does not round-trip our custom attributes, so every paragraph comes
 *    back WITHOUT `data-speaker-id` and the whole transcript collapses onto
 *    `speaker_0` (see `docToSegments`, which falls back to it).
 *  - `span[data-comment-id]` is lost the same way, so every comment thread is
 *    silently orphaned.
 *  - per-word audio timestamps are DERIVED by carrying them from the shared
 *    timing reference (`collab/doc-to-segments.ts`). A full replacement makes the
 *    changed "middle" span the whole transcript, which blows past that module's
 *    LCS cap and collapses the timing of everything between the first and last
 *    edit.
 *  - every remote caret is anchored (via Yjs relative positions) to text that no
 *    longer exists, so all collaborators' cursors jump.
 *
 * All four problems have the same root cause: the paste rewrites text that did
 * not actually change. So instead of replacing, we DIFF the pasted text against
 * the selected region and apply only the real changes:
 *
 *  1. paragraphs are aligned (exact prefix/suffix, then a similarity alignment on
 *     what is left) so an edited paragraph is recognized as the SAME paragraph;
 *  2. inside each aligned pair, words are diffed and only the changed runs are
 *     replaced / inserted / deleted, in place;
 *  3. paragraphs that were genuinely added or removed in Word become paragraph
 *     inserts/deletes, new ones inheriting the neighbouring speaker.
 *
 * Untouched text is never re-created, so speaker attributes, comment anchors,
 * formatting marks, remote carets and derived timestamps all survive. Everything
 * lands in ONE transaction (one undo step, one small Yjs update).
 *
 * This module is pure — positions in, positions out — so it is unit-testable
 * against a plain ProseMirror document.
 */

/* -------------------------------------------------------------------------- */
/* Normalization                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Neutralize the substitutions a word processor makes on its own: curly quotes,
 * en/em dashes, ellipsis, non-breaking and thin spaces, zero-width junk.
 *
 * This is what makes the whole thing usable in practice — Word's autocorrect
 * alone rewrites an apostrophe in most French sentences, and without this every
 * other word would look "changed" and the merge would degenerate into the full
 * rewrite we are trying to avoid.
 */
export function normalizeTypography(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201a\u201b\u02bc]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "");
}

/**
 * "Is this the same word?" — typography only, deliberately NOT case- or
 * punctuation-insensitive: re-capitalizing a word or adding a comma is a real
 * edit the user made in Word, and it must be applied.
 */
const eqKey = (word: string): string => normalizeTypography(word);

/** Letters/digits incl. the Latin-1 + Latin Extended-A ranges (accents). */
const EDGE_PUNCTUATION =
  /^[^0-9A-Za-z\u00c0-\u024f]+|[^0-9A-Za-z\u00c0-\u024f]+$/g;

/**
 * Looser key, used ONLY to score how similar two texts are (gating + paragraph
 * pairing). Here punctuation and case must be ignored, otherwise a paragraph the
 * user re-punctuated would fail to pair with its origin and would be rewritten
 * wholesale.
 */
const simKey = (word: string): string =>
  normalizeTypography(word).toLowerCase().replace(EDGE_PUNCTUATION, "");

/** Split a text into word tokens (whitespace is never diffed, see below). */
export const tokenize = (text: string): string[] => text.match(/\S+/g) ?? [];

/* -------------------------------------------------------------------------- */
/* Reading the document side                                                  */
/* -------------------------------------------------------------------------- */

export interface WordToken {
  text: string;
  /** Absolute document position of the first character. */
  from: number;
  /** Absolute document position just after the last character. */
  to: number;
}

export interface DocParagraph {
  /** Position of the paragraph NODE (its content starts at `pos + 1`). */
  pos: number;
  nodeSize: number;
  contentFrom: number;
  contentTo: number;
  speakerId: string | null;
  words: WordToken[];
  /** Text content, used for similarity scoring only. */
  text: string;
}

function readParagraph(node: PMNode, pos: number): DocParagraph {
  const contentFrom = pos + 1;
  const words: WordToken[] = [];
  let text = "";

  node.forEach((child, offset) => {
    const base = contentFrom + offset;
    if (child.isText) {
      const value = child.text ?? "";
      text += value;
      const re = /\S+/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(value))) {
        const from = base + match.index;
        const previous = words[words.length - 1];
        // A word split across two text nodes (a mark or a comment starting
        // mid-word) must come back as ONE token — otherwise the diff would see
        // two words where the paste has one and rewrite it for nothing. Inside a
        // single text node `\S+` matches are always separated by whitespace, so
        // adjacency can only happen across a node boundary.
        if (previous && previous.to === from) {
          previous.text += match[0];
          previous.to = from + match[0].length;
        } else {
          words.push({ text: match[0], from, to: from + match[0].length });
        }
      }
    } else {
      // hardBreak and any other inline leaf: whitespace as far as words go.
      text += "\n";
    }
  });

  return {
    pos,
    nodeSize: node.nodeSize,
    contentFrom,
    contentTo: pos + node.nodeSize - 1,
    speakerId: (node.attrs?.speakerId as string | null) ?? null,
    words,
    text,
  };
}

/**
 * The paragraphs covered by `[from, to]`, or null when the range is not a clean
 * paragraph range.
 *
 * The range must cover the FULL content of the paragraphs it touches: a
 * selection stopping mid-paragraph would make the diff delete the part the user
 * never selected. `Cmd+A` (an `AllSelection`) and a drag/triple-click over
 * everything both satisfy this; a partial selection falls back to a normal paste.
 */
export function readParagraphs(
  doc: PMNode,
  from: number,
  to: number,
): DocParagraph[] | null {
  const paragraphs: DocParagraph[] = [];
  let unsupported = false;

  doc.forEach((node, pos) => {
    const end = pos + node.nodeSize;
    if (end <= from || pos >= to) return;
    if (node.type.name !== "paragraph" || !node.isTextblock) {
      unsupported = true;
      return;
    }
    paragraphs.push(readParagraph(node, pos));
  });

  if (unsupported || paragraphs.length === 0) return null;
  const first = paragraphs[0];
  const last = paragraphs[paragraphs.length - 1];
  if (from > first.contentFrom || to < last.contentTo) return null;
  return paragraphs;
}

/* -------------------------------------------------------------------------- */
/* Reading the pasted side                                                    */
/* -------------------------------------------------------------------------- */

function blockText(node: PMNode): string {
  let text = "";
  node.forEach((child) => {
    if (child.isText) text += child.text ?? "";
    else if (child.isInline) text += "\n";
    else text += blockText(child);
  });
  return text;
}

/**
 * Flatten a pasted slice into plain-text paragraphs.
 *
 * Marks carried by the pasted content are deliberately ignored: Word routinely
 * applies document-wide `font-weight` spans that ProseMirror parses as real
 * marks, and honouring them would bold half a transcript. Formatting therefore
 * comes from the document being merged into, not from the paste.
 *
 * Empty blocks are dropped — Word emits a lot of them (`<o:p>`), and an empty
 * paragraph is never meaningful in a transcript.
 */
export function sliceToParagraphs(slice: Slice): string[] {
  const out: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) out.push(trimmed);
    current = "";
  };

  const walk = (fragment: Fragment) => {
    fragment.forEach((node) => {
      if (node.isText) {
        current += node.text ?? "";
      } else if (node.isInline) {
        current += "\n";
      } else if (node.isTextblock) {
        flush();
        current = blockText(node);
        flush();
      } else {
        walk(node.content);
      }
    });
  };

  walk(slice.content);
  flush();
  return out;
}

/**
 * Strip the noise Word puts in `text/html` before ProseMirror parses it. Applied
 * as `transformPastedHTML`, so it also cleans up the plain fallback paste when
 * the surgical merge does not engage.
 */
export function cleanPastedHtml(html: string): string {
  return html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<xml[\s\S]*?<\/xml>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?o:p[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "");
}

/* -------------------------------------------------------------------------- */
/* Similarity                                                                 */
/* -------------------------------------------------------------------------- */

type WordCounts = { counts: Map<string, number>; size: number };

function wordCounts(words: string[]): WordCounts {
  const counts = new Map<string, number>();
  for (const word of words) {
    const key = simKey(word);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { counts, size: words.length };
}

function diceFromCounts(a: WordCounts, b: WordCounts): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] =
    a.counts.size <= b.counts.size
      ? [a.counts, b.counts]
      : [b.counts, a.counts];
  let common = 0;
  small.forEach((count, key) => {
    common += Math.min(count, large.get(key) ?? 0);
  });
  return (2 * common) / (a.size + b.size);
}

/** Dice coefficient on the two word multisets — 1 identical, 0 disjoint. */
export function similarity(a: string[], b: string[]): number {
  return diceFromCounts(wordCounts(a), wordCounts(b));
}

/* -------------------------------------------------------------------------- */
/* Paragraph alignment                                                        */
/* -------------------------------------------------------------------------- */

export type Alignment =
  | { kind: "pair"; a: number; b: number }
  | { kind: "delete"; a: number }
  | { kind: "insert"; b: number };

/** Above this many (doc × pasted) changed paragraphs, pair them positionally. */
const PARAGRAPH_ALIGN_CAP = 40_000;
/** Below this similarity two paragraphs are unrelated: delete + insert instead. */
const MIN_PAIR_SIMILARITY = 0.4;

const paragraphKey = (text: string): string =>
  normalizeTypography(text).replace(/\s+/g, " ").trim();

/**
 * Align document paragraphs with pasted ones. Exact matches at both ends are
 * paired away first (that is the bulk of a round trip), then what is left goes
 * through a Needleman–Wunsch alignment scored by word-level similarity, so a
 * paragraph that was merely edited still pairs with its origin instead of being
 * deleted and re-inserted.
 */
export function alignParagraphs(
  docTexts: string[],
  pastedTexts: string[],
): Alignment[] {
  const m = docTexts.length;
  const n = pastedTexts.length;
  const a = docTexts.map(paragraphKey);
  const b = pastedTexts.map(paragraphKey);

  let prefix = 0;
  while (prefix < m && prefix < n && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < m - prefix &&
    suffix < n - prefix &&
    a[m - 1 - suffix] === b[n - 1 - suffix]
  )
    suffix++;

  const out: Alignment[] = [];
  for (let i = 0; i < prefix; i++) out.push({ kind: "pair", a: i, b: i });

  const midA: number[] = [];
  const midB: number[] = [];
  for (let i = prefix; i < m - suffix; i++) midA.push(i);
  for (let j = prefix; j < n - suffix; j++) midB.push(j);
  out.push(...alignMiddle(midA, midB, docTexts, pastedTexts));

  for (let k = suffix - 1; k >= 0; k--)
    out.push({ kind: "pair", a: m - 1 - k, b: n - 1 - k });

  return out;
}

function alignMiddle(
  midA: number[],
  midB: number[],
  docTexts: string[],
  pastedTexts: string[],
): Alignment[] {
  const m = midA.length;
  const n = midB.length;
  if (m === 0) return midB.map((b) => ({ kind: "insert", b }) as Alignment);
  if (n === 0) return midA.map((a) => ({ kind: "delete", a }) as Alignment);

  if (m * n > PARAGRAPH_ALIGN_CAP) {
    // Pathological change region (never a real round trip): pair positionally and
    // let the word-level diff stay surgical inside each pair.
    const out: Alignment[] = [];
    const paired = Math.min(m, n);
    for (let i = 0; i < paired; i++)
      out.push({ kind: "pair", a: midA[i], b: midB[i] });
    for (let i = paired; i < m; i++) out.push({ kind: "delete", a: midA[i] });
    for (let j = paired; j < n; j++) out.push({ kind: "insert", b: midB[j] });
    return out;
  }

  const countsA = midA.map((i) => wordCounts(tokenize(docTexts[i])));
  const countsB = midB.map((j) => wordCounts(tokenize(pastedTexts[j])));

  const PAIR = 1;
  const DELETE = 2;
  const INSERT = 3;
  const score: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  const back: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++) back[i][0] = DELETE;
  for (let j = 1; j <= n; j++) back[0][j] = INSERT;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const sim = diceFromCounts(countsA[i - 1], countsB[j - 1]);
      // Gaps cost nothing, pairing is worth its similarity: the alignment
      // maximizes total similarity and never pairs unrelated paragraphs.
      const pair =
        sim >= MIN_PAIR_SIMILARITY ? score[i - 1][j - 1] + sim : -Infinity;
      const del = score[i - 1][j];
      const ins = score[i][j - 1];
      if (pair >= del && pair >= ins) {
        score[i][j] = pair;
        back[i][j] = PAIR;
      } else if (del >= ins) {
        score[i][j] = del;
        back[i][j] = DELETE;
      } else {
        score[i][j] = ins;
        back[i][j] = INSERT;
      }
    }
  }

  const reversed: Alignment[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    const move = i > 0 && j > 0 ? back[i][j] : i > 0 ? DELETE : INSERT;
    if (move === PAIR) {
      reversed.push({ kind: "pair", a: midA[i - 1], b: midB[j - 1] });
      i--;
      j--;
    } else if (move === DELETE) {
      reversed.push({ kind: "delete", a: midA[i - 1] });
      i--;
    } else {
      reversed.push({ kind: "insert", b: midB[j - 1] });
      j--;
    }
  }
  return reversed.reverse();
}

/* -------------------------------------------------------------------------- */
/* Word-level diff                                                            */
/* -------------------------------------------------------------------------- */

interface Hunk {
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
}

/** Above this (changed doc words × changed pasted words), replace the run whole. */
const WORD_LCS_CAP = 1_000_000;

/** Longest common subsequence → matched [indexInA, indexInB] pairs. O(m·n). */
function lcs(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const pairs: [number, number][] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs.reverse();
}

/** The runs where the two word sequences actually differ. */
export function computeHunks(a: string[], b: string[]): Hunk[] {
  const m = a.length;
  const n = b.length;

  let prefix = 0;
  while (prefix < m && prefix < n && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < m - prefix &&
    suffix < n - prefix &&
    a[m - 1 - suffix] === b[n - 1 - suffix]
  )
    suffix++;

  const endA = m - suffix;
  const endB = n - suffix;
  if (prefix === endA && prefix === endB) return [];
  if ((endA - prefix) * (endB - prefix) > WORD_LCS_CAP)
    return [{ aStart: prefix, aEnd: endA, bStart: prefix, bEnd: endB }];

  const hunks: Hunk[] = [];
  let ai = prefix;
  let bi = prefix;
  for (const [la, lb] of lcs(a.slice(prefix, endA), b.slice(prefix, endB))) {
    const ga = prefix + la;
    const gb = prefix + lb;
    if (ga > ai || gb > bi)
      hunks.push({ aStart: ai, aEnd: ga, bStart: bi, bEnd: gb });
    ai = ga + 1;
    bi = gb + 1;
  }
  if (ai < endA || bi < endB)
    hunks.push({ aStart: ai, aEnd: endA, bStart: bi, bEnd: endB });
  return hunks;
}

/* -------------------------------------------------------------------------- */
/* Plan                                                                       */
/* -------------------------------------------------------------------------- */

export type DocOp =
  | { kind: "replace"; from: number; to: number; text: string }
  | { kind: "insert"; pos: number; text: string }
  | { kind: "delete"; from: number; to: number }
  | { kind: "deletePara"; pos: number; nodeSize: number }
  | { kind: "insertPara"; pos: number; text: string; speakerId: string | null };

export interface MergeStats {
  wordsReplaced: number;
  wordsInserted: number;
  wordsDeleted: number;
  paragraphsInserted: number;
  paragraphsDeleted: number;
}

export interface MergePlan {
  /** Ascending document order; {@link applyMergeOps} applies them backwards. */
  ops: DocOp[];
  stats: MergeStats;
  /** Total number of changes, for user feedback. */
  changeCount: number;
  /** Where the first change is, to move the caret there. */
  firstChangePos: number | null;
  similarity: number;
}

/** Below this many words on either side, a paste is not a transcript round trip. */
export const PASTE_MERGE_MIN_WORDS = 25;
/** Below this similarity the paste is different content, not an edited copy. */
export const PASTE_MERGE_MIN_SIMILARITY = 0.5;

export interface PlanOptions {
  minWords?: number;
  minSimilarity?: number;
}

/**
 * Build the list of surgical operations turning the document range `[from, to]`
 * into `pastedParagraphs`, or null when the paste should be handled normally
 * (range not paragraph-aligned, too short, or genuinely different content).
 */
export function planPasteMerge(
  doc: PMNode,
  from: number,
  to: number,
  pastedParagraphs: string[],
  options?: PlanOptions,
): MergePlan | null {
  const paragraphs = readParagraphs(doc, from, to);
  if (!paragraphs) return null;

  const pasted = pastedParagraphs
    .map((text) => text.trim())
    .filter((text) => text.length > 0);
  if (pasted.length === 0) return null;

  const docWords = paragraphs.flatMap((p) => p.words.map((w) => w.text));
  const pastedWords = pasted.flatMap(tokenize);
  const minWords = options?.minWords ?? PASTE_MERGE_MIN_WORDS;
  if (docWords.length < minWords || pastedWords.length < minWords) return null;

  const sim = similarity(docWords, pastedWords);
  if (sim < (options?.minSimilarity ?? PASTE_MERGE_MIN_SIMILARITY)) return null;

  const ops: DocOp[] = [];
  const stats: MergeStats = {
    wordsReplaced: 0,
    wordsInserted: 0,
    wordsDeleted: 0,
    paragraphsInserted: 0,
    paragraphsDeleted: 0,
  };

  const alignment = alignParagraphs(
    paragraphs.map((p) => p.text),
    pasted,
  );

  let lastDocParagraph: DocParagraph | null = null;
  for (const step of alignment) {
    if (step.kind === "pair") {
      const paragraph = paragraphs[step.a];
      diffParagraph(paragraph, tokenize(pasted[step.b]), ops, stats);
      lastDocParagraph = paragraph;
    } else if (step.kind === "delete") {
      const paragraph = paragraphs[step.a];
      ops.push({
        kind: "deletePara",
        pos: paragraph.pos,
        nodeSize: paragraph.nodeSize,
      });
      stats.paragraphsDeleted++;
      lastDocParagraph = paragraph;
    } else {
      // A paragraph added in Word. It inherits the speaker of the paragraph it
      // follows — the transcript's own attribute, never the paste's (which has
      // none).
      const anchor = lastDocParagraph;
      ops.push({
        kind: "insertPara",
        pos: anchor ? anchor.pos + anchor.nodeSize : paragraphs[0].pos,
        text: pasted[step.b],
        speakerId: (anchor ?? paragraphs[0]).speakerId,
      });
      stats.paragraphsInserted++;
    }
  }

  // The schema requires at least one paragraph, and emptying the transcript is
  // never what a round trip means.
  if (stats.paragraphsDeleted === paragraphs.length) return null;

  const changeCount =
    stats.wordsReplaced +
    stats.wordsInserted +
    stats.wordsDeleted +
    stats.paragraphsInserted +
    stats.paragraphsDeleted;

  return {
    ops,
    stats,
    changeCount,
    firstChangePos: ops.length ? opPosition(ops[0]) : null,
    similarity: sim,
  };
}

function opPosition(op: DocOp): number {
  switch (op.kind) {
    case "replace":
    case "delete":
      return op.from;
    default:
      return op.pos;
  }
}

/**
 * Word-level diff of one paragraph. Whitespace is never diffed: only words are
 * compared, and a changed run is replaced between the first and last word it
 * covers. That keeps line breaks and spacing exactly as the transcript had them.
 */
function diffParagraph(
  paragraph: DocParagraph,
  pastedWords: string[],
  ops: DocOp[],
  stats: MergeStats,
): void {
  const words = paragraph.words;
  const hunks = computeHunks(
    words.map((w) => eqKey(w.text)),
    pastedWords.map(eqKey),
  );

  for (const hunk of hunks) {
    const removed = hunk.aEnd - hunk.aStart;
    const added = hunk.bEnd - hunk.bStart;
    const text = pastedWords.slice(hunk.bStart, hunk.bEnd).join(" ");

    if (removed > 0 && added > 0) {
      ops.push({
        kind: "replace",
        from: words[hunk.aStart].from,
        to: words[hunk.aEnd - 1].to,
        text,
      });
      stats.wordsReplaced += Math.max(removed, added);
    } else if (added > 0) {
      if (hunk.aStart > 0) {
        ops.push({
          kind: "insert",
          pos: words[hunk.aStart - 1].to,
          text: ` ${text}`,
        });
      } else if (words.length > 0) {
        ops.push({ kind: "insert", pos: words[0].from, text: `${text} ` });
      } else {
        ops.push({ kind: "insert", pos: paragraph.contentFrom, text });
      }
      stats.wordsInserted += added;
    } else {
      // Swallow one adjacent whitespace run with the deleted words, otherwise a
      // double space is left behind.
      let start = words[hunk.aStart].from;
      let end = words[hunk.aEnd - 1].to;
      if (hunk.aStart > 0) start = words[hunk.aStart - 1].to;
      else if (hunk.aEnd < words.length) end = words[hunk.aEnd].from;
      ops.push({ kind: "delete", from: start, to: end });
      stats.wordsDeleted += removed;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Applying                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Marks shared by every text node in a range. Used for replacements so a
 * corrected word keeps the bold/italic AND the comment anchor of the word it
 * replaces — `$pos.marks()` would drop the comment mark, which is `inclusive:
 * false`, and punch a hole in the highlight band.
 */
function marksForRange(doc: PMNode, from: number, to: number): readonly Mark[] {
  let marks: readonly Mark[] | null = null;
  doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return true;
    marks =
      marks === null
        ? node.marks
        : marks.filter((mark) => mark.isInSet(node.marks));
    return false;
  });
  return marks ?? [];
}

/**
 * Apply a plan's operations to `tr`, in ONE transaction.
 *
 * Operations are applied from the end of the document backwards, so every
 * position stays valid without mapping (nothing before an operation has moved
 * yet). Several inserts anchored at the same position keep their relative order
 * for the same reason.
 */
export function applyMergeOps(tr: Transaction, ops: DocOp[]): Transaction {
  const schema = tr.doc.type.schema;
  const paragraphType = schema.nodes.paragraph;

  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    switch (op.kind) {
      case "replace":
        tr.replaceWith(
          op.from,
          op.to,
          schema.text(op.text, marksForRange(tr.doc, op.from, op.to)),
        );
        break;
      case "insert":
        tr.insert(op.pos, schema.text(op.text, tr.doc.resolve(op.pos).marks()));
        break;
      case "delete":
        tr.delete(op.from, op.to);
        break;
      case "deletePara":
        tr.delete(op.pos, op.pos + op.nodeSize);
        break;
      case "insertPara":
        tr.insert(
          op.pos,
          paragraphType.create(
            op.speakerId ? { speakerId: op.speakerId } : null,
            schema.text(op.text),
          ),
        );
        break;
    }
  }

  return tr;
}
