"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  NotificationDTO,
  useMarkNotificationsRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { formatRelativeDate } from "@/lib/utils/relative-date";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Notification bell.
 *
 * Knows nothing about any particular feature: it renders whatever the API returns,
 * wording each entry from its `type` with a generic fallback, so a new kind of
 * notification only needs a translation key to read well here.
 */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const { locale } = useLocale();
  const router = useRouter();
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const notifications = data?.notifications ?? [];
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  /** Wording per event type, falling back to something sensible for unknown ones. */
  const describe = (n: NotificationDTO): string => {
    const actor = n.actor?.name || n.actor?.email || t("someone");
    const where = n.entityTitle ? ` · ${n.entityTitle}` : "";
    switch (n.type) {
      case "comment.mention":
        return `${t("mentionedYou", { name: actor })}${where}`;
      case "comment.reply":
        return `${t("repliedInThread", { name: actor })}${where}`;
      default:
        return `${actor}${where}`;
    }
  };

  /** Where a notification points. Entity-driven, so new types need no code here. */
  const hrefFor = (n: NotificationDTO): string | null => {
    if (n.entityType === "transcription" && n.entityId) {
      return `/app/transcription/${n.entityId}`;
    }
    return null;
  };

  const openNotification = (n: NotificationDTO) => {
    if (!n.readAt) markRead.mutate({ ids: [n.id] });
    const href = hrefFor(n);
    setOpen(false);
    if (href) router.push(href);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 p-0"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        title={t("title")}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="bg-popover text-popover-foreground absolute right-0 z-50 mt-1 flex max-h-[70vh] w-80 flex-col overflow-hidden rounded-lg border shadow-lg">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {t("title")}
            </span>
            {unread > 0 && (
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground text-[11px]"
                onClick={() => markRead.mutate({ all: true })}
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="divide-foreground/5 flex flex-col divide-y overflow-y-auto">
            {notifications.length === 0 && (
              <p className="text-muted-foreground px-3 py-6 text-center text-xs">
                {t("empty")}
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => openNotification(n)}
                className={`hover:bg-muted/60 flex gap-2 px-3 py-2 text-left transition-colors ${
                  n.readAt ? "" : "bg-muted/30"
                }`}
              >
                <UserAvatar
                  size="sm"
                  user={{
                    name: n.actor?.name ?? null,
                    email: n.actor?.email ?? null,
                    picture: n.actor?.picture ?? null,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs leading-snug">
                    {describe(n)}
                  </span>
                  <span className="text-muted-foreground text-[10px]">
                    {formatRelativeDate(n.createdAt, locale)}
                  </span>
                </span>
                {!n.readAt && (
                  <span className="bg-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
