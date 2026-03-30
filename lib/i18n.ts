import { getRequestConfig } from "next-intl/server";

// Can be imported from a shared config
export const locales = ["en", "fr", "es", "de"];
export type Locale = "en" | "fr" | "es" | "de";
export const i18nFiles = ["common", "dialog", "editor", "landing", "account"];
export const languagesNames = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
};

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that a valid locale is used
  if (!locale || !locales.includes(locale)) {
    locale = "en";
  }

  // Load and merge all translation files for the locale
  const all = await Promise.all(
    i18nFiles.map(
      async (file) =>
        (await import(`../messages/${locale}/${file}.json`)).default,
    ),
  );

  return {
    locale,
    messages: Object.assign({}, ...all),
  };
});
