"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useUserProfile } from "@/hooks/use-api";

type DatabaseChangeEvent = {
  table: string;
  operation: "create" | "update" | "delete";
  timestamp: string;
  data?: unknown;
};

export type CursorPosition = {
  userId: string;
  userName: string;
  startOffset: number;
  endOffset: number;
  timestamp: number;
  hasWriteAccess: boolean;
  /** Audio playback/scrub position (seconds) while listening; null when driven by
   *  the edit caret. Lets peers see where a user is on the waveform during playback. */
  audioTime?: number | null;
};

export type CursorPositionWithSocket = CursorPosition & {
  socketId: string;
};

let socket: Socket | null = null;

// Cache for pending operations when socket is not connected
const pendingOperations: Map<
  string,
  { type: "join" | "leave"; transcriptionId: string }
> = new Map();

// Cache for event listeners registered before socket connects
type EventCallback = (...args: any[]) => void;
const pendingListeners: Map<string, Set<EventCallback>> = new Map();

function attachListener(event: string, callback: EventCallback) {
  if (socket) {
    socket.on(event, callback);
  } else {
    // Cache listener for when socket connects
    if (!pendingListeners.has(event)) {
      pendingListeners.set(event, new Set());
    }
    pendingListeners.get(event)!.add(callback);
  }
}

function detachListener(event: string, callback?: EventCallback) {
  if (socket) {
    socket.off(event, callback);
  }
  // Also remove from pending listeners
  if (callback && pendingListeners.has(event)) {
    pendingListeners.get(event)!.delete(callback);
  }
}

export function useSocket() {
  const queryClient = useQueryClient();
  const { data: userProfile } = useUserProfile();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if we have a user ID
    if (!userProfile?.id) return;

    // Initialize socket connection if not already connected
    if (!socket || !socket.connected) {
      // Get socket token from user profile
      const socketToken = (userProfile as any).socketToken;

      if (!socketToken) {
        console.error("No socket token available in user profile");
        return;
      }

      socket = io({
        path: "/api/socket",
        autoConnect: true,
        auth: {
          token: socketToken, // Send JWT socket token
        },
      });

      socket.on("connect", () => {
        console.log("Socket connected:", socket?.id);

        // Attach all pending event listeners
        pendingListeners.forEach((callbacks, event) => {
          callbacks.forEach((callback) => {
            socket?.on(event, callback);
            console.log("Attached cached listener for:", event);
          });
        });
        pendingListeners.clear();

        // Execute all pending operations
        pendingOperations.forEach((operation) => {
          if (operation.type === "join") {
            socket?.emit("transcription:join", operation.transcriptionId);
            console.log("Executed cached join for:", operation.transcriptionId);
          } else if (operation.type === "leave") {
            socket?.emit("transcription:leave", operation.transcriptionId);
            console.log(
              "Executed cached leave for:",
              operation.transcriptionId,
            );
          }
        });

        // Clear pending operations after execution
        pendingOperations.clear();
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });

      socket.on("error", (error: any) => {
        console.error("Socket error:", error);
        if (error.message === "Authentication required") {
          console.error(
            "Socket authentication failed - token may be invalid or expired",
          );
          // Optionally redirect to login or refresh the page
        }
      });

      // The server authenticates in a Socket.io middleware, so a rejected
      // handshake surfaces here (the connection is never established) rather
      // than as a post-connect `error` event.
      socket.on("connect_error", (error: Error) => {
        if (error.message === "Authentication required") {
          console.error(
            "Socket authentication failed - token may be invalid or expired",
          );
          return;
        }
        console.error("Socket connection error:", error.message);
      });

      socket.on("db:change", (event: DatabaseChangeEvent) => {
        console.log("Database change event:", event);

        // Invalidate queries whose key references the changed table. The server
        // emits the singular Prisma model name (e.g. "transcription") while query
        // keys use the plural (["transcriptions", ...]) — tolerate both directions.
        const table = event.table.toLowerCase();
        queryClient.invalidateQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            if (!Array.isArray(queryKey)) return false;
            return queryKey.some((key) => {
              if (typeof key !== "string") return false;
              const k = key.toLowerCase();
              return k === table || `${k}s` === table || k === `${table}s`;
            });
          },
        });
      });

      socketRef.current = socket;
    }

    return () => {
      // Don't disconnect on unmount, keep connection alive
      // socket?.disconnect();
    };
  }, [queryClient, userProfile?.id, (userProfile as any)?.socketToken]);

  // Don't return anything - this hook just sets up the socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Helper to get the socket instance
