/**
 * A timestamp in the app's locale (not the browser's), for activity feeds — comments,
 * notifications, anything read mostly while it is fresh. The recent past is relative
 * ("2 minutes ago"), older entries fall back to an absolute date. Wording comes from
 * Intl.RelativeTimeFormat rather than the app's message catalogue.
 */
export function formatRelativeDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);

  try {
    if (seconds < 60) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      return rtf.format(0, "second").replace(/^\w/, (c) => c.toLowerCase());
    }
    if (seconds < 3600) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      return rtf.format(-Math.floor(seconds / 60), "minute");
    }
    if (seconds < 86400) {
      const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      return rtf.format(-Math.floor(seconds / 3600), "hour");
    }

    const sameYear = date.getFullYear() === new Date().getFullYear();
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}
