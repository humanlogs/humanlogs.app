"use client";

import * as React from "react";
import { Locale, locales, i18nFiles } from "../lib/utils/i18n";

type LocaleContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

type Messages = Record<string, unknown>;

const LocaleContext = React.createContext<LocaleContextType | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>("en");
  const [messages, setMessages] = React.useState<Messages>({});
  const [loaded, setLoaded] = React.useState(false);

  // Load saved locale from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("transcription-locale");
    if (saved && locales.includes(saved)) {
      setLocaleState(saved as Locale);
    } else {
      // Detect browser language
      const browserLang = navigator.language.split("-")[0];
      if (locales.includes(browserLang)) {
        setLocaleState(browserLang as Locale);
      }
    }
  }, []);

  // Load messages when locale changes
  React.useEffect(() => {
    Promise.all(
      i18nFiles.map((file) => import(`@/messages/${locale}/${file}.json`)),
    ).then((modules) => {
      const merged = Object.assign({}, ...modules.map((mod) => mod.default));
      setMessages(merged);
      console.log(merged);
      setLoaded(true);
    });
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("transcription-locale", newLocale);
  };

  const t = (key: string) => {
    const keys = key.split(".");
    let value: unknown = messages;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    return typeof value === "string" ? value : key;
  };

  if (!loaded) {
    return null; // or a loading spinner
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = React.useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}

export function useTranslations(namespace: string) {
  const { t } = useLocale();

  return (key: string, params?: Record<string, string | number>) => {
    let translation = t(`${namespace}.${key}`);

    // Replace placeholders with actual values
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{${paramKey}}`, String(value));
      });
    }

    return translation;
  };
}
