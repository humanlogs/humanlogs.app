"use client";

import {
  CursorPositionWithSocket,
  emitCursorPosition,
  joinTranscriptionRoom,
  leaveTranscriptionRoom,
  offCursorPosition,
  offUserDisconnected,
  offUserJoined,
  offUserLeft,
  onCursorPosition,
  onUserDisconnected,
  onUserJoined,
  onUserLeft,
} from "@/lib/sockets/socket-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUserProfile } from "./use-api";

export type UserCursor = {
  socketId: string;
  userId: string;
  userName: string;
  startOffset: number;
  endOffset: number;
  lastUpdate: number;
  hasWriteAccess: boolean;
  /** Audio position (seconds) while listening; null → tick follows the edit caret. */
  audioTime?: number | null;
};

export function useTranscriptionCursors(transcriptionId: string) {
  const { data: userProfile } = useUserProfile();
  const [cursors, setCursors] = useState<Map<string, UserCursor>>(new Map());
  const lastEmitRef = useRef<number>(0);
  const lastAudioEmitRef = useRef<number>(0);
  const lastPositionRef = useRef<{
    startOffset: number;
    endOffset: number;
    hasWriteAccess: boolean;
    audioTime?: number | null;
  } | null>(null);
  const EMIT_THROTTLE = 100; // Throttle cursor updates to 100ms
  const AUDIO_EMIT_THROTTLE = 150; // Throttle audio-position updates

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
          audioTime: position.audioTime ?? null,
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

      // Edit-caret movement → clear any audio position (tick follows the caret).
      lastPositionRef.current = {
        startOffset,
        endOffset,
        hasWriteAccess,
        audioTime: null,
      };

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
        audioTime: null,
      });
    },
    [transcriptionId, userProfile?.id, userProfile?.name],
  );

  // Emit the current audio playback/scrub position so peers' waveform ticks follow
  // this user while listening (not just when the edit caret moves). Throttled.
  const updateAudioPosition = useCallback(
    (audioTime: number) => {
      if (!userProfile?.id || !userProfile?.name) return;

      const prev = lastPositionRef.current;
      const startOffset = prev?.startOffset ?? 0;
      const endOffset = prev?.endOffset ?? 0;
      const hasWriteAccess = prev?.hasWriteAccess ?? false;

      const now = Date.now();
      lastPositionRef.current = {
        startOffset,
        endOffset,
        hasWriteAccess,
        audioTime,
      };

      if (now - lastAudioEmitRef.current < AUDIO_EMIT_THROTTLE) return;
      lastAudioEmitRef.current = now;

      emitCursorPosition(transcriptionId, {
        userId: userProfile.id,
        userName: userProfile.name,
        startOffset,
        endOffset,
        timestamp: now,
        hasWriteAccess,
        audioTime,
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

  // Keepalive: periodically re-emit our cursor position so peers don't stale it out.
  useEffect(() => {
    const interval = setInterval(() => {
      if (!userProfile?.id || !userProfile?.name) return;
      if (!lastPositionRef.current) return;
      emitCursorPosition(transcriptionId, {
        userId: userProfile.id,
        userName: userProfile.name,
        startOffset: lastPositionRef.current.startOffset,
        endOffset: lastPositionRef.current.endOffset,
        timestamp: Date.now(),
        hasWriteAccess: lastPositionRef.current.hasWriteAccess,
        audioTime: lastPositionRef.current.audioTime ?? null,
      });
    }, 15000); // Send keepalive every 15 seconds

    return () => clearInterval(interval);
  }, [transcriptionId, userProfile?.id, userProfile?.name]);

  return {
    cursors: Array.from(cursors.values()),
    updateCursorPosition,
    updateCursorPositionImmediate,
    updateAudioPosition,
  };
}
