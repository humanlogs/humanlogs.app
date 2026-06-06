"use client";

import { useTranslations } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddReferrals, useReferrals } from "@/hooks/use-api";
import { CheckCircle2Icon, GiftIcon, MailIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Shared referral UI: add invitation emails and view their status.
 * Used both in onboarding and in the dedicated referral tab.
 */
export function ReferralEmails() {
  const t = useTranslations("referral");
  const { data: summary } = useReferrals();
  const addReferrals = useAddReferrals();

  const [pending, setPending] = React.useState<string[]>([]);
  const [input, setInput] = React.useState("");

  const usedSlots = (summary?.total || 0) + pending.length;
  const maxReferrals = summary?.maxReferrals || 10;
  const remaining = Math.max(0, maxReferrals - usedSlots);
  const bonusPerReferral = summary?.bonusPerReferral || 15;

  const addToPending = () => {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      toast.error(t("invalidEmail"));
      return;
    }
    if (remaining <= 0) {
      toast.error(t("maxReached", { max: maxReferrals }));
      return;
    }
    const known = new Set([
      ...pending,
      ...(summary?.referrals.map((r) => r.email) || []),
    ]);
    if (known.has(email)) {
      toast.error(t("alreadyAdded"));
      return;
    }
    setPending((prev) => [...prev, email]);
    setInput("");
  };

  const removePending = (email: string) => {
    setPending((prev) => prev.filter((e) => e !== email));
  };

  const handleSend = async () => {
    if (pending.length === 0) return;
    try {
      await addReferrals.mutateAsync(pending);
      setPending([]);
      toast.success(t("invitesSent"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("sendError"),
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
        <GiftIcon className="h-5 w-5 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          {t("explainer", { minutes: bonusPerReferral, max: maxReferrals })}
        </p>
      </div>

      {/* Add email input */}
      <div className="flex gap-2">
        <Input
          type="email"
          value={input}
          placeholder={t("emailPlaceholder")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addToPending();
            }
          }}
          disabled={remaining <= 0}
        />
        <Button
          type="button"
          variant="outline"
          onClick={addToPending}
          disabled={remaining <= 0 || !input.trim()}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("slotsRemaining", { count: remaining })}
      </p>

      {/* Pending (not yet sent) */}
      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((email) => (
            <Badge
              key={email}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => removePending(email)}
              title={t("removeTooltip")}
            >
              {email} ✕
            </Badge>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <Button
          type="button"
          onClick={handleSend}
          disabled={addReferrals.isPending}
        >
          <MailIcon className="mr-2 h-4 w-4" />
          {addReferrals.isPending
            ? t("sending")
            : t("sendInvites", { count: pending.length })}
        </Button>
      )}

      {/* Already invited list */}
      {summary && summary.referrals.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("invitedTitle")}</p>
          <ul className="divide-y rounded-lg border">
            {summary.referrals.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="truncate">{r.email}</span>
                {r.status === "REGISTERED" ? (
                  <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                    <CheckCircle2Icon className="h-3 w-3" />
                    {t("statusRegistered")}
                  </Badge>
                ) : (
                  <Badge variant="secondary">{t("statusInvited")}</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && (
        <p className="text-sm text-muted-foreground">
          {t("earnedSummary", {
            registered: summary.registeredCount,
            credits: summary.bonusCredits,
          })}
        </p>
      )}
    </div>
  );
}
