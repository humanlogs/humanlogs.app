"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Github } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "@/components/locale-provider";
import { LanguageSelector } from "./language-selector";
import { cn } from "../../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";

export const LandingHeader = () => {
  const t = useTranslations("header");
  const [isUseCasesOpen, setIsUseCasesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll to change header style
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          {false && (
            <DropdownMenu
              trigger={
                <button className="flex items-center gap-1 text-sm font-medium text-black transition-colors hover:text-black">
                  {t("nav.useCases")}
                  <ChevronDown className="h-4 w-4" />
                </button>
              }
            >
              <Link href="/use-cases/research">
                <DropdownMenuItem>
                  {t("useCasesDropdown.research")}
                </DropdownMenuItem>
              </Link>
            </DropdownMenu>
          )}

          <Link
            href="/pricing"
            className="text-sm font-medium text-black transition-colors hover:text-black"
          >
            {t("nav.pricing")}
          </Link>

          <Link
            href="https://github.com/humanlogs/humanlogs.app"
            target="_blank"
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
            className={cn(
              "rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black",
              "transition-colors duration-300",
              scrolled && "bg-blue-500 hover:bg-blue-600",
            )}
          >
            {t("nav.signUp")}
          </Link>
        </div>
      </div>
    </header>
  );
};
