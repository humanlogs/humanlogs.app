/**
 * The pass a researcher is making over a document.
 *
 * Qualitative work goes through phases, and the two the app supports want opposite
 * things from the same screen: transcription is writing (the text is wrong until you
 * fix it), coding is reading (the text is settled and what changes is what you say
 * about it). Rather than pile both sets of controls onto one toolbar, the phase
 * switches the editor between them — read-only in `coding`, so no keystroke can slip
 * an edit into a transcript being interpreted, and so the letters are free to be code
 * shortcuts.
 *
 * It lives in the URL (`?phase=coding`), not in the database: it is where *you* are in
 * the work, not a property of the document — two people can legitimately be in
 * different phases of the same interview at the same time.
 */
export const DOCUMENT_PHASES = ["transcription", "coding"] as const;

export type DocumentPhase = (typeof DOCUMENT_PHASES)[number];

export const DEFAULT_DOCUMENT_PHASE: DocumentPhase = "transcription";

export function isDocumentPhase(value: unknown): value is DocumentPhase {
  return (
    typeof value === "string" &&
    (DOCUMENT_PHASES as readonly string[]).includes(value)
  );
}

export function parseDocumentPhase(value: unknown): DocumentPhase {
  return isDocumentPhase(value) ? value : DEFAULT_DOCUMENT_PHASE;
}
