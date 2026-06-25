"use client";

import * as React from "react";
import { useFeedbackModal } from "@/components/dialogs/feedback-dialog";
import { useAnyModalOpen } from "@/components/use-modal";
import { useTranscriptions } from "@/hooks/use-transcriptions";

// Only prompt once, ever — being asked for feedback on every visit is annoying.
const STORAGE_KEY = "feedback-auto-prompt-shown";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Opens the feedback modal the first time a user loads the app at least 24h
 * after creating a real (non-tutorial) transcription. Renders nothing.
 *
 * Mounted once in the app shell. The trigger fires a single time and remembers
 * it in localStorage so the user is never prompted again automatically.
 */
export function FeedbackAutoPrompt() {
  const { data: transcriptions } = useTranscriptions();
  const { open } = useFeedbackModal();
  const anyModalOpen = useAnyModalOpen();
  const hasTriggered = React.useRef(false);

  React.useEffect(() => {
    if (hasTriggered.current) return;
    if (!transcriptions) return;
    // Don't stack on top of a modal the user already has open.
    if (anyModalOpen) return;

    if (localStorage.getItem(STORAGE_KEY) === "true") {
      hasTriggered.current = true;
      return;
    }

    const now = Date.now();
    const hasEligibleTranscription = transcriptions.some(
      (t) =>
        t.isOwner !== false &&
        !t.isTutorial &&
        t.createdAt &&
        now - new Date(t.createdAt).getTime() >= TWENTY_FOUR_HOURS_MS,
    );

    if (!hasEligibleTranscription) return;

    hasTriggered.current = true;
    localStorage.setItem(STORAGE_KEY, "true");

    // Let the app settle before interrupting with a dialog.
    const timer = setTimeout(() => open({ mode: "rating" }), 1500);
    return () => clearTimeout(timer);
  }, [transcriptions, anyModalOpen, open]);

  return null;
}
