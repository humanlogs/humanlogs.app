"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import type { Locale } from "@/lib/utils/i18n";
import { languagesNames, locales } from "@/lib/utils/i18n";
import { ChevronDown, Globe } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";

export const LanguageSelector = () => {
  const t = useTranslations("header.languageSelector");
  const { locale, setLocale } = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const handleLanguageChange = (newLocale: Locale) => {
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
