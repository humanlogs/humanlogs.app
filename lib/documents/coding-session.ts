/**
 * Whether a coding pass is under way.
 *
 * Opening an interview to code it asks a question first — through which grille? —
 * and that question is asked ONCE, at the start of the pass, not at every
 * document. A researcher working through eleven interviews with the same
 * codebook should not be asked eleven times; a researcher arriving from the
 * study page, from a link, or from a fresh reload has not chosen anything yet and
 * should be.
 *
 * So the flag is not "am I on a coding route" — the route already says that. It
 * is "have I started a pass", set when the coding editor actually opens on a
 * document and cleared the moment the app leaves the coding space
 * (`useDeclareWorkspaceArea`). Module state, deliberately: it must survive
 * navigation between documents within the session and must NOT survive a reload,
 * which is exactly the lifetime of a module.
 *
 * The study's coding workshop declares the coding space but never starts a pass,
 * because no grille is chosen there — arriving at a document from it still asks.
 *
 * A pass is over a CORPUS, so it remembers which study it is a pass over. The
 * grilles available, the one chosen, and whether there is one at all are all per
 * study: carrying a pass across studies meant that opening an interview in a
 * study with no verbatim codebook skipped the question and landed on a coding bar
 * that could only say "no codebook covers this study yet" — a dead end, in the
 * one place that exists to offer making one.
 */

/** The study the pass is over, or null when no pass is under way. */
let activeStudy: string | null = null;

/** A document filed in no study still has a scope; it is just the empty one. */
function key(projectId: string | null | undefined): string {
  return projectId ?? "none";
}

/** The listeners are the screens deciding what to render. */
const listeners = new Set<() => void>();

/**
 * Whether a pass is under way OVER THIS STUDY.
 *
 * Asking without a study answers about any pass at all, which is what the
 * `endCodingSession` side needs and nothing else should use.
 */
export function isCodingSessionActive(
  projectId?: string | null | undefined,
): boolean {
  if (activeStudy === null) return false;
  return projectId === undefined ? true : activeStudy === key(projectId);
}

export function startCodingSession(projectId?: string | null): void {
  const next = key(projectId);
  if (activeStudy === next) return;
  activeStudy = next;
  for (const listener of listeners) listener();
}

export function endCodingSession(): void {
  if (activeStudy === null) return;
  activeStudy = null;
  for (const listener of listeners) listener();
}

export function subscribeCodingSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The server has no session: it always renders the question. */
export function codingSessionServerSnapshot(): boolean {
  return false;
}
