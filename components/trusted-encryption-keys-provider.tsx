"use client";

import { ReactNode, useEffect } from "react";
import { cleanupNonTrustedKeys } from "@/lib/encryption/encryption";

export const TrustedEncryptionKeysProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  // Auto remove encrypted keys with trustDevice = false on logout
  // This serves as a safety net in case the user closes the browser/tab
  // before the logout process completes
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // Check if we're in a logged-out state by trying to fetch user info
      try {
        const response = await fetch("/api/user");
        if (response.status === 401 || response.status === 403) {
          // User is logged out, clean up non-trusted keys
          await cleanupNonTrustedKeys();
        }
      } catch {
        // If request fails, we might be offline or server is down
        // Don't remove keys in this case
      }
    };

    // Add a small delay on mount to check if user is logged out
    // This handles the case where the page loads after logout
    const checkOnMount = async () => {
      try {
        const response = await fetch("/api/user");
        if (response.status === 401 || response.status === 403) {
          await cleanupNonTrustedKeys();
        }
      } catch {
        // Ignore errors
      }
    };

    checkOnMount();

    // Note: beforeunload event is not reliable for async operations
    // The primary cleanup happens in the useLogout hook
    // This is just a backup mechanism
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return <>{children}</>;
};
