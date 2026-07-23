"use client";

import { useTranslations } from "@/components/locale-provider";
import { cn } from "@/lib/utils/utils";
import {
  EllipsisIcon,
  GraduationCapIcon,
  MicroscopeIcon,
  NewspaperIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { InlineChoice } from "@/components/ui/inline-choice";
import { KaraokeText, wordCount } from "@/components/ui/karaoke-text";
import { useKaraoke } from "@/hooks/use-karaoke";
import { HEADLINE_ROLES, OTHER_PROFESSIONS } from "./onboarding-roles";

const MONTHLY_USAGE_KEYS = ["lt1h", "h1to5", "h5to20", "gt20h"];

const ROLE_ICONS: Record<string, LucideIcon> = {
  researcher: MicroscopeIcon,
  student: GraduationCapIcon,
  journalist: NewspaperIcon,
  other: EllipsisIcon,
};

interface RoleStepProps {
  name?: string;
  /** Currently selected profession (headline role or a finer "other" one). */
  profession: string;
  /** Select a profession — the parent applies residency/volume presets. */
  onSelectProfession: (profession: string) => void;
  residency: "eu" | "us";
  onResidencyChange: (r: "eu" | "us") => void;
  monthlyUsage: string;
  onMonthlyUsageChange: (m: string) => void;
  /** Whether a data-residency choice is offered (both providers configured). */
  showResidency: boolean;
  onContinue: () => void;
  loading?: boolean;
}

export function RoleStep({
  name,
  profession,
  onSelectProfession,
  residency,
  onResidencyChange,
  monthlyUsage,
  onMonthlyUsageChange,
  showResidency,
  onContinue,
  loading,
}: RoleStepProps) {
  const t = useTranslations("welcome");
  const titleText = name
    ? t("title").replace("{name}", name)
    : t("titleDefault");
  const subtitleText = t("roleStep.subtitle");
  const titleWords = wordCount(titleText);
  const words = titleText.split(" ").concat(subtitleText.split(" "));

  // The greeting is "spoken" karaoke-style (title then subtitle) at the same
  // human, word-length-driven cadence as the landing transcript demo; the role
  // selector is revealed only once every word has landed. If a role is already
  // chosen (coming back to this step), show it all instantly.
  const alreadyChosen = !!profession;
  const [revealed, setRevealed] = useState(alreadyChosen);
  const spoken = useKaraoke(words, {
    enabled: !alreadyChosen,
    perChar: 30,
    jitter: 18,
    lineEndPause: 260,
    // Pause a touch at the end of the title before the subtitle picks up.
    isLineEnd: (i) => i === titleWords - 1 || i === words.length - 1,
    onComplete: () => setTimeout(() => setRevealed(true), 250),
  });
  const shownSpoken = alreadyChosen ? words.length + 1 : spoken;
  // Show the selector once the greeting finishes OR a role is already chosen.
  // The latter matters for a returning user: `profession` seeds in after the
  // first render, flipping `alreadyChosen` true and stopping the karaoke, so we
  // must not gate the selector on the karaoke's (now cancelled) onComplete.
  const showSelector = revealed || alreadyChosen;

  const isOtherProfession = (p: string) =>
    p === "other" || OTHER_PROFESSIONS.includes(p);
  const [otherOpen, setOtherOpen] = useState(isOtherProfession(profession));

  const headlineActive = (role: string) => {
    if (role === "other") return isOtherProfession(profession);
    return profession === role;
  };

  const handleHeadline = (role: string) => {
    if (role === "other") {
      setOtherOpen(true);
      if (!isOtherProfession(profession)) onSelectProfession("other");
    } else {
      setOtherOpen(false);
      onSelectProfession(role);
    }
  };

  return (
    <div className="text-center">
      <div className="flex items-center justify-center mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Logo" className="flex w-16 h-16" />
      </div>

      <h1 className="text-2xl font-bold tracking-tight">
        <KaraokeText text={titleText} active={shownSpoken} tone="muted" />
      </h1>
      <p className="mt-2 text-[15px] pb-8">
        <KaraokeText
          text={subtitleText}
          active={shownSpoken - titleWords}
          tone="muted"
        />
      </p>

      {/* The role selector + settings are revealed once the greeting finishes. */}
      {showSelector && (
        <div className="space-y-5 text-left">
          <div>
            <p className="mb-2 text-sm font-medium">{t("roleStep.question")}</p>
            <div className="grid grid-cols-2 gap-2.5">
              {HEADLINE_ROLES.map((role) => {
                const Icon = ROLE_ICONS[role];
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleHeadline(role)}
                    className={cn(
                      "flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors",
                      headlineActive(role)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        headlineActive(role)
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    {t(`role.${role}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finer professions when "Other" is chosen. */}
          {otherOpen && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("roleStep.otherPrompt")}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OTHER_PROFESSIONS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSelectProfession(p)}
                    className={cn(
                      "rounded-lg border p-2.5 text-center text-sm transition-colors",
                      profession === p
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    {t(`profession.${p}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Discreet, editable secondary settings — read like text. */}
          {profession && (
            <p className="text-sm text-muted-foreground">
              {showResidency && (
                <>
                  {t("config.processing")}{" "}
                  <InlineChoice
                    value={residency}
                    onChange={(v) => onResidencyChange(v as "eu" | "us")}
                    options={[
                      {
                        value: "eu",
                        label: t("config.euValue"),
                        desc: t("residencyEuDesc"),
                      },
                      {
                        value: "us",
                        label: t("config.usValue"),
                        desc: t("residencyUsDesc"),
                      },
                    ]}
                  />
                  {" · "}
                </>
              )}
              {t("config.volume")}{" "}
              <InlineChoice
                value={monthlyUsage}
                onChange={onMonthlyUsageChange}
                options={MONTHLY_USAGE_KEYS.map((k) => ({
                  value: k,
                  label: t(`monthlyUsage.${k}`),
                }))}
              />
            </p>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={loading || !profession}
            onClick={onContinue}
          >
            {t("continue")}
          </Button>
        </div>
      )}
    </div>
  );
}
