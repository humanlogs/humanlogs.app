"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useUserProfile } from "./use-api";
import {
  joinTranscriptionRoom,
  leaveTranscriptionRoom,
  emitCursorPosition,
  onCursorPosition,
  onUserJoined,
  onUserLeft,
  onUserDisconnected,
  offCursorPosition,
  offUserJoined,
  offUserLeft,
  offUserDisconnected,
  claimLeadership,
  releaseLeadership,
  leaderKeepalive,
  onLeaderChanged,
  onLeaderGranted,
  onLeaderDenied,
  offLeaderChanged,
  offLeaderGranted,
  offLeaderDenied,
  CursorPositionWithSocket,
  Leader,
} from "@/lib/socket-client";

export type UserCursor = {
  socketId: string;
  userId: string;
  userName: string;
  startOffset: number;
  endOffset: number;
  lastUpdate: number;
  hasWriteAccess: boolean;
};

export function useTranscriptionCursors(transcriptionId: string) {
  const { data: userProfile } = useUserProfile();
  const [cursors, setCursors] = useState<Map<string, UserCursor>>(new Map());
  const [currentLeader, setCurrentLeader] = useState<Leader | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const lastEmitRef = useRef<number>(0);
  const lastPositionRef = useRef<{
    startOffset: number;
    endOffset: number;
    hasWriteAccess: boolean;
  } | null>(null);
  const EMIT_THROTTLE = 100; // Throttle cursor updates to 100ms

  // Join/leave transcription room
  useEffect(() => {
    if (!transcriptionId) return;

    joinTranscriptionRoom(transcriptionId);
    console.log(`Joined transcription room: ${transcriptionId}`);

    return () => {
      leaveTranscriptionRoom(transcriptionId);
      console.log(`Left transcription room: ${transcriptionId}`);
    };
  }, [transcriptionId]);

  // Listen for cursor updates from other users
  useEffect(() => {
    const handleCursorPosition = (position: CursorPositionWithSocket) => {
      setCursors((prev) => {
        const updated = new Map(prev);
        updated.set(position.socketId, {
          socketId: position.socketId,
          userId: position.userId,
          userName: position.userName,
          startOffset: position.startOffset,
          endOffset: position.endOffset,
          lastUpdate: position.timestamp,
          hasWriteAccess: position.hasWriteAccess,
        });
        return updated;
      });
    };

    const handleUserJoined = (data: { userId: string; socketId: string }) => {
      console.log(`User joined: ${data.userId}`);
    };

    const handleUserLeft = (data: { userId: string; socketId: string }) => {
      console.log(`User left: ${data.userId}`);
      setCursors((prev) => {
        const updated = new Map(prev);
        updated.delete(data.socketId);
        return updated;
      });
    };

    const handleUserDisconnected = (data: { socketId: string }) => {
      console.log(`User disconnected: ${data.socketId}`);
      setCursors((prev) => {
        const updated = new Map(prev);
        updated.delete(data.socketId);
        return updated;
      });
    };

    onCursorPosition(handleCursorPosition);
    onUserJoined(handleUserJoined);
    onUserLeft(handleUserLeft);
    onUserDisconnected(handleUserDisconnected);

    return () => {
      offCursorPosition(handleCursorPosition);
      offUserJoined(handleUserJoined);
      offUserLeft(handleUserLeft);
      offUserDisconnected(handleUserDisconnected);
    };
  }, []);

  // Listen for leader changes
  useEffect(() => {
    const handleLeaderChanged = (data: {
      transcriptionId: string;
      leader: Leader | null;
    }) => {
      if (data.transcriptionId === transcriptionId) {
        setCurrentLeader(data.leader);
        // Check if we are the leader
        setIsLeader(data.leader?.userId === userProfile?.id);
      }
    };

    const handleLeaderGranted = (data: { transcriptionId: string }) => {
      if (data.transcriptionId === transcriptionId) {
        setIsLeader(true);
        console.log("Leadership granted for transcription:", transcriptionId);
      }
    };

    const handleLeaderDenied = (data: {
      transcriptionId: string;
      currentLeader: Leader;
    }) => {
      if (data.transcriptionId === transcriptionId) {
        setIsLeader(false);
        console.log(
          "Leadership denied. Current leader:",
          data.currentLeader.userName,
        );
      }
    };

    onLeaderChanged(handleLeaderChanged);
    onLeaderGranted(handleLeaderGranted);
    onLeaderDenied(handleLeaderDenied);

    return () => {
      offLeaderChanged(handleLeaderChanged);
      offLeaderGranted(handleLeaderGranted);
      offLeaderDenied(handleLeaderDenied);
    };
  }, [transcriptionId, userProfile?.id]);

  // Function to emit cursor position (throttled)
  const updateCursorPosition = useCallback(
    (startOffset: number, endOffset: number, hasWriteAccess: boolean) => {
      if (!userProfile?.id || !userProfile?.name) return;

      const now = Date.now();

      // Save the last position for keepalive
      lastPositionRef.current = { startOffset, endOffset, hasWriteAccess };

      if (now - lastEmitRef.current < EMIT_THROTTLE) {
        return;
      }

      lastEmitRef.current = now;

      emitCursorPosition(transcriptionId, {
        userId: userProfile.id,
        userName: userProfile.name,
        startOffset,
        endOffset,
        timestamp: now,
        hasWriteAccess,
      });
    },
    [transcriptionId, userProfile?.id, userProfile?.name],
  );

  // Function to emit cursor position immediately (bypasses throttle)
  // Used for focus events to lock editing quickly
  const updateCursorPositionImmediate = useCallback(
    (startOffset: number, endOffset: number, hasWriteAccess: boolean) => {
      if (!userProfile?.id || !userProfile?.name) return;

      const now = Date.now();

      // Save the last position for keepalive
      lastPositionRef.current = { startOffset, endOffset, hasWriteAccess };

      // Update throttle timestamp to prevent immediate re-emit
      lastEmitRef.current = now;

      emitCursorPosition(transcriptionId, {
        userId: userProfile.id,
        userName: userProfile.name,
        startOffset,
        endOffset,
        timestamp: now,
        hasWriteAccess,
      });
    },
    [transcriptionId, userProfile?.id, userProfile?.name],
  );

  // Clean up stale cursors (older than 30 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const STALE_THRESHOLD = 30000; // 30 seconds

      setCursors((prev) => {
        const updated = new Map(prev);
        let changed = false;

        for (const [socketId, cursor] of updated.entries()) {
          if (now - cursor.lastUpdate > STALE_THRESHOLD) {
            updated.delete(socketId);
            changed = true;
          }
        }

        return changed ? updated : prev;
      });
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Keepalive: Periodically re-emit cursor position and leader keepalive
  useEffect(() => {
    const interval = setInterval(() => {
      if (!userProfile?.id || !userProfile?.name) return;

      const now = Date.now();

      // Send cursor position keepalive if we have a position
      if (lastPositionRef.current) {
        emitCursorPosition(transcriptionId, {
          userId: userProfile.id,
          userName: userProfile.name,
          startOffset: lastPositionRef.current.startOffset,
          endOffset: lastPositionRef.current.endOffset,
          timestamp: now,
          hasWriteAccess: lastPositionRef.current.hasWriteAccess,
        });
      }

      // Send leader keepalive if we are the leader
      if (isLeader) {
        leaderKeepalive(transcriptionId);
      }
    }, 15000); // Send keepalive every 15 seconds

    return () => clearInterval(interval);
  }, [transcriptionId, userProfile?.id, userProfile?.name, isLeader]);

  // Functions to claim and release leadership
  const claimLeader = useCallback(() => {
    if (!userProfile?.id || !userProfile?.name) return;
    claimLeadership(transcriptionId, userProfile.id, userProfile.name);
  }, [transcriptionId, userProfile?.id, userProfile?.name]);

  const releaseLeader = useCallback(() => {
    if (!isLeader) return;
    releaseLeadership(transcriptionId);
    setIsLeader(false);
  }, [transcriptionId, isLeader]);

  return {
    cursors: Array.from(cursors.values()),
    updateCursorPosition,
    updateCursorPositionImmediate,
    // Leader-based locking
    isEditLocked: !isLeader, // Locked if we are not the leader
    currentLeader,
    isLeader,
    claimLeader,
    releaseLeader,
  };
}