export function getSocket(): Socket | null {
  return socket;
}

// Transcription room management
export function joinTranscriptionRoom(transcriptionId: string) {
  if (socket?.connected) {
    socket.emit("transcription:join", transcriptionId);
    // Remove from pending operations if it was cached
    pendingOperations.delete(transcriptionId);
  } else {
    // Cache the join operation to execute when socket connects
    pendingOperations.set(transcriptionId, {
      type: "join",
      transcriptionId,
    });
    console.log("Cached join operation for:", transcriptionId);
  }
}

export function leaveTranscriptionRoom(transcriptionId: string) {
  if (socket?.connected) {
    socket.emit("transcription:leave", transcriptionId);
    // Remove from pending operations if it was cached
    pendingOperations.delete(transcriptionId);
  } else {
    // Check if there's a pending join operation
    const pendingOp = pendingOperations.get(transcriptionId);
    if (pendingOp?.type === "join") {
      // Cancel the pending join operation
      pendingOperations.delete(transcriptionId);
      console.log("Cancelled cached join operation for:", transcriptionId);
    } else {
      // Cache the leave operation to execute when socket connects
      pendingOperations.set(transcriptionId, {
        type: "leave",
        transcriptionId,
      });
      console.log("Cached leave operation for:", transcriptionId);
    }
  }
}

// Cursor position management
export function emitCursorPosition(
  transcriptionId: string,
  position: CursorPosition,
) {
  if (socket?.connected) {
    socket.emit("transcription:cursor-update", {
      transcriptionId,
      position,
    });
  }
}

// Listen for cursor updates from other users
export function onCursorPosition(
  callback: (position: CursorPositionWithSocket) => void,
) {
  attachListener("transcription:cursor-position", callback);
}

// Listen for users joining
export function onUserJoined(
  callback: (data: { userId: string; socketId: string }) => void,
) {
  attachListener("transcription:user-joined", callback);
}

// Listen for users leaving
export function onUserLeft(
  callback: (data: { userId: string; socketId: string }) => void,
) {
  attachListener("transcription:user-left", callback);
}

// Listen for disconnections
export function onUserDisconnected(
  callback: (data: { socketId: string }) => void,
) {
  attachListener("transcription:user-disconnected", callback);
}

// Cleanup listeners
export function offCursorPosition(
  callback?: (position: CursorPositionWithSocket) => void,
) {
  detachListener("transcription:cursor-position", callback);
}

export function offUserJoined(
  callback?: (data: { userId: string; socketId: string }) => void,
) {
  detachListener("transcription:user-joined", callback);
}

export function offUserLeft(
  callback?: (data: { userId: string; socketId: string }) => void,
) {
  detachListener("transcription:user-left", callback);
}

export function offUserDisconnected(
  callback?: (data: { socketId: string }) => void,
) {
  detachListener("transcription:user-disconnected", callback);
}

// A transcription was reverted to a past version → all clients must leave the collab
// room and reload so the fresh session re-seeds from the reverted DB row.
export type RevertedEvent = {
  transcriptionId: string;
  byUserId: string;
  byName: string;
};

export function onTranscriptionReverted(
  callback: (data: RevertedEvent) => void,
) {
  attachListener("transcription:reverted", callback);
}

export function offTranscriptionReverted(
  callback?: (data: RevertedEvent) => void,
) {
  detachListener("transcription:reverted", callback);
}
