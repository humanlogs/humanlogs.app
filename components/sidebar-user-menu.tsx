"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "@/components/locale-provider";
import {
  CreditCardIcon,
  ExternalLinkIcon,
  MoonIcon,
  SunIcon,
  LanguagesIcon,
  CheckIcon,
  LogOutIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";

type UserProfile = {
  id: string;
  email: string;
  name?: string;
  language: string;
  credits: number;
  creditsRefill: number;
  plan: string;
};

type SidebarUserMenuProps = {
  user: {
    email?: string;
    name?: string;
    picture?: string;
  };
  userProfile: UserProfile | null;
  onLocaleChange: (locale: "en" | "fr" | "es" | "de") => void;
};

export function SidebarUserMenu({
  user,
  userProfile,
  onLocaleChange,
}: SidebarUserMenuProps) {
  const t = useTranslations("sidebar");
  const { locale } = useLocale();
  const { theme, setTheme } = useTheme();
  const [isHoveringAvatar, setIsHoveringAvatar] = React.useState(false);

  // Calculate credits display
  const creditsUsed = userProfile?.credits || 0;
  const creditsTotal = userProfile?.creditsRefill || 1000;
  const creditsRemaining = Math.max(0, creditsTotal - creditsUsed);
  const creditsPercentage =
    creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;
  const planType =
    userProfile?.plan === "one-time"
      ? "One-Time Plan"
      : userProfile?.plan || "Free Plan";

  // Get user's initials
  const getUserInitial = () => {
    if (user.name) {
      return user.name.charAt(0).toUpperCase();
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Get current theme
  const currentTheme =
    theme === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  return (
    <DropdownMenu
      trigger={
        <button
          className="flex items-center justify-between w-full px-2 py-2 rounded hover:bg-accent/50 transition-colors cursor-pointer"
          onMouseEnter={() => setIsHoveringAvatar(true)}
          onMouseLeave={() => setIsHoveringAvatar(false)}
        >
          {/* Avatar with Progress Ring */}
          <div className="relative w-10 h-10 shrink-0">
            {/* Progress ring */}
            <svg className="w-10 h-10 transform -rotate-90 absolute inset-0">
              <circle
                cx="20"
                cy="20"
                r="18"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                className="text-muted-foreground/20"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${
                  2 * Math.PI * 18 * (1 - creditsPercentage / 100)
                }`}
                className="text-primary transition-all duration-300"
                strokeLinecap="round"
              />
            </svg>

            {/* Avatar content */}
            <div className="absolute inset-0 flex items-center justify-center">
              {isHoveringAvatar ? (
                <span className="text-[10px] font-bold">
                  {Math.round(creditsPercentage)}%
                </span>
              ) : user.picture ? (
                <Image
                  src={user.picture}
                  alt={user.name || "User"}
                  width={28}
                  height={28}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                  {getUserInitial()}
                </div>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0 ml-3 text-left">
            <p className="text-sm font-medium truncate">
              {user.name || user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {creditsRemaining} credits left
            </p>
          </div>
        </button>
      }
      align="start"
    >
      {/* Account Info Section */}
      <div className="px-3 py-3 border-b">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{user.name || "User"}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground mt-2">{planType}</p>
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{t("user.credits")}</span>
            <span className="font-medium">
              {creditsUsed} / {creditsTotal}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-1">
        <DropdownMenuItem onClick={() => console.log("Billing")}>
          <CreditCardIcon className="w-4 h-4 mr-2" />
          {t("user.billing")}
        </DropdownMenuItem>

        <DropdownMenuSub
          trigger={
            <>
              {currentTheme === "dark" ? (
                <MoonIcon className="w-4 h-4 mr-2" />
              ) : (
                <SunIcon className="w-4 h-4 mr-2" />
              )}
              {t("user.theme")}
            </>
          }
        >
          <DropdownMenuItem
            onClick={() => setTheme("light")}
            preventClose
            className="justify-between"
          >
            <span>{t("user.light")}</span>
            {theme === "light" && <CheckIcon className="w-4 h-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme("dark")}
            preventClose
            className="justify-between"
          >
            <span>{t("user.dark")}</span>
            {theme === "dark" && <CheckIcon className="w-4 h-4" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme("system")}
            preventClose
            className="justify-between"
          >
            <span>{t("user.system")}</span>
            {theme === "system" && <CheckIcon className="w-4 h-4" />}
          </DropdownMenuItem>
        </DropdownMenuSub>

        <DropdownMenuSub
          trigger={
            <>
              <LanguagesIcon className="w-4 h-4 mr-2" />
              {t("user.language")}
            </>
          }
        >
          {["en", "fr", "es", "de"].map((lang) => (
            <DropdownMenuItem
              key={lang}
              onClick={() => onLocaleChange(lang as "en" | "fr" | "es" | "de")}
              className="justify-between"
            >
              <span>{t(`languages.${lang}`)}</span>
              {locale === lang && <CheckIcon className="w-4 h-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSub>

        <DropdownMenuItem
          onClick={() => window.open("https://feedback.example.com", "_blank")}
        >
          <ExternalLinkIcon className="w-4 h-4 mr-2" />
          {t("user.feedback")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open("https://help.example.com", "_blank")}
        >
          <ExternalLinkIcon className="w-4 h-4 mr-2" />
          {t("user.help")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => (window.location.href = "/api/auth/logout")}
        >
          <LogOutIcon className="w-4 h-4 mr-2" />
          {t("user.logout")}
        </DropdownMenuItem>
      </div>
    </DropdownMenu>
  );
}
