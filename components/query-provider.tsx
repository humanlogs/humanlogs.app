"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSocket } from "@/lib/socket-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Consider data stale after 1 minute
      refetchOnWindowFocus: false, // Let socket handle updates
      retry: 1,
    },
  },
});

function SocketInitializer() {
  useSocket(); // Initialize socket connection
  return null;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SocketInitializer />
      {children}
    </QueryClientProvider>
  );
}
