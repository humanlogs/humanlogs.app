"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomShortcut } from "@/lib/shortcuts";

// Fetch custom shortcuts
export function useCustomShortcuts() {
  return useQuery({
    queryKey: ["shortcuts"],
    queryFn: async () => {
      const response = await fetch("/api/user/shortcuts");
      if (!response.ok) {
        throw new Error("Failed to fetch shortcuts");
      }
      const data = await response.json();
      return (data.shortcuts || []) as CustomShortcut[];
    },
  });
}

// Add custom shortcut
export function useAddCustomShortcut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shortcut: Omit<CustomShortcut, "id">) => {
      const response = await fetch("/api/user/shortcuts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shortcut),
      });

      if (!response.ok) {
        throw new Error("Failed to add shortcut");
      }

      const data = await response.json();
      return data.shortcut as CustomShortcut;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortcuts"] });
    },
  });
}

// Delete custom shortcut
export function useDeleteCustomShortcut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/user/shortcuts?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete shortcut");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shortcuts"] });
    },
  });
}
