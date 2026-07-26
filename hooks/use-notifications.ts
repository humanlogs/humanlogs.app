"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGateway } from "./fetch";

/**
 * In-app notifications. Feature-agnostic on purpose: a notification names an event
 * `type` and points at an entity, and the UI decides how to word it — so a new feature
 * can emit notifications without touching this hook.
 *
 * Live updates ride the existing `db:change` socket channel: the server emits for the
 * "notification" table, and the client invalidates any query keyed with it.
 */
export type NotificationDTO = {
  id: string;
  type: string;
  actor: { id: string; name: string | null; email: string; picture: string | null } | null;
  entityType: string | null;
  entityId: string | null;
  /** Plaintext label of the entity (e.g. a transcription title), when there is one. */
  entityTitle: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: async (): Promise<{
      notifications: NotificationDTO[];
      unreadCount: number;
    }> => {
      const response = await fetchGateway(`/api/notifications?limit=${limit}`);
      if (!response.ok) throw new Error("Failed to fetch notifications");
      return response.json();
    },
  });
}

/** Mark specific notifications, or all of them, as read. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { ids?: string[]; all?: boolean }) => {
      const response = await fetchGateway("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error("Failed to mark notifications read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
