import { TranscriptionSegment } from "@/hooks/use-transcriptions";
import { Transaction } from "@tiptap/pm/state";
import { ReplaceAroundStep, ReplaceStep } from "@tiptap/pm/transform";
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
    }
    // ReplaceAroundStep is not currently handled as it's not used in the codebase
  }

  result = normalizeEditorSegments(result);

  return result;
};

const applyReplaceStep = (
  segments: TranscriptionSegment[],
  step: ReplaceStep,
): TranscriptionSegment[] => {
  // Careful tiptap from/to are 1 offset
  const from = step.from - 1;
  const to = step.to - 1;

  let charIndex = 0;
  let segmentStartIndex = 0;
  while (charIndex < from) {
    charIndex += segments[segmentStartIndex].text.length;
    segmentStartIndex++;
  }
  segmentStartIndex = Math.max(0, segmentStartIndex - 1);
  let segmentStartCharIndex =
    charIndex - segments[segmentStartIndex].text.length; // Start index of the current segment

  let segmentEndIndex = segmentStartIndex;
  while (charIndex <= to) {
    segmentEndIndex++;
    charIndex += segments[segmentEndIndex].text.length;
  }
  let segmentEndCharIndex = charIndex; // Start index of the current segment

  if (
    segments[segmentStartIndex].text.length ===
    from - segmentStartCharIndex
  ) {
    segmentStartCharIndex = from;
    segmentStartIndex++;
  }

  let inside = "";
  step.slice.content.forEach((node, i) => {
    if (node.type.name === "paragraph" && i > 0) {
      inside += "\n\n";
    }
    inside += node.textContent;
    return true;
  });

  const replacement =
    segments[segmentStartIndex].text.slice(0, from - segmentStartCharIndex) +
      inside +
      segments[segmentEndIndex].text.slice(to - segmentEndCharIndex) || "";

  const multipleSpeakersInvolved =
    new Set(
      segments
        .slice(segmentStartIndex, segmentEndIndex + 1)
        .map((s) => s.speakerId),
    ).size > 1;

  segments.splice(segmentStartIndex, segmentEndIndex - segmentStartIndex + 1, {
    type: "word",
    text: replacement,
    start: segments[segmentStartIndex].start, // This is a simplification, ideally we should calculate the new start/end based on the replaced text length and the original segments
    end: segments[segmentEndIndex].end,
    speakerId: segments[segmentStartIndex].speakerId, // This is a simplification, ideally we should determine the speakerId based on the replaced segments
  });

  // If we had multiple speaker ids in the replaced segments, we should update all the following segments to have the same speakerId as the first one, to avoid having incoherent speakerId in the middle of a sentence
  if (multipleSpeakersInvolved) {
    // We start at the added segment (it's a single segment with all the text right now)
    // Then continue up to the next speaker change
    for (let i = segmentStartIndex + 1; i < segments.length; i++) {
      const originalSpeaker = segments[i].speakerId;
      segments[i].speakerId = segments[segmentStartIndex].speakerId;

      // Up to the next speaker change
      if (segments[i + 1].speakerId !== originalSpeaker) {
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
  console.log(step);

  return segments; // Placeholder, the actual implementation of this function would be quite complex and is not provided here.
};
