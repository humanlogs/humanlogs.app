import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Transaction } from "@tiptap/pm/state";
import {
  AddMarkStep,
  RemoveMarkStep,
  ReplaceAroundStep,
  ReplaceStep,
} from "@tiptap/pm/transform";
import _ from "lodash";
import { normalizeEditorSegments } from "../hooks/use-normalize-editor-segments";

/**
 * Types of transactions:
 * - AddMarkStep | RemoveMarkStep
 *    -> we'll apply to the whole word
 * - ReplaceStep
 *    -> classic case we remove all words in the from-to, and replace by the new sentence + generate coherent start/end times
 *    -> in some cases we remove double \n\n in the process and we must replace all speaker to match the left part
 *    -> in some cases we'll receive create of new paragraphs, it should match internally with \n\n (each </p><p> separation is a \n\n internally)
 * - ReplaceAroundStep
 *    -> used to change paragraph speakerId, we must update the speakerId of all segments concerned by the change
 */

const modifiersMap: Record<string, "b" | "i" | "u" | "s"> = {
  bold: "b",
  italic: "i",
  underline: "u",
  strike: "s",
};

export const applyTransactionOnSegments = (
  segments: TranscriptionSegment[],
  transaction: Transaction,
): TranscriptionSegment[] => {
  let result = _.cloneDeep(segments);

  // Apply each step in the transaction sequentially
  for (const step of transaction.steps) {
    if (step instanceof ReplaceStep) {
      result = applyReplaceStep(result, step);
    } else if (step instanceof ReplaceAroundStep) {
      result = applyReplaceAroundStep(result, step);
    } else if (step instanceof AddMarkStep) {
      result = applyAddMarkStep(result, step);
    } else if (step instanceof RemoveMarkStep) {
      result = applyRemoveMarkStep(result, step);
    }
  }

  result = normalizeEditorSegments(result);

  return result;
};

const applyReplaceStep = (
  segments: TranscriptionSegment[],
  step: ReplaceStep,
): TranscriptionSegment[] => {
  if (!segments.length) {
    return segments;
  }

  // Careful tiptap from/to are 1 offset
  const from = step.from - 1;
  const to = step.to - 1;
  const totalLength = segments.reduce((sum, seg) => sum + seg.text.length, 0);
  const safeFrom = Math.max(0, Math.min(from, totalLength));
  const safeTo = Math.max(safeFrom, Math.min(to, totalLength));

  let charIndex = 0;
  let segmentStartIndex = 0;
  while (
    segmentStartIndex < segments.length &&
    charIndex + segments[segmentStartIndex].text.length < safeFrom
  ) {
    charIndex += segments[segmentStartIndex].text.length;
    segmentStartIndex++;
  }
  segmentStartIndex = Math.min(
    Math.max(0, segmentStartIndex),
    segments.length - 1,
  );
  const segmentStartCharIndex = charIndex;

  let segmentEndIndex = segmentStartIndex;
  while (
    segmentEndIndex < segments.length - 1 &&
    charIndex + segments[segmentEndIndex].text.length < safeTo
  ) {
    charIndex += segments[segmentEndIndex].text.length;
    segmentEndIndex++;
  }
  const segmentEndCharIndex = charIndex;

  let inside = "";
  step.slice.content.forEach((node, i) => {
    if (node.type.name === "paragraph" && i > 0) {
      inside += "\n\n";
    }
    inside += node.textContent;
    return true;
  });

  const replacement =
    segments[segmentStartIndex].text.slice(
      0,
      safeFrom - segmentStartCharIndex,
    ) +
    inside +
    segments[segmentEndIndex].text.slice(
      Math.max(0, safeTo - segmentEndCharIndex),
    );

  const multipleSpeakersInvolved =
    new Set(
      segments
        .slice(segmentStartIndex, segmentEndIndex + 1)
        .map((s) => s.speakerId),
    ).size > 1;

  const startSegment = segments[segmentStartIndex];
  const endSegment = segments[segmentEndIndex];

  if (replacement.length === 0) {
    segments.splice(segmentStartIndex, segmentEndIndex - segmentStartIndex + 1);
  } else {
    segments.splice(
      segmentStartIndex,
      segmentEndIndex - segmentStartIndex + 1,
      {
        type: "word",
        text: replacement,
        start: startSegment?.start ?? 0,
        end: endSegment?.end ?? startSegment?.end ?? 0,
        speakerId:
          startSegment?.speakerId ?? endSegment?.speakerId ?? "unknown",
      },
    );
  }

  // If we had multiple speaker ids in the replaced segments, we should update all the following segments to have the same speakerId as the first one, to avoid having incoherent speakerId in the middle of a sentence
  if (multipleSpeakersInvolved && segments[segmentStartIndex]) {
    // We start at the added segment (it's a single segment with all the text right now)
    // Then continue up to the next speaker change
    for (let i = segmentStartIndex + 1; i < segments.length; i++) {
      const originalSpeaker = segments[i].speakerId;
      segments[i].speakerId = segments[segmentStartIndex].speakerId;

      // Up to the next speaker change
      if (!segments[i + 1] || segments[i + 1].speakerId !== originalSpeaker) {
        break;
      }
    }
  }

  return segments; // Placeholder, the actual implementation of this function would be quite complex and is not provided here.
};

