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
};

export type CursorPositionWithSocket = CursorPosition & {
  socketId: string;
};

export type Leader = {
  userId: string;
  userName: string;
  socketId: string;
  timestamp: number;
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
      socket = io({
        path: "/api/socket",
        autoConnect: true,
        query: {
          userId: userProfile.id,
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

      socket.on("db:change", (event: DatabaseChangeEvent) => {
        console.log("Database change event:", event);

        // Invalidate queries based on the table that changed
        queryClient.invalidateQueries({
          predicate: (query) => {
            // Check if query key contains the table name
            const queryKey = query.queryKey;
            if (Array.isArray(queryKey)) {
              return queryKey.some(
                (key) =>
                  typeof key === "string" &&
                  key.toLowerCase() === event.table.toLowerCase(),
              );
            }
            return false;
          },
        });
      });

      socketRef.current = socket;
    }

    return () => {
      // Don't disconnect on unmount, keep connection alive
      // socket?.disconnect();
    };
  }, [queryClient, userProfile?.id]);

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

// Leader management
export function claimLeadership(
  transcriptionId: string,
  userId: string,
  userName: string,
) {
  if (socket?.connected) {
    socket.emit("transcription:claim-leader", {
      transcriptionId,
      userId,
      userName,
    });
  }
}

export function releaseLeadership(transcriptionId: string) {
  if (socket?.connected) {
    socket.emit("transcription:release-leader", {
      transcriptionId,
    });
  }
}

export function leaderKeepalive(transcriptionId: string) {
  if (socket?.connected) {
    socket.emit("transcription:leader-keepalive", {
      transcriptionId,
    });
  }
}

// Listen for leader changes
export function onLeaderChanged(
  callback: (data: { transcriptionId: string; leader: Leader | null }) => void,
) {
  attachListener("transcription:leader-changed", callback);
}

export function onLeaderGranted(
  callback: (data: { transcriptionId: string }) => void,
) {
  attachListener("transcription:leader-granted", callback);
}

export function onLeaderDenied(
  callback: (data: { transcriptionId: string; currentLeader: Leader }) => void,
) {
  attachListener("transcription:leader-denied", callback);
}

// Cleanup leader listeners
export function offLeaderChanged(
  callback?: (data: { transcriptionId: string; leader: Leader | null }) => void,
) {
  detachListener("transcription:leader-changed", callback);
}

export function offLeaderGranted(
  callback?: (data: { transcriptionId: string }) => void,
) {
  detachListener("transcription:leader-granted", callback);
}

export function offLeaderDenied(
  callback?: (data: { transcriptionId: string; currentLeader: Leader }) => void,
) {
  detachListener("transcription:leader-denied", callback);
}
