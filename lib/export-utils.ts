import { TranscriptionContent } from "@/hooks/use-transcriptions";

/**
 * Export transcription as CSV format
 * One line per speaker change, subtitle-like format
 */
export function exportAsCSV(
  transcription: TranscriptionContent,
  fileName: string,
): void {
  const lines: string[] = [];
  let currentSpeaker: string | undefined;
  let currentText: string[] = [];

  transcription.words.forEach((segment) => {
    if (segment.type === "word") {
      const speakerId = segment.speakerId;

      // If speaker changed, save the previous line and start a new one
      if (currentSpeaker !== undefined && speakerId !== currentSpeaker) {
        const speakerName = getSpeakerName(transcription, currentSpeaker);
        lines.push(`"${speakerName}","${currentText.join("").trim()}"`);
        currentText = [];
      }

      currentSpeaker = speakerId;
      currentText.push(segment.text);
    } else if (segment.type === "spacing") {
      currentText.push(segment.text);
    }
  });

  // Add the last line if there's any text
  if (currentText.length > 0 && currentSpeaker !== undefined) {
    const speakerName = getSpeakerName(transcription, currentSpeaker);
    lines.push(`"${speakerName}","${currentText.join("").trim()}"`);
  }

  // Add CSV header
  const csv = ["Speaker,Text", ...lines].join("\n");

  // Download file
  downloadFile(csv, `${fileName}.csv`, "text/csv");
}

/**
 * Export transcription as JSON format
 * Full transcription + speaker original object
 */
export function exportAsJSON(
  transcription: TranscriptionContent,
  fileName: string,
): void {
  const json = JSON.stringify(transcription, null, 2);
  downloadFile(json, `${fileName}.json`, "application/json");
}

/**
 * Export transcription as TXT format
 * Speaker Name: Text x y z\n\n
 */
export function exportAsTXT(
  transcription: TranscriptionContent,
  fileName: string,
): void {
  const lines: string[] = [];
  let currentSpeaker: string | undefined;
  let currentText: string[] = [];

  transcription.words.forEach((segment) => {
    if (segment.type === "word") {
      const speakerId = segment.speakerId;

      // If speaker changed, save the previous line and start a new one
      if (currentSpeaker !== undefined && speakerId !== currentSpeaker) {
        const speakerName = getSpeakerName(transcription, currentSpeaker);
        lines.push(`${speakerName}: ${currentText.join("").trim()}\n`);
        currentText = [];
      }

      currentSpeaker = speakerId;
      currentText.push(segment.text);
    } else if (segment.type === "spacing") {
      currentText.push(segment.text);
    }
  });

  // Add the last line if there's any text
  if (currentText.length > 0 && currentSpeaker !== undefined) {
    const speakerName = getSpeakerName(transcription, currentSpeaker);
    lines.push(`${speakerName}: ${currentText.join("").trim()}\n`);
  }

  const txt = lines.join("\n");
  downloadFile(txt, `${fileName}.txt`, "text/plain");
}

export type ExportOptions = {
  speakerIds?: string[];
  toLowerCase?: boolean;
  removeAccents?: boolean;
  removePunctuation?: boolean;
  showSpeakerNames?: boolean;
  keepLineBreaks?: boolean;
};

/**
 * Export transcription as TXT format with filtering options
 * Speaker Name: Text x y z\n\n
 */
