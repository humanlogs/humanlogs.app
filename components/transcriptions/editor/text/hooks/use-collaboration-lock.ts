"use client";

import { useUserProfile } from "@/hooks/use-api";
import {
  claimLeadership,
  leaderKeepalive,
  onLeaderChanged,
  onLeaderDenied,
  onLeaderGranted,
  offLeaderChanged,
  offLeaderDenied,
  offLeaderGranted,
  releaseLeadership,
  type Leader,
} from "@/lib/socket-client";
import { useEffect, useRef, useState } from "react";

export type LockStatus = {
  isLocked: boolean;
  lockedBy: Leader | null;
  isLockedByMe: boolean;
};

export function useCollaborationLock(transcriptionId: string): LockStatus {
  const { data: userProfile } = useUserProfile();
  const [leader, setLeader] = useState<Leader | null>(null);
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptedClaimRef = useRef(false);

  // Determine if the current user has the lock
  const isLockedByMe = leader !== null && userProfile?.id === leader.userId;

  useEffect(() => {
    if (!transcriptionId || !userProfile?.id) return;

    // Handler for when leadership changes
    const handleLeaderChanged = (data: {
      transcriptionId: string;
      leader: Leader | null;
    }) => {
      if (data.transcriptionId === transcriptionId) {
        console.log(
          "[Collaboration Lock] Leader changed:",
          data.leader?.userName || "none",
        );
        setLeader(data.leader);

        // If we lost leadership, stop keepalive
        if (!data.leader || data.leader.userId !== userProfile.id) {
          if (keepaliveIntervalRef.current) {
            clearInterval(keepaliveIntervalRef.current);
            keepaliveIntervalRef.current = null;
          }
        }
      }
    };

    // Handler for when we successfully claim leadership
    const handleLeaderGranted = (data: { transcriptionId: string }) => {
      if (data.transcriptionId === transcriptionId) {
        console.log("[Collaboration Lock] Leadership granted to me");

        // Start sending keepalive heartbeats every 10 seconds
        if (keepaliveIntervalRef.current) {
          clearInterval(keepaliveIntervalRef.current);
        }
        keepaliveIntervalRef.current = setInterval(() => {
          leaderKeepalive(transcriptionId);
        }, 10000);
      }
    };

    // Handler for when our leadership claim is denied
    const handleLeaderDenied = (data: {
      transcriptionId: string;
      currentLeader: Leader;
    }) => {
      if (data.transcriptionId === transcriptionId) {
        console.log(
          "[Collaboration Lock] Leadership denied, held by:",
          data.currentLeader.userName,
        );
        setLeader(data.currentLeader);
      }
    };

    // Register event listeners
    onLeaderChanged(handleLeaderChanged);
    onLeaderGranted(handleLeaderGranted);
    onLeaderDenied(handleLeaderDenied);

    // Try to claim leadership when entering the room
    // Only attempt once per mount
    if (!attemptedClaimRef.current) {
      attemptedClaimRef.current = true;
      console.log("[Collaboration Lock] Attempting to claim leadership");
      claimLeadership(
        transcriptionId,
        userProfile.id,
        userProfile.name || "Unknown User",
      );
    }

    // Cleanup on unmount
    return () => {
      console.log("[Collaboration Lock] Cleaning up");

      // Release leadership if we have it
      if (leader?.userId === userProfile.id) {
        releaseLeadership(transcriptionId);
      }

      // Stop keepalive
      if (keepaliveIntervalRef.current) {
        clearInterval(keepaliveIntervalRef.current);
        keepaliveIntervalRef.current = null;
      }

      // Remove event listeners
      offLeaderChanged(handleLeaderChanged);
      offLeaderGranted(handleLeaderGranted);
      offLeaderDenied(handleLeaderDenied);

      // Reset attempt flag for next mount
      attemptedClaimRef.current = false;
    };
  }, [transcriptionId, userProfile?.id, userProfile?.name, leader?.userId]);

  return {
    isLocked: leader !== null,
    lockedBy: leader,
    isLockedByMe,
  };
}
