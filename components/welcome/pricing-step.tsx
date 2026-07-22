"use client";

import { useTranslations } from "@/components/locale-provider";
import { fetchGateway } from "@/hooks/fetch";
import { useMutation } from "@tanstack/react-query";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils/utils";

// Plan display data mirrors lib/billing/stripe.ts (PLANS). Keep in sync.
const PRO_MONTHLY = 15;
const PRO_YEARLY_PER_MONTH = 13.75;

/**
 * Onboarding pricing step for journalists / "other" roles: nice free + Pro
 * cards with a billing-cycle toggle. Free continues into the app; Pro starts a
 * Stripe checkout. Falls back to a plain "start free" screen when billing is
 * not configured (self-host).
 */
export function PricingStep({
  onContinue,
  isBillingEnabled,
}: {
  onContinue: () => void;
  isBillingEnabled: boolean;
}) {
  const t = useTranslations("welcome");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("yearly");

  const checkout = useMutation({
    mutationFn: async (planType: "monthly" | "yearly") => {
      const res = await fetchGateway("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      if (!res.ok) throw new Error("checkout failed");
      return res.json() as Promise<{ url?: string }>;
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: () => toast.error(t("pricing.error")),
  });

  if (!isBillingEnabled) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("plan.title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("plan.subtitleFree")}
        </p>
        <Button className="mt-5 w-full" size="lg" onClick={onContinue}>
          {t("plan.continueFree")}
        </Button>
      </div>
    );
  }

  const proPrice = cycle === "monthly" ? PRO_MONTHLY : PRO_YEARLY_PER_MONTH;
  const features = [t("pricing.feat1"), t("pricing.feat2")];

  return (
    <div>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("pricing.title")}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("pricing.subtitle")}
        </p>
      </div>

      {/* Billing cycle toggle */}
      <div className="mt-4 flex items-center justify-center">
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5 text-sm">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={cn(
                "rounded-full px-3 py-1 font-medium transition-colors",
                cycle === c
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {t(`pricing.${c}`)}
              {c === "yearly" && (
                <span className="ml-1 text-primary">{t("pricing.save")}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-2xl border p-5">
          <div className="text-sm font-semibold">{t("pricing.freeName")}</div>
          <div className="mt-1 text-3xl font-bold">0 €</div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {t("pricing.freeMinutes")}
          </div>
          <ul className="mt-4 flex-1 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-5 w-full" onClick={onContinue}>
            {t("pricing.freeCta")}
          </Button>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-2xl border-2 border-primary bg-primary/5 p-5">
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
            {t("pricing.popular")}
          </span>
          <div className="text-sm font-semibold">{t("pricing.proName")}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold">
              {proPrice.toLocaleString(undefined, {
                minimumFractionDigits: proPrice % 1 ? 2 : 0,
              })}{" "}
              €
            </span>
            <span className="text-muted-foreground text-sm">
              {t("pricing.perMonth")}
            </span>
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {cycle === "yearly"
              ? t("pricing.billedYearly")
              : t("pricing.proMinutes")}
          </div>
          <ul className="mt-4 flex-1 space-y-2">
            <li className="flex items-start gap-2 text-sm">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="font-medium">{t("pricing.proMinutes")}</span>
            </li>
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-5 w-full"
            disabled={checkout.isPending}
            onClick={() => checkout.mutate(cycle)}
          >
            {t("pricing.proCta")}
          </Button>
        </div>
      </div>
    </div>
  );
}
