"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import { locales, languagesNames } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export const LanguageSelector = () => {
  const t = useTranslations("header.languageSelector");
  const { locale, setLocale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (newLocale: Locale) => {
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button className="flex items-center gap-1 text-sm font-medium text-black transition-colors hover:text-black">
        <Globe className="h-4 w-4" />
        {languagesNames[locale]}
        <ChevronDown className="h-4 w-4" />
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-40 rounded-md border border-gray-200 bg-white shadow-lg">
          <div className="py-2">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLanguageChange(loc as Locale)}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
                  locale === loc ? "font-semibold text-black" : "text-gray-700"
                }`}
              >
                {languagesNames[loc as Locale]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
