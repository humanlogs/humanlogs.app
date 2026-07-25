import type { Node as PMNode } from "@tiptap/pm/model";
import type { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";
import { enforceTimestampInvariant } from "./ydoc-schema";

/**
 * Derive the flat `TranscriptionSegment[]` projection from a ProseMirror document.
 *
 * With the standard TipTap Collaboration binding the Y.XmlFragment IS the document
 * (text, paragraph structure, speaker attrs, marks) — but audio sync, the speaker
 * UI, autosave, search, etc. all consume the flat segment array. This module
 * rebuilds that array from the (converged) doc: structure is read directly; per-word
 * start/end are carried over from the previous projection (unchanged prefix/suffix
 * keep exact timestamps, freshly-edited words interpolate). Deterministic given the
 * same doc + previous segments.
 */

const MARK_TO_MOD: Record<string, "b" | "i" | "u" | "s"> = {
  bold: "b",
  italic: "i",
  underline: "u",
  strike: "s",
};

function marksToMods(node: PMNode): ("b" | "i" | "u" | "s")[] | undefined {
  const mods: ("b" | "i" | "u" | "s")[] = [];
  for (const m of node.marks) {
    const mod = MARK_TO_MOD[m.type.name];
    if (mod && !mods.includes(mod)) mods.push(mod);
  }
  return mods.length ? mods : undefined;
}

/** Split a text run into word / spacing tokens, inheriting speaker + modifiers. */
function pushTextRun(
  out: TranscriptionSegment[],
  text: string,
  speakerId: string,
  modifiers: ("b" | "i" | "u" | "s")[] | undefined,
) {
  if (!text) return;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      out.push({ type: "spacing", text: part, speakerId });
    } else {
      out.push({
        type: "word",
        text: part,
        speakerId,
        ...(modifiers ? { modifiers } : {}),
      });
    }
  }
}

/** Extract structure-only segments (no timestamps) from the PM doc. */
function docToStructureSegments(doc: PMNode): TranscriptionSegment[] {
  const out: TranscriptionSegment[] = [];
  let firstParagraph = true;

  doc.forEach((block) => {
    if (block.type.name !== "paragraph") return;
    const speakerId = (block.attrs?.speakerId as string) || "speaker_0";

    // Paragraph boundary → 2-char "\n\n" spacing (mirrors the projection convention
    // and keeps PMpos == flatCharOffset + 1).
    if (!firstParagraph) {
      out.push({ type: "spacing", text: "\n\n", speakerId });
    }
    firstParagraph = false;

    block.forEach((inline) => {
      if (inline.isText) {
        pushTextRun(out, inline.text ?? "", speakerId, marksToMods(inline));
      } else if (inline.type.name === "hardBreak") {
        out.push({ type: "spacing", text: "\n", speakerId });
      }
    });
  });

  return out;
}

const norm = (w: string): string =>
  w.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");

/**
 * Carry start/end from `prev` onto `next` word tokens: unchanged common prefix and
 * suffix keep their exact timestamps; the changed middle is left null and then
 * interpolated by {@link enforceTimestampInvariant}. O(n), deterministic.
 */
function carryTimestamps(
  next: TranscriptionSegment[],
  prev: TranscriptionSegment[],
): void {
  const nextWords = next.filter((s) => s.type === "word");
  const prevWords = prev.filter((s) => s.type === "word");
  const n = nextWords.length;
  const m = prevWords.length;

  let p = 0;
  while (p < n && p < m && norm(nextWords[p].text) === norm(prevWords[p].text)) {
    nextWords[p].start = prevWords[p].start;
    nextWords[p].end = prevWords[p].end;
    p++;
  }
  let s = 0;
  while (
    s < n - p &&
    s < m - p &&
    norm(nextWords[n - 1 - s].text) === norm(prevWords[m - 1 - s].text)
  ) {
    nextWords[n - 1 - s].start = prevWords[m - 1 - s].start;
    nextWords[n - 1 - s].end = prevWords[m - 1 - s].end;
    s++;
  }
  // Middle words (p .. n-s) keep null start/end → interpolated below.
  for (let i = p; i < n - s; i++) {
    nextWords[i].start = undefined;
    nextWords[i].end = undefined;
  }

  // Interpolate the gaps and enforce monotonicity across all words.
  const holder = nextWords.map((w) => ({
    start: w.start ?? null,
    end: w.end ?? null,
  }));
  enforceTimestampInvariant(holder);
  for (let i = 0; i < n; i++) {
    nextWords[i].start = holder[i].start ?? undefined;
    nextWords[i].end = holder[i].end ?? undefined;
  }
}

/**
 * Full derivation: structure from the doc + timestamps carried from `prev`, then
 * normalized to the canonical word/spacing shape the rest of the editor expects.
 */
export function docToSegments(
  doc: PMNode,
  prev: TranscriptionSegment[] | null | undefined,
): TranscriptionSegment[] {
  const structure = docToStructureSegments(doc);
  if (prev && prev.length) carryTimestamps(structure, prev);
  // Canonicalize (merge spacings, spacing start/end from neighbours) WITHOUT the
  // initialFormatting paragraph-splitting pass (that runs only at seed time).
  return normalizeEditorSegments(structure);
}
