"use client";

import { useTranslations } from "@/components/locale-provider";
import { NotificationList } from "@/components/notifications/notification-list";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/hooks/use-notifications";

/** Full notification history — where the sidebar entry and the bell's "see all" lead. */
export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const { data, isLoading } = useNotifications(50);
  const markRead = useMarkNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-lg font-semibold">{t("title")}</h1>
        {unread > 0 && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs"
            onClick={() => markRead.mutate({ all: true })}
          >
            {t("markAllRead")}
          </button>
        )}
      </div>

      <div className="bg-card overflow-hidden rounded-lg border">
        {isLoading ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-xs">
            {t("loading")}
          </p>
        ) : (
          <NotificationList
            notifications={notifications}
            emptyClassName="px-3 py-10"
          />
        )}
      </div>
    </div>
  );
}
