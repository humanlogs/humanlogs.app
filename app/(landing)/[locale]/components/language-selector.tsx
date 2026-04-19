"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { useLocaleRouter } from "@/hooks/use-locale-router";
import type { Locale } from "@/lib/utils/i18n";
import { languagesNames, locales } from "@/lib/utils/i18n";
import { ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "../../../../components/ui/dropdown-menu";

export const LanguageSelector = () => {
  const t = useTranslations("header.languageSelector");
  const { locale: clientLocale, setLocale } = useLocale();
  const { locale: urlLocale, changeLocale } = useLocaleRouter();
  const [isOpen, setIsOpen] = useState(false);

  // Use URL-based locale for landing pages
  const locale = urlLocale;

  const handleLanguageChange = (newLocale: Locale) => {
    // Update URL (navigate to new locale path)
    changeLocale(newLocale);
    // Also update client-side locale for consistency
    setLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <DropdownMenu
      trigger={
        <button className="flex items-center gap-1 text-sm font-medium text-black transition-colors hover:text-black">
          <Globe className="h-4 w-4" />
          <span className="hidden md:inline">{languagesNames[locale]}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      }
    >
      {locales.map((loc) => (
        <DropdownMenuItem
          key={loc}
          onClick={() => handleLanguageChange(loc as Locale)}
          className={`block w-full px-4 py-2 text-left text-sm transition-colors hover:bg-gray-50 ${
            locale === loc ? "font-semibold text-black" : "text-gray-700"
          }`}
        >
          {languagesNames[loc as Locale]}
        </DropdownMenuItem>
      ))}
    </DropdownMenu>
  );
};
