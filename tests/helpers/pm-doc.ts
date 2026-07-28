import { Schema, type Node as PMNode } from "@tiptap/pm/model";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";

/**
 * Minimal ProseMirror schema matching what `docToSegments` reads: paragraphs
 * carrying a `speakerId` attribute, text, hard breaks and the four marks the
 * editor maps onto segment `modifiers`.
 *
 * Building docs from this schema (instead of booting a whole TipTap editor)
 * keeps the projection tests pure and fast — the real editor is exercised by
 * the Playwright suite.
 */
export const testSchema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "inline*",
      attrs: { speakerId: { default: "speaker_0" } },
    },
    text: { group: "inline" },
    hardBreak: { group: "inline", inline: true, selectable: false },
  },
  marks: {
    bold: {},
    italic: {},
    underline: {},
    strike: {},
    // Comment anchors, like the real editor's CommentMark: non-inclusive, and
    // carrying the space-separated set of thread ids covering the run.
    comment: { inclusive: false, attrs: { commentIds: { default: "" } } },
  },
});

type Inline =
  | string
  | { text: string; marks?: string[]; comment?: string }
  | { br: true };

function inlineToNode(part: Inline) {
  if (typeof part === "string") return testSchema.text(part);
  if ("br" in part) return testSchema.node("hardBreak");
  const marks = (part.marks ?? []).map((m) => testSchema.marks[m].create());
  if (part.comment)
    marks.push(testSchema.marks.comment.create({ commentIds: part.comment }));
  return testSchema.text(part.text, marks);
}

/** Single-paragraph doc: `doc("Bonjour le monde")`. */
export function doc(text: string, speakerId = "speaker_0"): PMNode {
  return testSchema.node("doc", null, [
    testSchema.node("paragraph", { speakerId }, text ? [testSchema.text(text)] : []),
  ]);
}

/** Multi-paragraph doc: `docOf([{ speakerId, content: [...] }, ...])`. */
export function docOf(
  paragraphs: { speakerId?: string; content: Inline[] }[],
): PMNode {
  return testSchema.node(
    "doc",
    null,
    paragraphs.map((p) =>
      testSchema.node(
        "paragraph",
        { speakerId: p.speakerId ?? "speaker_0" },
        p.content.map(inlineToNode),
      ),
    ),
  );
}

/** Build a timing reference from `["word", start, end]` triples. */
export function ref(
  ...specs: [string, number, number][]
): TranscriptionSegment[] {
  return specs.map(([text, start, end]) => ({
    type: "word",
    text,
    start,
    end,
  }));
}

export const words = (segs: TranscriptionSegment[]) =>
  segs.filter((s) => s.type === "word");

/** `[start, end]` of the first word whose text matches, or null. */
export const timeOf = (segs: TranscriptionSegment[], text: string) => {
  const w = words(segs).find((s) => s.text === text);
  return w ? [w.start, w.end] : null;
};

/** True when every word starts at or after the previous word's end. */
export function isMonotonic(segs: TranscriptionSegment[]): boolean {
  const ws = words(segs);
  for (let i = 1; i < ws.length; i++) {
    if ((ws[i].start ?? 0) < (ws[i - 1].end ?? 0)) return false;
  }
  return true;
}
