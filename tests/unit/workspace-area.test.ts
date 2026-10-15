import { describe, expect, it } from "vitest";
import { workspaceAreaOf } from "@/lib/documents/workspace-area";
import {
  codingSessionServerSnapshot,
  endCodingSession,
  isCodingSessionActive,
  startCodingSession,
  subscribeCodingSession,
} from "@/lib/documents/coding-session";

/**
 * Two small pure modules that decide a surprising amount: which sidebar section
 * is open, what colour the header's rule is, whether the excerpt panel shows at
 * all, and whether opening an interview asks which grille to code through.
 *
 * Both have already broken once in use — "cannot leave the coding phase", then
 * "cannot reach analysis from a document" — and in both cases the symptom was a
 * screen disagreeing with the sidebar rather than anything throwing. That is the
 * failure mode these guard.
 */

describe("workspaceAreaOf", () => {
  describe("a document", () => {
    it("is the phase its URL names", () => {
      expect(workspaceAreaOf("/app/transcription/abc", "coding")).toBe(
        "coding",
      );
      expect(workspaceAreaOf("/app/transcription/abc", "transcription")).toBe(
        "transcription",
      );
    });

    it("falls back to writing when the phase is missing or nonsense", () => {
      // A link from a colleague, a hand-edited URL, a preference written by an
      // older build: none of them should leave the app in no space at all.
      expect(workspaceAreaOf("/app/transcription/abc", null)).toBe(
        "transcription",
      );
      expect(workspaceAreaOf("/app/transcription/abc", "elsewhere")).toBe(
        "transcription",
      );
    });

    it("is never analysis, which is not a pass over one interview", () => {
      expect(workspaceAreaOf("/app/transcription/abc", "analysis")).toBe(
        "transcription",
      );
    });
  });

  describe("a study's three rooms", () => {
    it("reads each from its route, whatever the stored phase says", () => {
      // The phase is a preference and the route is a fact. When they disagree —
      // which they do for a moment on every navigation — the route wins, or the
      // sidebar ends up labelling a screen it is not showing.
      expect(workspaceAreaOf("/app/project/s1/coding", "transcription")).toBe(
        "coding",
      );
      expect(workspaceAreaOf("/app/project/s1/analysis", "coding")).toBe(
        "analysis",
      );
      expect(workspaceAreaOf("/app/project/s1", "coding")).toBe(
        "transcription",
      );
    });

    it("does not mistake a study id containing the word for a room", () => {
      expect(workspaceAreaOf("/app/project/coding", null)).toBe(
        "transcription",
      );
    });

    it("reads a room with something after it", () => {
      expect(
        workspaceAreaOf("/app/project/s1/analysis?document=d1", null),
      ).toBe("analysis");
    });
  });

  describe("everywhere else there is no space", () => {
    it.each([
      "/app",
      "/app/new",
      "/app/account",
      "/app/account/security",
      "/app/admin",
      "/fr/docs/coding",
    ])("%s", (pathname) => {
      // Colouring these would make the scale mean nothing: they are not a pass
      // over material.
      expect(workspaceAreaOf(pathname, "coding")).toBeNull();
    });

    it("survives no pathname at all", () => {
      expect(workspaceAreaOf(null, "coding")).toBeNull();
      expect(workspaceAreaOf(undefined, null)).toBeNull();
    });
  });
});

/**
 * The rule is "once per PASS, not once per document" — and a pass is over a
 * CORPUS, so it is also "once per study". The grilles on offer, the one chosen
 * and whether there is one at all are all per study, so a pass carried across
 * studies skipped the question on a study that had no grille at all and landed on
 * a coding bar whose only word on the subject was that there was none.
 *
 * Module state, deliberately, so it survives navigation between documents of one
 * study and does not survive a reload.
 */
describe("the coding session", () => {
  const STUDY = "study-1";
  const OTHER = "study-2";

  it("starts inactive, so an interview opened cold asks", () => {
    endCodingSession();
    expect(isCodingSessionActive(STUDY)).toBe(false);
  });

  it("stays active across the documents of the same study", () => {
    endCodingSession();
    startCodingSession(STUDY);
    expect(isCodingSessionActive(STUDY)).toBe(true);
    // Nothing between two documents of that study ends it.
    expect(isCodingSessionActive(STUDY)).toBe(true);
  });

  it("asks again in another study, which may have another grille or none", () => {
    endCodingSession();
    startCodingSession(STUDY);
    expect(isCodingSessionActive(OTHER)).toBe(false);
  });

  it("moves with the reader rather than keeping the first study", () => {
    endCodingSession();
    startCodingSession(STUDY);
    startCodingSession(OTHER);
    expect(isCodingSessionActive(OTHER)).toBe(true);
    expect(isCodingSessionActive(STUDY)).toBe(false);
  });

  it("treats the documents filed in no study as a scope of their own", () => {
    endCodingSession();
    startCodingSession(null);
    expect(isCodingSessionActive(null)).toBe(true);
    expect(isCodingSessionActive(undefined)).toBe(true);
    expect(isCodingSessionActive(STUDY)).toBe(false);
  });

  it("ends when the app leaves coding", () => {
    startCodingSession(STUDY);
    endCodingSession();
    expect(isCodingSessionActive(STUDY)).toBe(false);
  });

  it("tells the screens, and only on a real change", () => {
    endCodingSession();
    let calls = 0;
    const stop = subscribeCodingSession(() => calls++);

    startCodingSession(STUDY);
    expect(calls).toBe(1);
    // Starting twice is what two mounts of the same editor would do; it must not
    // re-render every screen a second time.
    startCodingSession(STUDY);
    expect(calls).toBe(1);
    // Moving to another study IS a change.
    startCodingSession(OTHER);
    expect(calls).toBe(2);

    endCodingSession();
    expect(calls).toBe(3);
    endCodingSession();
    expect(calls).toBe(3);

    stop();
    startCodingSession(STUDY);
    expect(calls).toBe(3);
    endCodingSession();
  });

  it("reads as inactive on the server, so the question is always rendered", () => {
    startCodingSession(STUDY);
    expect(codingSessionServerSnapshot()).toBe(false);
    endCodingSession();
  });
});
