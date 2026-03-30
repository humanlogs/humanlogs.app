"use client";

import { useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCardIcon, CheckIcon, ClockIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";

type BillingInfo = {
  credits: number;
  creditsRefill: number;
  creditsUsed: number;
  plan: string;
  planDetails: {
    id: string;
    name: string;
    creditsRefill?: number;
    price: number;
  };
  subscription: {
    status: string | null;
    periodEnd: string | null;
    isActive: boolean;
  };
  hasStripeCustomer: boolean;
  lastCreditsRefill: string | null;
};

export default function BillingPage() {
  const t = useTranslations("account");
  const queryClient = useQueryClient();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data: billing, isLoading } = useQuery<BillingInfo>({
    queryKey: ["billing"],
    queryFn: async () => {
      const response = await fetch("/api/billing");
      if (!response.ok) {
        throw new Error("Failed to fetch billing info");
      }
      return response.json();
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planType: string) => {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType }),
      });
      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to cancel subscription");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing"] });
      setShowCancelConfirm(false);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/billing/customer-portal", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to create portal session");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const handleCheckout = (planType: string) => {
    checkoutMutation.mutate(planType);
  };

  const handleCancelSubscription = () => {
    cancelMutation.mutate();
  };

  const handleManageSubscription = () => {
    portalMutation.mutate();
  };

  if (isLoading) {
    return (
      <PageLayout
        title={t("billing.title")}
        description={t("billing.description")}
        maxWidth="max-w-6xl"
        className="p-6"
      >
        <div className="h-96 flex items-center justify-center">
          <p className="text-muted-foreground">{t("billing.loading")}</p>
        </div>
      </PageLayout>
    );
  }

  if (!billing) {
    return null;
  }

  const plans = [
    {
      id: "free",
      name: t("billing.plans.free.name"),
      price: t("billing.plans.free.price"),
      features: [
        t("billing.plans.free.features.0"),
        t("billing.plans.free.features.1"),
        t("billing.plans.free.features.2"),
      ],
      planType: null,
      isCurrent: billing.plan === "free",
    },
    {
      id: "monthly",
      name: t("billing.plans.monthly.name"),
      price: t("billing.plans.monthly.price"),
      features: [
        t("billing.plans.monthly.features.0"),
        t("billing.plans.monthly.features.1"),
        t("billing.plans.monthly.features.2"),
      ],
      planType: "monthly",
      isCurrent: billing.plan === "monthly",
    },
    {
      id: "yearly",
      name: t("billing.plans.yearly.name"),
      price: t("billing.plans.yearly.price"),
      billed: t("billing.plans.yearly.billed"),
      features: [
        t("billing.plans.yearly.features.0"),
        t("billing.plans.yearly.features.1"),
        t("billing.plans.yearly.features.2"),
        t("billing.plans.yearly.features.3"),
      ],
      planType: "yearly",
      isCurrent: billing.plan === "yearly",
    },
    {
      id: "one-time",
      name: t("billing.plans.one_time.name"),
      price: t("billing.plans.one_time.price"),
      features: [
        t("billing.plans.one_time.features.0"),
        t("billing.plans.one_time.features.1"),
        t("billing.plans.one_time.features.2"),
      ],
      planType: "one-time",
      isCurrent: false,
    },
  ];

  return (
    <PageLayout
      title={t("billing.title")}
      description={t("billing.description")}
      maxWidth="max-w-6xl"
      className="p-6"
    >
      {/* Current Plan & Credits */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="w-5 h-5" />
              {t("billing.current_plan")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-2xl font-bold">{billing.planDetails.name}</p>
              {billing.subscription.isActive && (
                <Badge variant="default" className="mt-2">
                  {t("billing.active")}
                </Badge>
              )}
              {billing.subscription.status === "canceled" && (
                <Badge variant="secondary" className="mt-2">
                  {t("billing.canceled")}
                </Badge>
              )}
            </div>

            {billing.subscription.periodEnd && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ClockIcon className="w-4 h-4" />
                <span>
                  {t("billing.next_renewal")}:{" "}
                  {new Date(
                    billing.subscription.periodEnd,
                  ).toLocaleDateString()}
                </span>
              </div>
            )}

            {billing.subscription.isActive && billing.plan !== "free" && (
              <div className="pt-4 border-t space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleManageSubscription}
                  disabled={portalMutation.isPending}
                >
                  {t("billing.manage_subscription")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelMutation.isPending}
                >
                  {t("billing.cancel_subscription")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("billing.credits")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                {t("billing.available_credits")}
              </p>
              <p className="text-3xl font-bold">
                {billing.credits} {t("billing.minutes")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("billing.credits_refill")}
                </p>
                <p className="text-lg font-semibold">
                  {billing.creditsRefill} {t("billing.minutes")}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("billing.credits_used")}
                </p>
                <p className="text-lg font-semibold">
                  {billing.creditsUsed} {t("billing.minutes")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Plans */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold text-foreground mb-6">
          {t("billing.plans.title")}
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "border rounded-lg p-8 hover:shadow-lg transition-shadow flex flex-col relative",
                plan.isCurrent && "border-2 border-blue-500",
                plan.id === "monthly" &&
                  !plan.isCurrent &&
                  "border-2 border-blue-500",
              )}
            >
              {plan.id === "monthly" && !plan.isCurrent && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-100 border-2 border-blue-500 text-blue-500 px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}
              {plan.isCurrent && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-green-100 border-2 border-green-500 text-green-600 px-4 py-1 rounded-full text-sm font-medium">
                  Current Plan
                </div>
              )}

              <h3 className="text-xl font-bold text-foreground mb-2">
                {plan.name}
              </h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-foreground">
                  {plan.price}
                </span>
                {plan.billed && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.billed}
                  </p>
                )}
              </div>

              {plan.planType && !plan.isCurrent && (
                <Button
                  className={cn(
                    "w-full mb-6",
                    plan.id === "monthly"
                      ? "bg-blue-500 hover:bg-blue-600"
                      : "border border-foreground bg-background hover:bg-accent",
                  )}
                  variant={plan.id === "monthly" ? "default" : "outline"}
                  onClick={() => handleCheckout(plan.planType!)}
                  disabled={checkoutMutation.isPending}
                >
                  {plan.id === "one-time"
                    ? t("billing.purchase")
                    : t("billing.subscribe")}
                </Button>
              )}
              {!plan.planType && plan.isCurrent && <div className="mb-6" />}

              <ul className="space-y-3 flex-grow">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle>{t("billing.cancel_confirm_title")}</CardTitle>
              <CardDescription>
                {t("billing.cancel_confirm_description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelConfirm(false)}
                disabled={cancelMutation.isPending}
              >
                {t("sidebar.user.logout") !== t("sidebar.user.logout")
                  ? "Cancel"
                  : "Cancel"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleCancelSubscription}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending
                  ? t("billing.canceling")
                  : t("billing.cancel_confirm")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
