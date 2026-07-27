"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  NotificationDTO,
  useMarkNotificationsRead,
} from "@/hooks/use-notifications";
import { formatRelativeDate } from "@/lib/utils/relative-date";
import { useRouter } from "next/navigation";

/**
 * Renders a list of notifications. Shared by the header bell and the notifications
 * page, and deliberately feature-agnostic: each entry is worded from its `type`, with a
 * generic fallback, so a new kind of notification only needs a translation key.
 */
export function NotificationList({
  notifications,
  onNavigate,
  emptyClassName,
}: {
  notifications: NotificationDTO[];
  /** Called just before navigating, e.g. to close the dropdown. */
  onNavigate?: () => void;
  emptyClassName?: string;
}) {
  const t = useTranslations("notifications");
  const { locale } = useLocale();
  const router = useRouter();
  const markRead = useMarkNotificationsRead();

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

  /** Where an entry points. Entity-driven, so new types need no code here. */
  const hrefFor = (n: NotificationDTO): string | null =>
    n.entityType === "transcription" && n.entityId
      ? `/app/transcription/${n.entityId}`
      : null;

  const open = (n: NotificationDTO) => {
    if (!n.readAt) markRead.mutate({ ids: [n.id] });
    const href = hrefFor(n);
    onNavigate?.();
    if (href) router.push(href);
  };

  if (notifications.length === 0) {
    return (
      <p
        className={`text-muted-foreground text-center text-xs ${emptyClassName ?? "px-3 py-6"}`}
      >
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="divide-foreground/5 flex flex-col divide-y">
      {notifications.map((n) => (
        <button
          key={n.id}
          type="button"
          onClick={() => open(n)}
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
            <span className="block text-xs leading-snug">{describe(n)}</span>
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
  );
}
