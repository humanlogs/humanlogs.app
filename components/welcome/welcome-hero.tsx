"use client";

import { useTranslations } from "@/components/locale-provider";
import { LockIcon, SparklesIcon, ZapIcon } from "lucide-react";

/**
 * Warm, welcoming header for the first onboarding step.
 *
 * Replaces the previous bare "Welcome, {name}" + subtitle with a friendlier
 * hero: a gradient badge, a personal greeting and a short row of reassurance
 * chips, so the very first screen feels inviting rather than like a form.
 */
export function WelcomeHero({ name }: { name?: string }) {
  const t = useTranslations("welcome");

  const chips = [
    { icon: LockIcon, label: t("heroChipPrivate") },
    { icon: ZapIcon, label: t("heroChipFast") },
    { icon: SparklesIcon, label: t("heroChipQuick") },
  ];

  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-2xl font-bold tracking-tight">
        {name ? t("title").replace("{name}", name) : t("titleDefault")}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-[15px] leading-relaxed">
        {t("heroSubtitle")}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            <chip.icon className="h-3.5 w-3.5 text-primary" />
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
