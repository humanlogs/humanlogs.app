"use client";

import { useTranslations } from "@/components/locale-provider";
import { CheckCircleIcon, Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Short "we're setting things up" interstitial. Purely perceived-progress: it
 * ticks through a couple of reassuring steps over ~3s, then auto-advances to
 * the security step (which it narratively sets up with "securing your access").
 */
export function ProvisioningStep({ onDone }: { onDone: () => void }) {
  const t = useTranslations("welcome");
  const steps = [t("provisioning.step1"), t("provisioning.step2")];
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setCompleted(1), 800),
      setTimeout(() => setCompleted(2), 2700),
      setTimeout(() => onDone(), 3300),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="py-4">
      <h1 className="text-center text-xl font-bold tracking-tight">
        {t("provisioning.title")}
      </h1>
      <div className="mx-auto mt-6 max-w-xs space-y-3">
        {steps.map((label, i) => {
          const isDone = i < completed;
          const isActive = i === completed;
          return (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-opacity ${
                isDone || isActive ? "opacity-100" : "opacity-40"
              }`}
            >
              {isDone ? (
                <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
              ) : (
                <Loader2Icon
                  className={`h-5 w-5 shrink-0 text-primary ${
                    isActive ? "animate-spin" : "opacity-40"
                  }`}
                />
              )}
              <span className="text-sm font-medium">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
