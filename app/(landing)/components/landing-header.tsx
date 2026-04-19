"use client";

import { useTranslations } from "@/components/locale-provider";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "../../../components/ui/dropdown-menu";
import { cn } from "../../../lib/utils/utils";
import { LanguageSelector } from "./language-selector";

export const LandingHeader = () => {
  const t = useTranslations("header");
  const [scrolled, setScrolled] = useState(false);

  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

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
          <span className="hidden md:inline-block">humanlogs</span>
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
            <Link href="/use-cases/journalism">
              <DropdownMenuItem>
                {t("useCasesDropdown.journalism")}
              </DropdownMenuItem>
            </Link>
            <Link href="/use-cases/podcasting">
              <DropdownMenuItem>
                {t("useCasesDropdown.podcasting")}
              </DropdownMenuItem>
            </Link>
            <Link href="/use-cases/education">
              <DropdownMenuItem>
                {t("useCasesDropdown.education")}
              </DropdownMenuItem>
            </Link>
          </DropdownMenu>

          <Link
            href="/pricing"
            className="text-sm font-medium text-black transition-colors hover:text-black"
          >
            {t("nav.pricing")}
          </Link>

          {/* Free Tools Dropdown */}
          <DropdownMenu
            trigger={
              <button className="flex items-center gap-1 text-sm font-medium text-black transition-colors hover:text-black">
                {t("nav.freeTools")}
                <ChevronDown className="h-4 w-4" />
              </button>
            }
          >
            <Link href="/tools/srt-tester">
              <DropdownMenuItem>SRT Subtitle Tester</DropdownMenuItem>
            </Link>
            <Link href="/tools/video-to-audio">
              <DropdownMenuItem>Video to Audio</DropdownMenuItem>
            </Link>
            <Link href="/tools/audio-compression">
              <DropdownMenuItem>Audio Compression</DropdownMenuItem>
            </Link>
            <Link href="/tools/mp3-to-wav">
              <DropdownMenuItem>MP3 to WAV</DropdownMenuItem>
            </Link>
            <Link href="/tools">
              <DropdownMenuItem className="text-blue-600 font-medium">
                View All Tools
              </DropdownMenuItem>
            </Link>
          </DropdownMenu>

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
