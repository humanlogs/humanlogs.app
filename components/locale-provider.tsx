"use client";

import * as React from "react";
import { Locale, locales } from "../lib/i18n";

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

  // Load saved locale from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("transcription-locale");
    if (saved && locales.includes(saved)) {
      setLocaleState(saved as Locale);
    }
  }, []);

  // Load messages when locale changes
  React.useEffect(() => {
    import(`@/messages/${locale}.json`).then((mod) => {
      setMessages(mod.default);
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

  return (key: string) => {
    return t(`${namespace}.${key}`);
  };
}