const applyReplaceAroundStep = (
  segments: TranscriptionSegment[],
  step: ReplaceAroundStep,
): TranscriptionSegment[] => {
  if (!segments.length) {
    return segments;
  }

  // ReplaceAroundStep is used to wrap/unwrap content or change node attributes
  // In our case, it's primarily used to change paragraph speakerId attributes

  // Adjust positions (tiptap uses 1-based offset)
  const gapFrom = step.gapFrom - 1;
  const gapTo = step.gapTo - 1;

  // Extract the new speakerId from the slice if it's a paragraph change
  let newSpeakerId: string | undefined;
  step.slice.content.forEach((node) => {
    if (node.type.name === "paragraph" && node.attrs.speakerId) {
      newSpeakerId = node.attrs.speakerId;
    }
    return true;
  });

  // If no speaker ID change detected, return unchanged
  if (!newSpeakerId) {
    return segments;
  }

  // Find the segments that fall within the gap (the content that's being wrapped/affected)
  let charIndex = 0;
  let segmentStartIndex = 0;

  // Find the first segment that intersects with gapFrom
  while (charIndex < gapFrom && segmentStartIndex < segments.length) {
    charIndex += segments[segmentStartIndex].text.length;
    segmentStartIndex++;
  }
  segmentStartIndex = Math.max(0, segmentStartIndex - 1);

  // Find the last segment that intersects with gapTo
  let segmentEndIndex = segmentStartIndex;
  charIndex = segments
    .slice(0, segmentStartIndex)
    .reduce((sum, seg) => sum + seg.text.length, 0);

  while (charIndex < gapTo && segmentEndIndex < segments.length) {
    charIndex += segments[segmentEndIndex].text.length;
    segmentEndIndex++;
  }
  segmentEndIndex = Math.min(segments.length - 1, segmentEndIndex);

  // Update speakerId for all segments in the affected range
  for (let i = segmentStartIndex; i <= segmentEndIndex; i++) {
    segments[i] = {
      ...segments[i],
      speakerId: newSpeakerId,
    };
  }

  return segments;
};

const applyAddMarkStep = (
  segments: TranscriptionSegment[],
  step: AddMarkStep,
): TranscriptionSegment[] => {
  // Get the modifier type from the mark
  const markType = step.mark.type.name;
  const modifier = modifiersMap[markType];

  if (!modifier) {
    // Unknown mark type, skip
    return segments;
  }

  // Adjust positions (tiptap uses 1-based offset)
  const from = step.from - 1;
  const to = step.to - 1;

  // Find all segments that are affected by this mark
  let charIndex = 0;
  let segmentIndex = 0;

  // Find segments within the from-to range
  while (segmentIndex < segments.length) {
    const segmentStart = charIndex;
    const segmentEnd = charIndex + segments[segmentIndex].text.length;

    // Check if this segment overlaps with the marked range
    if (segmentStart < to && segmentEnd > from) {
      // Add the modifier to this segment (apply to the whole word)
      const currentModifiers = segments[segmentIndex].modifiers || [];
      if (!currentModifiers.includes(modifier)) {
        segments[segmentIndex] = {
          ...segments[segmentIndex],
          modifiers: [...currentModifiers, modifier],
        };
      }
    }

    charIndex = segmentEnd;
    segmentIndex++;

    // Stop if we're past the marked range
    if (charIndex >= to) {
      break;
    }
  }

  return segments;
};

const applyRemoveMarkStep = (
  segments: TranscriptionSegment[],
  step: RemoveMarkStep,
): TranscriptionSegment[] => {
  // Get the modifier type from the mark
  const markType = step.mark.type.name;
  const modifier = modifiersMap[markType];

  if (!modifier) {
    // Unknown mark type, skip
    return segments;
  }

  // Adjust positions (tiptap uses 1-based offset)
  const from = step.from - 1;
  const to = step.to - 1;

  // Find all segments that are affected by this mark removal
  let charIndex = 0;
  let segmentIndex = 0;

  // Find segments within the from-to range
  while (segmentIndex < segments.length) {
    const segmentStart = charIndex;
    const segmentEnd = charIndex + segments[segmentIndex].text.length;

    // Check if this segment overlaps with the unmarked range
    if (segmentStart < to && segmentEnd > from) {
      // Remove the modifier from this segment (apply to the whole word)
      const currentModifiers = segments[segmentIndex].modifiers || [];
      if (currentModifiers.includes(modifier)) {
        segments[segmentIndex] = {
          ...segments[segmentIndex],
          modifiers: currentModifiers.filter((m) => m !== modifier),
        };
      }
    }

    charIndex = segmentEnd;
    segmentIndex++;

    // Stop if we're past the unmarked range
    if (charIndex >= to) {
      break;
    }
  }

  return segments;
};
