/**
 * Timestamp shown on a comment, in the app's locale (not the browser's).
 *
 * Comment threads are read mostly while the conversation is fresh, so the recent past
 * is relative ("2 min ago") and anything older falls back to an absolute date. Uses
 * Intl.RelativeTimeFormat so the wording comes from the locale rather than the app's
 * message catalogue.
 */
export function formatCommentDate(iso: string, locale: string): string {
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
