/**
 * Which grille a study is being coded through, remembered per study.
 *
 * Shared by the two halves of the choice: the screen that asks it at the start of
 * a pass, and the controller that reads it when the editor opens. They are in
 * different components — the screen stands IN FRONT of the editor, so the editor
 * does not exist when the choice is made — and a storage key spelled in two
 * places is a bug waiting for a rename.
 *
 * Per study rather than per document, because a pass is over a corpus: eleven
 * interviews read through the same grille is the normal case, and being asked
 * again on each of them is the thing this avoids.
 */

export function codingCodebookKey(projectId?: string | null): string {
  return `hl-coding-codebook:${projectId ?? "none"}`;
}

export function readCodingCodebook(projectId?: string | null): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(codingCodebookKey(projectId));
  } catch {
    // Private mode, or storage disabled: the choice simply does not persist.
    return null;
  }
}

export function writeCodingCodebook(
  projectId: string | null | undefined,
  codebookId: string,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(codingCodebookKey(projectId), codebookId);
  } catch {
    // As above: the pass still works, it just starts from the first grille next
    // time. Not worth telling anyone about.
  }
}
