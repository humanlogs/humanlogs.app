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
 */

let active = false;

/** The listeners are the screens deciding what to render. */
const listeners = new Set<() => void>();

export function isCodingSessionActive(): boolean {
  return active;
}

export function startCodingSession(): void {
  if (active) return;
  active = true;
  for (const listener of listeners) listener();
}

export function endCodingSession(): void {
  if (!active) return;
  active = false;
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
