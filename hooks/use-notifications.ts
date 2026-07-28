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

/**
 * Unread counts per entity, for badges in lists. Keyed `"<entityType>:<entityId>"`.
 * Cheap enough to keep alongside any list without fetching the notifications.
 */
export function useNotificationCounts() {
  return useQuery({
    queryKey: ["notifications", "counts"],
    queryFn: async (): Promise<{
      total: number;
      byEntity: Record<string, number>;
    }> => {
      const response = await fetchGateway("/api/notifications/counts");
      if (!response.ok) throw new Error("Failed to fetch notification counts");
      const data = (await response.json()) as {
        total: number;
        byEntity: { entityType: string; entityId: string; count: number }[];
      };
      return {
        total: data.total,
        byEntity: Object.fromEntries(
          data.byEntity.map((e) => [`${e.entityType}:${e.entityId}`, e.count]),
        ),
      };
    },
  });
}

/** Mark notifications read: specific ids, everything, or everything about one entity. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      ids?: string[];
      all?: boolean;
      entityType?: string;
      entityId?: string;
    }) => {
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
