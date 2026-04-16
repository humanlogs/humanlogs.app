"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Track landing page visit with current page path
    const trackVisit = async () => {
      try {
        // Fire and forget - don't wait for response
        fetch(`/api/iwashere?page=${encodeURIComponent(pathname)}`, {
          method: "GET",
          // Use keepalive to ensure request completes even if page unloads
          keepalive: true,
        }).catch(() => {
          // Silent fail - don't impact user experience
        });
      } catch (error) {
        // Silent fail - don't impact user experience
        console.debug("Failed to track visit:", error);
      }
    };

    // Small delay to not block initial render
    const timer = setTimeout(trackVisit, 100);

    return () => clearTimeout(timer);
  }, [pathname]); // Re-track if pathname changes

  return null; // This component doesn't render anything
}
