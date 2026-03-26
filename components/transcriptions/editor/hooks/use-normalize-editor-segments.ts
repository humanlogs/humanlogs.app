import { TranscriptionSegment } from "../../../../hooks/use-api";

/**
 * Normalizes an array of TranscriptionSegments so that:
 * 1.
 * - Every word segment contains no whitespace nor line breaks
 * - Every spacing segment contains only whitespace or line breaks or //TODO punctuation (.,!?;¿¡:…)
 * - Every word are separated by a spacing segment (space or new line)
 * -> Split or create segments to satisfy this rules, with empty start/end/speakerId/modifiers values
 * 2.
 * - Consecutive words or spacings are merged into one (in that case we take the first start/end/modifiers/speakerId to ensure we keep them)
 * 3.
 * - Recompute start/end/speakerId/modifiers of all elements based on neighboring:
 *   - if same before / after, we use the value
 *   - if different, we use the before value
 * 4.
 * - Spacing segments longer than 2s get changed to word and get a text="(pause)"
 * -> To ensure space/word/space pattern, we'll replace the spacing by [spacing, word, spacing] to be exact
 * - Spacing segments where word before or word after have a different speakerId get changed to text="\n\n" and use the speakerId of the previous word
 * -> This makes the tailing or heading spaces disappear, it needs a smarter replacements to keep the merged spacing in case the text already includes a \n\n
 */
