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
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { InlineChoice } from "@/components/ui/inline-choice";
import { KaraokeText, wordCount } from "@/components/ui/karaoke-text";
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
  const totalWords = titleWords + wordCount(subtitleText);

  // The greeting is "spoken" karaoke-style (title then subtitle) on one shared
  // timeline; the role selector is revealed only once every word has landed. If
  // a role is already chosen (coming back to this step), show it all instantly.
  const alreadyChosen = !!profession;
  const [spoken, setSpoken] = useState(alreadyChosen ? totalWords + 1 : 0);
  const [revealed, setRevealed] = useState(alreadyChosen);

  // Latest word count, read fresh inside the timer: the greeting title depends
  // on `name`, which resolves asynchronously, so a value captured in the effect
  // closure would be stale. Keeping it in a ref lets the running timeline pick
  // up the final count without restarting.
  const totalRef = useRef(totalWords);
  totalRef.current = totalWords;

  useEffect(() => {
    if (alreadyChosen) return;
    // Drive the "spoken" word count from elapsed time (not an accumulating
    // counter) so a re-mount converges to the same value instead of leaving a
    // stray timer wedged mid-line. Words light ~100ms apart; once the last one
    // lands we push past it so nothing stays highlighted, then reveal the
    // selector a beat later.
    const WORD_MS = 100;
    const start = performance.now();
    let raf = 0;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      const total = totalRef.current;
      const n = Math.floor((performance.now() - start) / WORD_MS);
      if (n >= total) {
        setSpoken(total + 1);
        revealTimer = setTimeout(() => setRevealed(true), 250);
        return;
      }
      setSpoken(n);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (revealTimer) clearTimeout(revealTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <KaraokeText text={titleText} active={spoken} />
      </h1>
      <p className="text-muted-foreground mt-2 text-[15px] pb-8">
        <KaraokeText text={subtitleText} active={spoken - titleWords} />
      </p>

      {/* The role selector + settings are revealed once the greeting finishes. */}
      {revealed && (
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
