"use client";

import { useTranslations } from "@/components/locale-provider";
import { ReferralEmails } from "@/components/referral/referral-emails";
import { fetchGateway } from "@/hooks/fetch";
import { CheckCircleIcon, GiftIcon, SendIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { RoleBucket } from "./onboarding-roles";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EngageStepProps {
  bucket: RoleBucket;
  userEmail?: string;
  credits: number;
  onContinue: () => void;
}

export function EngageStep({
  bucket,
  userEmail,
  credits,
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

  // ---- Journalist / other: start free, with a peek at plans ----
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 w-fit rounded-2xl bg-primary/10 p-3">
        <SparklesIcon className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">
        {t("plan.title")}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {t("plan.subtitle").replace("{credits}", String(credits))}
      </p>

      <div className="mt-5 space-y-3">
        <Button className="w-full" size="lg" onClick={onContinue}>
          {t("plan.continueFree")}
        </Button>
        <Link
          href="/app/account/billing"
          className="block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("plan.seePlans")}
        </Link>
      </div>
    </div>
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
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(value)) {
      toast.error(t("researcher.invalid"));
      return;
    }
    setSending(true);
    try {
      // Stored as a feature-request feedback so it surfaces in the admin panel
      // as a lead, without a dedicated table.
      const res = await fetchGateway("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "FEATURE_REQUEST",
          message: `[LICENCE LEAD] Institutional email: ${value}`,
        }),
      });
      if (!res.ok) throw new Error("failed");
      setSent(true);
      toast.success(t("researcher.sent"));
      setTimeout(onContinue, 1200);
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
        <GiftIcon className="h-6 w-6 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">
        {t("researcher.title")}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {t("researcher.subtitle")}
      </p>

      <div className="mt-5 space-y-3 text-left">
        <div className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("researcher.placeholder")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button onClick={submit} disabled={sending} size="lg">
            <SendIcon className="h-4 w-4" />
          </Button>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("researcher.skip")}
        </button>
      </div>
    </div>
  );
}
