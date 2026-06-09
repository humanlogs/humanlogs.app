"use client";

import { useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import { ReferralEmails } from "@/components/referral/referral-emails";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GiftIcon } from "lucide-react";

export default function ReferralPage() {
  const t = useTranslations("referral");

  return (
    <PageLayout title={t("pageTitle")} description={t("pageDescription")}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GiftIcon className="h-5 w-5" />
            {t("cardTitle")}
          </CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ReferralEmails />
        </CardContent>
      </Card>
    </PageLayout>
  );
}
