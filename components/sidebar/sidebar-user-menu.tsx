"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { useTheme } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useFeedbackModal } from "@/components/dialogs/feedback-dialog";
import {
  CheckIcon,
  CreditCardIcon,
  HelpCircleIcon,
  LanguagesIcon,
  LogOutIcon,
  MoonIcon,
  ShieldCheckIcon,
  StarIcon,
  SunIcon,
  LightbulbIcon,
} from "lucide-react";
import * as React from "react";
import { UserProfile } from "../../hooks/use-api";

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
  const { open: openFeedbackModal } = useFeedbackModal();
  const [isHoveringAvatar, setIsHoveringAvatar] = React.useState(false);

  // Calculate credits display
  const creditsTotal = userProfile?.creditsRefill || 0;
  const creditsRemaining = userProfile?.credits || 0;
  const creditsUsed = userProfile?.creditsUsed || 0;
  const creditsPercentage =
    creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;

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
              ) : (
                <UserAvatar user={user} size="sm" className="w-7 h-7" />
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
        {userProfile?.isBillingEnabled && (
          <DropdownMenuItem
            onClick={() => (window.location.href = "/account/billing")}
          >
            <CreditCardIcon className="w-4 h-4 mr-2" />
            {t("user.billing")}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => (window.location.href = "/account/security")}
        >
          <ShieldCheckIcon className="w-4 h-4 mr-2" />
          {t("user.security")}
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

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => openFeedbackModal({ mode: "rating" })}>
          <StarIcon className="w-4 h-4 mr-2" />
          {t("user.feedback")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => openFeedbackModal({ mode: "feature-request" })}
        >
          <LightbulbIcon className="w-4 h-4 mr-2" />
          {t("user.featureRequest")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => window.open("https://help.example.com", "_blank")}
        >
          <HelpCircleIcon className="w-4 h-4 mr-2" />
          {t("user.help")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={async () => {
            // Check if using local auth
            const authMode = process.env.NEXT_PUBLIC_AUTH_MODE;

            if (authMode === "local") {
              try {
                await fetch("/api/local-auth/logout", { method: "POST" });
                window.location.href = "/login";
              } catch (error) {
                console.error("Logout failed:", error);
                window.location.href = "/login";
              }
            } else {
              window.location.href = "/api/auth/logout";
            }
          }}
        >
          <LogOutIcon className="w-4 h-4 mr-2" />
          {t("user.logout")}
        </DropdownMenuItem>
      </div>
    </DropdownMenu>
  );
}
