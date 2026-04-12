"use client";

import { useSocket } from "@/lib/sockets/socket-client";

export function SocketProvider({ children }: { children: React.ReactNode }) {
  // Initialize socket connection
  useSocket();

  return <>{children}</>;
}
