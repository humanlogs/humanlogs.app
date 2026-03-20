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

let socket: Socket | null = null;

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
