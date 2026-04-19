import { TranscriptionContent } from "@/hooks/use-transcriptions";

/**
 * Export transcription as SRT format (SubRip Subtitle)
 * Compatible with video subtitle editors and players
 */
export function exportAsSRT(
  transcription: TranscriptionContent,
  fileName: string,
): void {
  const entries: string[] = [];
  let currentSpeaker: string | undefined;
  let currentWords: string[] = [];
  let startTime: number | undefined;
  let endTime: number | undefined;
  let subtitleIndex = 1;

  // Max characters per subtitle (2 lines of ~42 chars each)
  const MAX_CHARS = 84;
  // Max duration in seconds for a single subtitle
  const MAX_DURATION = 7;

  const addSubtitle = () => {
    if (
      currentWords.length > 0 &&
      startTime !== undefined &&
      endTime !== undefined &&
      currentSpeaker !== undefined
    ) {
      const speakerName = getSpeakerName(transcription, currentSpeaker);
      const text = `${speakerName}: ${currentWords.join(" ").trim()}`;

      entries.push(
        `${subtitleIndex}`,
        `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}`,
        text,
        "",
      );
      subtitleIndex++;
    }
  };

  const shouldBreakSubtitle = (text: string, duration: number): boolean => {
    return text.length > MAX_CHARS || duration > MAX_DURATION;
  };

  transcription.words.forEach((segment, index) => {
    if (segment.type === "word") {
      const speakerId = segment.speakerId;

      // If speaker changed, save the previous subtitle and start a new one
      if (currentSpeaker !== undefined && speakerId !== currentSpeaker) {
        addSubtitle();
        currentWords = [];
        startTime = undefined;
        endTime = undefined;
      }

      // Track timing from word segments only
      if (startTime === undefined && segment.start !== undefined) {
        startTime = segment.start;
      }
      if (segment.end !== undefined) {
        endTime = segment.end;
      }

      // Add the word
      currentSpeaker = speakerId;
      currentWords.push(segment.text);

      // Check if we should break the subtitle due to length or duration
      if (
        startTime !== undefined &&
        endTime !== undefined &&
        currentSpeaker !== undefined
      ) {
        const speakerName = getSpeakerName(transcription, currentSpeaker);
        const currentText = `${speakerName}: ${currentWords.join(" ").trim()}`;
        const duration = endTime - startTime;

        if (shouldBreakSubtitle(currentText, duration)) {
          // Look ahead to find a good breaking point
          let foundBreakPoint = false;

          // Check if the next segment is spacing with a newline or sentence ending
          if (index + 1 < transcription.words.length) {
            const nextSegment = transcription.words[index + 1];
            if (
              nextSegment.type === "spacing" &&
              (nextSegment.text.includes("\n") ||
                nextSegment.text.includes(".") ||
                nextSegment.text.includes("!") ||
                nextSegment.text.includes("?"))
            ) {
              foundBreakPoint = true;
            }
          }

          // If we found a natural break point or exceeded limits significantly, break now
          if (
            foundBreakPoint ||
            currentText.length > MAX_CHARS * 1.5 ||
            duration > MAX_DURATION * 1.5
          ) {
            addSubtitle();
            currentWords = [];
            startTime = undefined;
            endTime = undefined;
          }
        }
      }
    } else if (segment.type === "spacing") {
      // Check for line breaks in spacing - these should trigger a new subtitle
      if (segment.text.includes("\n\n") || segment.text.includes("\n\n\n")) {
        // Double or triple newlines indicate a strong paragraph break
        addSubtitle();
        currentWords = [];
        startTime = undefined;
        endTime = undefined;
      }
      // Don't add spacing text to currentWords - we'll use spaces between words instead
    }
  });

  // Add the last subtitle if there's any text
  addSubtitle();

  const srt = entries.join("\n");
  downloadFile(srt, `${fileName}.srt`, "text/plain");
}

/**
 * Format time in seconds to SRT format (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(milliseconds).padStart(3, "0")}`;
}

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

/**
 * Export transcription as PDF format
 * Similar format to Word/TXT but in PDF
 */
export async function exportAsPDF(
  transcription: TranscriptionContent,
  fileName: string,
): Promise<void> {
  // Dynamic import of jsPDF
  const jsPDF = (await import("jspdf/dist/jspdf.umd.min.js")).jsPDF;
  // Create a new PDF document (A4 size)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Set up document properties
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxLineWidth = pageWidth - 2 * margin;
  let yPosition = margin;

  // Helper to add a new page when needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Process transcription into speaker segments
  let currentSpeaker: string | undefined;
  let currentText: string[] = [];

  const addParagraph = (speakerName: string, text: string) => {
    // Set speaker name in bold
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    const speakerLabel = `${speakerName}: `;
    const speakerWidth = doc.getTextWidth(speakerLabel);

    // Check if we need a new page
    checkPageBreak(15);

    // Add speaker label
    doc.text(speakerLabel, margin, yPosition);

    // Set normal font for content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    // Split text into lines that fit the page width
    // Account for the speaker label on the first line
    const firstLineWidth = maxLineWidth - speakerWidth;
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";
    let isFirstLine = true;

    words.forEach((word) => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const lineWidth = isFirstLine ? firstLineWidth : maxLineWidth;
      const testWidth = doc.getTextWidth(testLine);

      if (testWidth > lineWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
        isFirstLine = false;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) {
      lines.push(currentLine);
    }

    // Add first line next to speaker name
    if (lines.length > 0) {
      doc.text(lines[0], margin + speakerWidth, yPosition);
      yPosition += 5;

      // Add remaining lines
      for (let i = 1; i < lines.length; i++) {
        checkPageBreak(5);
        doc.text(lines[i], margin, yPosition);
        yPosition += 5;
      }
    }

    // Add spacing between paragraphs
    yPosition += 3;
  };

  // Process all segments
  transcription.words.forEach((segment) => {
    if (segment.type === "word") {
      const speakerId = segment.speakerId;

      // If speaker changed, save the previous paragraph and start a new one
      if (currentSpeaker !== undefined && speakerId !== currentSpeaker) {
        const speakerName = getSpeakerName(transcription, currentSpeaker);
        const text = currentText.join("").trim();
        if (text) {
          addParagraph(speakerName, text);
        }
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
    const text = currentText.join("").trim();
    if (text) {
      addParagraph(speakerName, text);
    }
  }

  // Save the PDF
  doc.save(`${fileName}.pdf`);
}
