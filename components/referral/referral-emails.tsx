"use client";

import { useTranslations } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAddReferrals,
  useReferrals,
  useRemoveReferral,
} from "@/hooks/use-api";
import {
  CheckCircle2Icon,
  GiftIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ReferralEmails() {
  const t = useTranslations("referral");
  const { data: summary } = useReferrals();
  const addReferrals = useAddReferrals();
  const removeReferral = useRemoveReferral();

  const [input, setInput] = React.useState("");

  const usedSlots = summary?.total || 0;
  const maxReferrals = summary?.maxReferrals || 10;
  const remaining = Math.max(0, maxReferrals - usedSlots);
  const bonusPerReferral = summary?.bonusPerReferral || 15;

  const handleInvite = async () => {
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
    const known = new Set(summary?.referrals.map((r) => r.email) || []);
    if (known.has(email)) {
      toast.error(t("alreadyAdded"));
      return;
    }
    try {
      await addReferrals.mutateAsync([email]);
      setInput("");
      toast.success(t("invitesSent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sendError"));
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

      <div className="flex gap-2">
        <Input
          type="email"
          value={input}
          placeholder={t("emailPlaceholder")}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleInvite();
            }
          }}
          disabled={remaining <= 0 || addReferrals.isPending}
        />
        <Button
          type="button"
          onClick={handleInvite}
          disabled={remaining <= 0 || !input.trim() || addReferrals.isPending}
        >
          <SendIcon className="h-4 w-4" />
          <span>{addReferrals.isPending ? t("sending") : t("inviteButton")}</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("slotsRemaining", { count: remaining })}
      </p>

      {summary && summary.referrals.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("invitedTitle")}</p>
          <ul className="divide-y rounded-lg border">
            {summary.referrals.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <span className="truncate">{r.email}</span>
                <div className="flex shrink-0 items-center gap-1">
                  {r.status === "REGISTERED" ? (
                    <Badge className="gap-1 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
                      <CheckCircle2Icon className="h-3 w-3" />
                      {t("statusRegistered")}
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="secondary">{t("statusInvited")}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        title={t("removeTooltip")}
                        disabled={removeReferral.isPending}
                        onClick={async () => {
                          try {
                            await removeReferral.mutateAsync(r.id);
                          } catch (error) {
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : t("removeError"),
                            );
                          }
                        }}
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
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