export function normalizeEditorSegments(
  segments: TranscriptionSegment[],
  options?: {
    addPauses?: boolean; // whether to add (pause) segments for long silences, default: true
  },
): TranscriptionSegment[] {
  if (segments.length === 0) return segments;

  // ---------------------------------------------------------------------------
  // Step 1: Ensure word segments contain no whitespace and spacing segments
  //         contain only whitespace/newlines. Insert spacing between adjacent
  //         words. New segments created here have empty metadata.
  // ---------------------------------------------------------------------------
  const expanded: TranscriptionSegment[] = [];

  for (const seg of segments) {
    if (!seg.text) continue;

    if (seg.type === "word") {
      if (!/\s/.test(seg.text)) {
        expanded.push(seg);
      } else {
        // Split word containing whitespace, distributing timing proportionally
        const parts = seg.text.split(/(\s+)/);
        const totalLength = seg.text.length;
        let charOffset = 0;

        for (const part of parts) {
          if (!part) continue;

          // Calculate proportional start/end times based on character position
          let partStart = seg.start;
          let partEnd = seg.end;
          if (
            seg.start !== undefined &&
            seg.end !== undefined &&
            totalLength > 0
          ) {
            const duration = seg.end - seg.start;
            const startRatio = charOffset / totalLength;
            const endRatio = (charOffset + part.length) / totalLength;
            partStart = seg.start + duration * startRatio;
            partEnd = seg.start + duration * endRatio;
          }

          expanded.push(
            /^\s+$/.test(part)
              ? {
                  type: "spacing",
                  text: part,
                  start: partStart,
                  end: partEnd,
                  speakerId: seg.speakerId,
                }
              : { ...seg, text: part, start: partStart, end: partEnd },
          );
          charOffset += part.length;
        }
      }
    } else {
      // spacing — may contain non-whitespace after browser editing
      if (/^\s*$/.test(seg.text)) {
        expanded.push(seg);
      } else {
        // Split spacing containing non-whitespace, distributing timing proportionally
        const parts = seg.text.split(/(\s+)/);
        const totalLength = seg.text.length;
        let charOffset = 0;

        for (const part of parts) {
          if (!part) continue;

          // Calculate proportional start/end times
          let partStart = seg.start;
          let partEnd = seg.end;
          if (
            seg.start !== undefined &&
            seg.end !== undefined &&
            totalLength > 0
          ) {
            const duration = seg.end - seg.start;
            const startRatio = charOffset / totalLength;
            const endRatio = (charOffset + part.length) / totalLength;
            partStart = seg.start + duration * startRatio;
            partEnd = seg.start + duration * endRatio;
          }

          expanded.push(
            /^\s+$/.test(part)
              ? {
                  ...seg,
                  type: "spacing" as const,
                  text: part,
                  start: partStart,
                  end: partEnd,
                  modifiers: undefined,
                }
              : {
                  ...seg,
                  type: "word" as const,
                  text: part,
                  start: partStart,
                  end: partEnd,
                },
          );
          charOffset += part.length;
        }
      }
    }
  }

  // Ensure every pair of adjacent word segments is separated by a spacing
  const separated: TranscriptionSegment[] = [];
  for (let i = 0; i < expanded.length; i++) {
    separated.push(expanded[i]);
    if (
      expanded[i].type === "word" &&
      i + 1 < expanded.length &&
      expanded[i + 1].type === "word"
    ) {
      separated.push({ type: "spacing", text: " " });
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: Merge consecutive segments of the same type.
  //         For timing: keep start of first segment and end of last segment.
  // ---------------------------------------------------------------------------
  const merged: TranscriptionSegment[] = [];
  for (const seg of separated) {
    const prev = merged[merged.length - 1];
    if (prev && prev.type === seg.type) {
      // Merge: keep start from first, end from current, first non-undefined metadata
      merged[merged.length - 1] = {
        ...prev,
        text: prev.text + seg.text,
        end: seg.end ?? prev.end,
        speakerId: prev.speakerId ?? seg.speakerId,
        modifiers: prev.modifiers ?? seg.modifiers,
      };
    } else {
      merged.push({ ...seg });
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3: Recompute start/end/speakerId for spacing segments based on
  //         neighboring words.
  //         - start  → end of nearest word before
  //         - end    → start of nearest word after
  //         - speakerId → if neighbors agree, use shared value; else use before
  //         - modifiers → cleared (spacings carry no formatting)
  // ---------------------------------------------------------------------------
  const withMeta: TranscriptionSegment[] = merged.map((seg, i) => {
    if (seg.type === "word") return seg;

    let beforeWord: TranscriptionSegment | undefined;
    let afterWord: TranscriptionSegment | undefined;
    for (let j = i - 1; j >= 0; j--) {
      if (merged[j].type === "word") {
        beforeWord = merged[j];
        break;
      }
    }
    for (let j = i + 1; j < merged.length; j++) {
      if (merged[j].type === "word") {
        afterWord = merged[j];
        break;
      }
    }

    return {
      ...seg,
      start: beforeWord?.end ?? seg.start,
      end: afterWord?.start ?? seg.end,
      // "before" wins when speakers differ
      speakerId:
        beforeWord?.speakerId === afterWord?.speakerId
          ? beforeWord?.speakerId
          : beforeWord?.speakerId,
      modifiers: undefined,
    };
  });

  // ---------------------------------------------------------------------------
  // Step 4: Transform special spacing segments.
  //   a) Duration > 2 s → expand to [spacing(" "), word("(pause)"), spacing(" ")]
  //   b) Speaker change at boundary → replace text with "\n\n"
  //      If text already contains "\n\n" the existing text is preserved so we
  //      don't double-insert line breaks.
  // ---------------------------------------------------------------------------
  const result: TranscriptionSegment[] = [];

  for (let i = 0; i < withMeta.length; i++) {
    const seg = withMeta[i];

    if (seg.type !== "spacing") {
      result.push(seg);
      continue;
    }

    let beforeWord: TranscriptionSegment | undefined;
    let afterWord: TranscriptionSegment | undefined;
    for (let j = i - 1; j >= 0; j--) {
      if (withMeta[j].type === "word") {
        beforeWord = withMeta[j];
        break;
      }
    }
    for (let j = i + 1; j < withMeta.length; j++) {
      if (withMeta[j].type === "word") {
        afterWord = withMeta[j];
        break;
      }
    }

    const speakerChange =
      beforeWord?.speakerId !== undefined &&
      afterWord?.speakerId !== undefined &&
      beforeWord.speakerId !== afterWord.speakerId;

    const duration =
      seg.start !== undefined && seg.end !== undefined
        ? seg.end - seg.start
        : 0;
    const tooLong = duration > 2 && !seg.text.includes("\n");

    if (tooLong && !speakerChange && options?.addPauses) {
      // Expand to spacing + (pause) + spacing
      const mid =
        seg.start !== undefined && seg.end !== undefined
          ? (seg.start + seg.end) / 2
          : undefined;
      result.push({
        type: "spacing",
        text: " ",
        start: seg.start,
        end: mid,
        speakerId: seg.speakerId,
      });
      result.push({
        type: "word",
        text: "(pause)",
        start: seg.start,
        end: seg.end,
        speakerId: seg.speakerId,
      });
      result.push({
        type: "spacing",
        text: " ",
        start: mid,
        end: seg.end,
        speakerId: seg.speakerId,
      });
    } else if (speakerChange) {
      // Use "\n\n" as the separator text (preserve if already present)
      const text = seg.text.includes("\n\n") ? seg.text : "\n\n";
      result.push({ ...seg, text, speakerId: beforeWord?.speakerId });
    } else {
      result.push(seg);
    }
  }

  return result;
}
