"use client";

import { useTranslations } from "@/components/locale-provider";
import { ReferralEmails } from "@/components/referral/referral-emails";
import { fetchGateway } from "@/hooks/fetch";
import {
  Building2Icon,
  CheckCircleIcon,
  GiftIcon,
  PlusIcon,
  SendIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { RoleBucket } from "./onboarding-roles";
import { PricingStep } from "./pricing-step";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EngageStepProps {
  bucket: RoleBucket;
  userEmail?: string;
  isBillingEnabled: boolean;
  onContinue: () => void;
}

export function EngageStep({
  bucket,
  userEmail,
  isBillingEnabled,
  onContinue,
}: EngageStepProps) {
  const t = useTranslations("welcome");

  // ---- Student: invite friends for free minutes ----
  if (bucket === "student") {
    return (
      <>
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="rounded-2xl bg-primary/10 p-3">
            <GiftIcon className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("referralTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("referralSubtitle")}
          </p>
        </div>
        <ReferralEmails />
        <Button className="w-full" size="lg" onClick={onContinue}>
          {t("continue")}
        </Button>
      </>
    );
  }

  // ---- Researcher: capture interest in a lab/university licence ----
  if (bucket === "researcher") {
    return <ResearcherLicense userEmail={userEmail} onContinue={onContinue} />;
  }

  // ---- Journalist / other: choose a plan (with a free option) ----
  return (
    <PricingStep onContinue={onContinue} isBillingEnabled={isBillingEnabled} />
  );
}

function ResearcherLicense({
  userEmail,
  onContinue,
}: {
  userEmail?: string;
  onContinue: () => void;
}) {
  const t = useTranslations("welcome");
  const [email, setEmail] = useState(userEmail ?? "");
  const [secondEmail, setSecondEmail] = useState("");
  const [showSecond, setShowSecond] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(value)) {
      toast.error(t("researcher.invalid"));
      return;
    }
    const second = secondEmail.trim().toLowerCase();
    if (second && !EMAIL_REGEX.test(second)) {
      toast.error(t("researcher.invalid"));
      return;
    }
    setSending(true);
    try {
      // Stored as a feature-request feedback so it surfaces in the admin panel
      // as a lead, without a dedicated table.
      const emails = second ? `${value}, ${second}` : value;
      const res = await fetchGateway("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "FEATURE_REQUEST",
          message: `[LICENCE LEAD] Institutional contact(s): ${emails}`,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setSent(true);
      toast.success(t("researcher.sent"));
      setTimeout(onContinue, 1400);
    } catch {
      toast.error(t("researcher.error"));
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="rounded-full bg-green-100 p-3 dark:bg-green-950">
          <CheckCircleIcon className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          {t("researcher.sentTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("researcher.sent")}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-3 w-fit rounded-2xl bg-primary/10 p-3">
        <Building2Icon className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">
        {t("researcher.title")}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {t("researcher.subtitle")}
      </p>

      <div className="mt-5 space-y-2.5 text-left">
        <div className="flex items-stretch gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("researcher.placeholder")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-11"
          />
          <Button
            onClick={submit}
            disabled={sending}
            className="h-11 w-11 shrink-0 p-0"
            aria-label={t("researcher.submit")}
          >
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>

        {showSecond ? (
          <Input
            type="email"
            value={secondEmail}
            onChange={(e) => setSecondEmail(e.target.value)}
            placeholder={t("researcher.secondPlaceholder")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowSecond(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t("researcher.addSecond")}
          </button>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="block w-full pt-1 text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("researcher.skip")}
        </button>
      </div>
    </div>
  );
}
