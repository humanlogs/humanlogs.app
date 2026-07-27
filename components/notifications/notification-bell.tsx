"use client";

import { useTranslations } from "@/components/locale-provider";
import { NotificationList } from "@/components/notifications/notification-list";
import { Button } from "@/components/ui/button";
import {
  useMarkNotificationsRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { BellIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Notification bell: unread badge plus a dropdown of the most recent entries.
 *
 * The full history lives at /app/notifications, which is also how the sidebar reaches
 * it; this is the in-place shortcut for wherever the user already is.
 */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const { data } = useNotifications(10);
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

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="icon-sm"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        title={t("title")}
      >
        <BellIcon className="h-4 w-4" />
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

          <div className="overflow-y-auto">
            <NotificationList
              notifications={notifications}
              onNavigate={() => setOpen(false)}
            />
          </div>

          <Link
            href="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-muted-foreground hover:text-foreground border-t px-3 py-2 text-center text-[11px]"
          >
            {t("seeAll")}
          </Link>
        </div>
      )}
    </div>
  );
}
