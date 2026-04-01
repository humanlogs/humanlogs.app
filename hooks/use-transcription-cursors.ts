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
  CursorPositionWithSocket,
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
  const lastEmitRef = useRef<number>(0);
  const lastPositionRef = useRef<{ startOffset: number; endOffset: number; hasWriteAccess: boolean } | null>(null);
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

  // Keepalive: Periodically re-emit cursor position to maintain active status
  useEffect(() => {
    const interval = setInterval(() => {
      if (!userProfile?.id || !userProfile?.name || !lastPositionRef.current) return;
      
      const now = Date.now();
      
      // Only send if we have a position to send
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
    }, 15000); // Send keepalive every 15 seconds

    return () => clearInterval(interval);
  }, [transcriptionId, userProfile?.id, userProfile?.name]);

  return {
    cursors: Array.from(cursors.values()),
    updateCursorPosition,
    // Determine if editing should be locked
    // Locked if another user with write access was active within last 30s
    isEditLocked: () => {
      if (!userProfile?.id) return false;
      
      const now = Date.now();
      const ACTIVE_THRESHOLD = 30000; // 30 seconds
      
      for (const cursor of cursors.values()) {
        // Skip self
        if (cursor.userId === userProfile.id) continue;
        
        // Check if this user has write access and is recently active
        if (cursor.hasWriteAccess && now - cursor.lastUpdate < ACTIVE_THRESHOLD) {
          return true;
        }
      }
      
      return false;
    },
    // Get the active editor (user with write access who was active most recently)
    activeEditor: () => {
      let mostRecentEditor: UserCursor | null = null;
      
      for (const cursor of cursors.values()) {
        if (!cursor.hasWriteAccess) continue;
        
        if (!mostRecentEditor || cursor.lastUpdate > mostRecentEditor.lastUpdate) {
          mostRecentEditor = cursor;
        }
      }
      
      return mostRecentEditor;
    },
  };
}
