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

/**
 * The three spaces of the work, including the one that does not exist yet.
 *
 * `analysis` is not a document phase: there is no analysis pass over a single
 * interview, and nothing ships for it. It is here because the COLOUR belongs to
 * the same scale, and a scale defined in two halves drifts.
 */
export type WorkspaceArea = DocumentPhase | "analysis";

/**
 * One colour per space, so a researcher can tell at a glance what the app is
 * currently for: blue writes the transcript, yellow reads it, green will compare
 * it.
 *
 * Defined here rather than at each use because there are already two of them (the
 * sidebar's phase headers, the header's rule) and the whole point is that they
 * agree. The values are literal Tailwind classes rather than theme tokens: these
 * are a fixed semantic scale, not a palette that follows the theme.
 */
export const WORKSPACE_ACCENT: Record<
  WorkspaceArea,
  { rule: string; wash: string }
> = {
  transcription: { rule: "bg-blue-500", wash: "bg-blue-500/10" },
  coding: { rule: "bg-yellow-400", wash: "bg-yellow-400/15" },
  analysis: { rule: "bg-emerald-500", wash: "bg-emerald-500/10" },
};
