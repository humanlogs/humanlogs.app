import {
  isDocumentPhase,
  type WorkspaceArea,
} from "@/components/transcriptions/editor/phase";

/**
 * Which space of the app a route is in.
 *
 * The route decides WHETHER there is a space at all, and the phase decides which
 * one. Null where the question does not apply: the home page, the account, a
 * study's own page. Those are not a pass over material, and colouring them would
 * make the scale mean nothing.
 *
 * The phase is passed in rather than read from the query string here, because the
 * one caller lives in the layout that wraps every route and `useSearchParams`
 * there would demand a Suspense boundary around all of them.
 */
export function workspaceAreaOf(
  pathname: string | null | undefined,
  phase: string | null | undefined,
): WorkspaceArea | null {
  if (!pathname) return null;
  // The study's coding workshop is a coding space even though no document is open.
  if (/^\/app\/project\/[^/]+\/coding/.test(pathname)) return "coding";
  if (!pathname.startsWith("/app/transcription/")) return null;
  return isDocumentPhase(phase) ? phase : "transcription";
}