export function exportAsTXTWithOptions(
  transcription: TranscriptionContent,
  fileName: string,
  options: ExportOptions = {},
): void {
  const {
    speakerIds,
    toLowerCase = false,
    removeAccents = false,
    removePunctuation = false,
    showSpeakerNames = true,
    keepLineBreaks = true,
  } = options;

  // Check if only one speaker is selected
  const isSingleSpeaker = speakerIds && speakerIds.length === 1;

  // When removing linebreaks or single speaker, accumulate all text
  if (!keepLineBreaks || isSingleSpeaker) {
    const allText: string[] = [];

    transcription.words.forEach((segment) => {
      if (segment.type === "word") {
        const speakerId = segment.speakerId;

        // Skip if this speaker is not in the selected list
        if (speakerIds && speakerId && !speakerIds.includes(speakerId)) {
          return;
        }

        allText.push(segment.text);
      } else if (segment.type === "spacing") {
        allText.push(segment.text);
      }
    });

    const processedText = processText(
      allText.join("").trim(),
      toLowerCase,
      removeAccents,
      removePunctuation,
    );

    downloadFile(processedText, `${fileName}.txt`, "text/plain");
    return;
  }

  // Keep linebreaks - create lines for each speaker change
  const lines: string[] = [];
  let currentSpeaker: string | undefined;
  let currentText: string[] = [];

  transcription.words.forEach((segment) => {
    if (segment.type === "word") {
      const speakerId = segment.speakerId;

      // Skip if this speaker is not in the selected list
      if (speakerIds && speakerId && !speakerIds.includes(speakerId)) {
        // If we were building text for a previous speaker, save it first
        if (currentSpeaker !== undefined && currentText.length > 0) {
          const speakerName = getSpeakerName(transcription, currentSpeaker);
          const processedText = processText(
            currentText.join("").trim(),
            toLowerCase,
            removeAccents,
            removePunctuation,
          );

          if (showSpeakerNames) {
            lines.push(`${speakerName}: ${processedText}`);
          } else {
            lines.push(processedText);
          }
          currentText = [];
        }
        currentSpeaker = undefined;
        return;
      }

      // If speaker changed, save the previous line and start a new one
      if (currentSpeaker !== undefined && speakerId !== currentSpeaker) {
        const speakerName = getSpeakerName(transcription, currentSpeaker);
        const processedText = processText(
          currentText.join("").trim(),
          toLowerCase,
          removeAccents,
          removePunctuation,
        );

        if (showSpeakerNames) {
          lines.push(`${speakerName}: ${processedText}`);
        } else {
          lines.push(processedText);
        }
        currentText = [];
      }

      currentSpeaker = speakerId;
      currentText.push(segment.text);
    } else if (segment.type === "spacing") {
      // Only add spacing if we're currently building text for a selected speaker
      if (currentSpeaker !== undefined) {
        currentText.push(segment.text);
      }
    }
  });

  // Add the last line if there's any text
  if (currentText.length > 0 && currentSpeaker !== undefined) {
    const speakerName = getSpeakerName(transcription, currentSpeaker);
    const processedText = processText(
      currentText.join("").trim(),
      toLowerCase,
      removeAccents,
      removePunctuation,
    );

    if (showSpeakerNames) {
      lines.push(`${speakerName}: ${processedText}`);
    } else {
      lines.push(processedText);
    }
  }

  const txt = lines.join("\n\n");
  downloadFile(txt, `${fileName}.txt`, "text/plain");
}

/**
 * Apply text transformations based on options
 */
function processText(
  text: string,
  toLowerCase: boolean,
  removeAccents: boolean,
  removePunctuation: boolean,
): string {
  let result = text;

  if (toLowerCase) {
    result = result.toLowerCase();
  }

  if (removeAccents) {
    result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  if (removePunctuation) {
    // Remove common punctuation marks but keep spaces
    result = result.replace(/[.,;:!?'"()[\]{}\-–—]/g, "");
  }

  return result;
}

/**
 * Export transcription as Word format
 * Same format as TXT but in .docx format
 */
export async function exportAsWord(
  transcription: TranscriptionContent,
  fileName: string,
): Promise<void> {
  // We'll use the docx library to create a proper Word document
  const { Document, Packer, Paragraph, TextRun } = await import("docx");

  const paragraphs: InstanceType<typeof Paragraph>[] = [];
  let currentSpeaker: string | undefined;
  let currentText: string[] = [];

  transcription.words.forEach((segment) => {
    if (segment.type === "word") {
      const speakerId = segment.speakerId;

      // If speaker changed, save the previous paragraph and start a new one
      if (currentSpeaker !== undefined && speakerId !== currentSpeaker) {
        const speakerName = getSpeakerName(transcription, currentSpeaker);
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${speakerName}: `,
                bold: true,
              }),
              new TextRun({
                text: currentText.join("").trim(),
              }),
            ],
            spacing: {
              after: 200,
            },
          }),
        );
        currentText = [];
      }

      currentSpeaker = speakerId;
      currentText.push(segment.text);
    } else if (segment.type === "spacing") {
      currentText.push(segment.text);
    }
  });

  // Add the last paragraph if there's any text
  if (currentText.length > 0 && currentSpeaker !== undefined) {
    const speakerName = getSpeakerName(transcription, currentSpeaker);
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${speakerName}: `,
            bold: true,
          }),
          new TextRun({
            text: currentText.join("").trim(),
          }),
        ],
        spacing: {
          after: 200,
        },
      }),
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${fileName}.docx`);
}

/**
 * Helper function to get speaker name from speaker ID
 */
function getSpeakerName(
  transcription: TranscriptionContent,
  speakerId: string,
): string {
  const speaker = transcription.speakers.find((s) => s.id === speakerId);
  return speaker?.name || `Speaker ${speakerId}`;
}

/**
 * Helper function to trigger file download
 */
function downloadFile(
  content: string,
  fileName: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, fileName);
}

/**
 * Helper function to download a blob
 */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
