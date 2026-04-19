/**
 * Parse SRT subtitle file and convert to WebVTT format
 * Also validates the SRT structure
 */

export interface SRTCue {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface SRTValidationError {
  line: number;
  type: "timing" | "format" | "overlap" | "order";
  message: string;
}

/**
 * Parse SRT file content into structured cues
 */
export function parseSRT(srtContent: string): SRTCue[] {
  const cues: SRTCue[] = [];
  const blocks = srtContent.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const timingLine = lines[1];
    const text = lines.slice(2).join("\n");

    // Parse timing: 00:00:00,000 --> 00:00:05,000
    const timingMatch = timingLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/,
    );

    if (timingMatch) {
      const startTime = timingMatch[1];
      const endTime = timingMatch[2];

      cues.push({
        index,
        startTime,
        endTime,
        text,
        startMs: srtTimeToMs(startTime),
        endMs: srtTimeToMs(endTime),
      });
    }
  }

  return cues;
}

/**
 * Convert SRT time format (00:00:00,000) to milliseconds
 */
function srtTimeToMs(time: string): number {
  const parts = time.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsParts = parts[2].split(",");
  const seconds = parseInt(secondsParts[0], 10);
  const milliseconds = parseInt(secondsParts[1], 10);

  return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
}

/**
 * Convert SRT time to WebVTT format
 */
function srtTimeToWebVTT(time: string): string {
  return time.replace(",", ".");
}

/**
 * Convert SRT content to WebVTT format (browser-compatible)
 */
export function srtToWebVTT(srtContent: string): string {
  const cues = parseSRT(srtContent);

  let webvtt = "WEBVTT\n\n";

  for (const cue of cues) {
    webvtt += `${cue.index}\n`;
    webvtt += `${srtTimeToWebVTT(cue.startTime)} --> ${srtTimeToWebVTT(cue.endTime)}\n`;
    webvtt += `${cue.text}\n\n`;
  }

  return webvtt;
}

/**
 * Validate SRT file and return errors
 */
export function validateSRT(srtContent: string): SRTValidationError[] {
  const errors: SRTValidationError[] = [];
  const cues = parseSRT(srtContent);

  // Check for timing issues
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];

    // Check if end time is after start time
    if (cue.endMs <= cue.startMs) {
      errors.push({
        line: cue.index,
        type: "timing",
        message: `Subtitle ${cue.index}: End time (${cue.endTime}) must be after start time (${cue.startTime})`,
      });
    }

    // Check for overlaps with next subtitle
    if (i < cues.length - 1) {
      const nextCue = cues[i + 1];

      if (cue.endMs > nextCue.startMs) {
        errors.push({
          line: cue.index,
          type: "overlap",
          message: `Subtitle ${cue.index} overlaps with subtitle ${nextCue.index}`,
        });
      }

      // Check chronological order
      if (nextCue.startMs < cue.startMs) {
        errors.push({
          line: cue.index,
          type: "order",
          message: `Subtitle ${nextCue.index} starts before subtitle ${cue.index}`,
        });
      }
    }

    // Check for very short display times (< 200ms)
    const duration = cue.endMs - cue.startMs;
    if (duration < 200) {
      errors.push({
        line: cue.index,
        type: "timing",
        message: `Subtitle ${cue.index}: Display time is very short (${duration}ms). Consider extending it.`,
      });
    }
  }

  return errors;
}

/**
 * Create a WebVTT blob URL from SRT content
 */
export function createWebVTTBlobUrl(srtContent: string): string {
  const webvtt = srtToWebVTT(srtContent);
  const blob = new Blob([webvtt], { type: "text/vtt" });
  return URL.createObjectURL(blob);
}
