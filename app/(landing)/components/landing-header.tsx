"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Github } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "@/components/locale-provider";
import { LanguageSelector } from "./language-selector";

export const LandingHeader = () => {
  const t = useTranslations("header");
  const [isUseCasesOpen, setIsUseCasesOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/50 backdrop-blur supports-[backdrop-filter]:bg-white/50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="text-xl font-semibold text-black flex items-center gap-2"
        >
          <Image
            src="/logo.svg"
            alt="HumanLogs Logo"
            width={32}
            height={32}
            className="inline-block"
          />
          <span>humanlogs</span>
        </Link>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link
            href="/"
            className="text-sm font-medium text-black transition-colors hover:text-black"
          >
            {t("nav.home")}
          </Link>

          {/* Use Cases Dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setIsUseCasesOpen(true)}
            onMouseLeave={() => setIsUseCasesOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm font-medium text-black transition-colors hover:text-black">
              {t("nav.useCases")}
              <ChevronDown className="h-4 w-4" />
            </button>
            {isUseCasesOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 rounded-md border border-gray-200 bg-white shadow-lg">
                <div className="py-2">
                  <Link
                    href="/use-cases/research"
                    className="block px-4 py-2 text-sm text-black hover:bg-gray-50"
                  >
                    {t("useCasesDropdown.research")}
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/pricing"
            className="text-sm font-medium text-black transition-colors hover:text-black"
          >
            {t("nav.pricing")}
          </Link>

          <Link
            href="https://github.com/your-repo"
            className="text-sm font-medium text-black transition-colors hover:text-black"
          >
            {t("nav.github")}
          </Link>

          <Link
            href="/contact"
            className="text-sm font-medium text-black transition-colors hover:text-black"
          >
            {t("nav.contact")}
          </Link>
        </nav>

        {/* Auth Buttons and Language Selector */}
        <div className="flex items-center gap-6">
          <LanguageSelector />
          <Link
            href="/app/login"
            className="text-sm font-medium text-black transition-colors hover:text-black"
          >
            {t("nav.login")}
          </Link>
          <Link
            href="/app/login"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black"
          >
            {t("nav.signUp")}
          </Link>
        </div>
      </div>
    </header>
  );
};
