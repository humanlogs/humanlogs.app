/**
 * Shared types for importing an already-produced transcript from a document.
 *
 * Every parser reduces its input to a flat list of {@link ImportTurn}s (a speaker
 * turn = one contiguous block of text by one speaker, with optional real
 * timing). `buildTranscriptionContent` then turns those turns into the editor's
 * `TranscriptionContent` shape, assigning per-word start/end timestamps.
 */

export type ImportTurn = {
  /** Display name / label of the speaker for this turn, if the source has one. */
  speaker?: string;
  /** Explicit speaker id, when the source already uses stable ids (e.g. our JSON). */
  speakerId?: string;
  /** The spoken text of the turn. */
  text: string;
  /** Real start time in seconds, when the source carries genuine timestamps. */
  start?: number;
  /** Real end time in seconds, when the source carries genuine timestamps. */
  end?: number;
};

export type ImportFormat =
  | "json"
  | "csv"
  | "txt"
  | "docx"
  | "srt"
  | "vtt"
  | "nvivo"
  | "maxqda";

/** Extensions we accept in the import file picker. */
export const IMPORT_EXTENSIONS = [
  ".json",
  ".csv",
  ".txt",
  ".docx",
  ".srt",
  ".vtt",
] as const;

/** Formats a user can pick explicitly. `auto` infers from extension/content. */
export const IMPORT_FORMAT_OPTIONS: Array<{ value: ImportFormat | "auto"; label: string }> = [
  { value: "auto", label: "Auto-detect" },
  { value: "json", label: "JSON transcript" },
  { value: "csv", label: "CSV (speaker, text)" },
  { value: "txt", label: "Plain text (.txt)" },
  { value: "docx", label: "Word document (.docx)" },
  { value: "srt", label: "SRT subtitles" },
  { value: "vtt", label: "WebVTT subtitles" },
  { value: "nvivo", label: "NVivo transcript" },
  { value: "maxqda", label: "MAXQDA transcript" },
];
