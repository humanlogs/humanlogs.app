"use client";

import { useEffect } from "react";

export function VisitTracker() {
  useEffect(() => {
    // Track landing page visit
    const trackVisit = async () => {
      try {
        await fetch("/api/track-visit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (error) {
        // Silent fail - don't impact user experience
        console.debug("Failed to track visit:", error);
      }
    };

    trackVisit();
  }, []); // Run only once on mount

  return null; // This component doesn't render anything
}
