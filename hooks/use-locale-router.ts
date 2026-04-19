"use client";

import { usePathname, useRouter } from "next/navigation";
import { Locale, locales } from "@/lib/utils/i18n";

/**
 * Hook for locale-based routing on landing pages
 * Extracts locale from URL and provides navigation function
 */
export function useLocaleRouter() {
  const pathname = usePathname();
  const router = useRouter();

  // Extract current locale from pathname
  const getLocaleFromPathname = (): Locale => {
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0];

    if (locales.includes(firstSegment as Locale)) {
      return firstSegment as Locale;
    }

    return "en"; // Default fallback
  };

  const currentLocale = getLocaleFromPathname();

  // Navigate to a different locale while preserving the path
  const changeLocale = (newLocale: Locale) => {
    const segments = pathname.split("/").filter(Boolean);

    // Check if first segment is a locale
    if (locales.includes(segments[0] as Locale)) {
      // Replace the locale
      segments[0] = newLocale;
    } else {
      // Add locale at the beginning
      segments.unshift(newLocale);
    }

    const newPath = "/" + segments.join("/");
    router.push(newPath);
  };

  return {
    locale: currentLocale,
    changeLocale,
  };
}
