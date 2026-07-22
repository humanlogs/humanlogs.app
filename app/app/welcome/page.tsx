"use client";

import { CheckCircleIcon, GlobeIcon, RocketIcon, ShieldCheckIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useResetTutorial } from "../../../components/dialogs/help-dialog";
import {
  useLocale,
  useTranslations,
} from "../../../components/locale-provider";
import { ReferralEmails } from "../../../components/referral/referral-emails";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { OnboardingShell } from "../../../components/welcome/onboarding-shell";
import type { OnboardingBgVariant } from "../../../components/welcome/onboarding-backgrounds";
import { SecurityStep } from "../../../components/welcome/security-step";
import { WelcomeHero } from "../../../components/welcome/welcome-hero";
import { useUpdateUser, useUserProfile } from "../../../hooks/use-api";
import type { OnboardingStep } from "../../../hooks/use-api";
import { languagesNames, Locale, locales } from "../../../lib/utils/i18n";
import { cn } from "@/lib/utils/utils";

type Step = "profile" | "security" | "referral" | "ready";

// Step order drives both the routing and the stepper progress indicator.
const STEP_ORDER: Step[] = ["profile", "security", "referral", "ready"];

const PROFESSION_KEYS = [
  "researcher",
  "phdStudent",
  "journalist",
  "podcaster",
  "lawyer",
  "healthcare",
  "uxResearcher",
  "student",
  "other",
];

const MONTHLY_USAGE_KEYS = ["lt1h", "h1to5", "h5to20", "gt20h"];

function GridOption({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        `rounded-lg border p-3 text-sm text-center transition-colors ${
          selected
            ? "border-primary bg-primary/5 font-medium"
            : "border-border hover:border-primary/50"
        }`,
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function WelcomePage() {
  const t = useTranslations("welcome");
  const { data } = useUserProfile();
  const updateUser = useUpdateUser();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<Step>("profile");
  const { handleResetTutorial } = useResetTutorial();
  const { setLocale } = useLocale();

  const [profession, setProfession] = useState<string>("");
  const [monthlyUsage, setMonthlyUsage] = useState<string>("");
  const [residency, setResidency] = useState<"eu" | "us">("eu");
  // Optional background override via ?bg=aurora|warm|minimal (design preview).
  // Read from the URL directly to avoid a Suspense boundary for useSearchParams.
  const [bgOverride, setBgOverride] = useState<OnboardingBgVariant | undefined>(
    undefined,
  );
  useEffect(() => {
    const bg = new URLSearchParams(window.location.search).get("bg");
    if (bg === "aurora" || bg === "warm" || bg === "minimal") {
      setBgOverride(bg);
    }
  }, []);

  useEffect(() => {
    if (data?.dataResidency === "eu" || data?.dataResidency === "us") {
      setResidency(data.dataResidency);
    }
  }, [data?.dataResidency]);

  // Move to a step and record it server-side so we can measure exactly where
  // users drop off in the onboarding funnel (surfaced in the admin panel).
  const goTo = useCallback(
    (next: Step) => {
      setState(next);
      updateUser.mutate({ onboardingStep: next as OnboardingStep });
    },
    [updateUser],
  );

  const stepIndex = STEP_ORDER.indexOf(state);

  if (state === "profile") {
    return (
      <OnboardingShell step={stepIndex} stepCount={STEP_ORDER.length} bgVariant={bgOverride} wide>
        <WelcomeHero name={data?.name} />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("personalize")}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-5">
          {/* Language */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("languageLabel")}
            </label>
            <Select
              value={data?.language as Locale}
              onChange={async (value) => {
                setLoading(true);
                try {
                  setLocale(value as Locale);
                  await updateUser.mutateAsync({ language: value });
                } catch (error) {
                  console.error("Error saving language:", error);
                  toast.error(t("errorSavingLanguage"));
                } finally {
                  setLoading(false);
                }
              }}
              options={locales.map((locale) => ({
                value: locale,
                label: (languagesNames as any)[locale],
              }))}
            />
          </div>

          {/* Server / data residency — only shown when both EU and US providers are configured */}
          {!!data?.availableSttProviders?.eu &&
            !!data?.availableSttProviders?.us && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {t("residencyTitle")}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setResidency("eu")}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      residency === "eu"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheckIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm">
                        {t("residencyEuTitle")}
                      </span>
                      {residency === "eu" && (
                        <CheckCircleIcon className="h-3.5 w-3.5 text-primary ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("residencyEuDesc")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setResidency("us")}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      residency === "us"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <GlobeIcon className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm">
                        {t("residencyUsTitle")}
                      </span>
                      {residency === "us" && (
                        <CheckCircleIcon className="h-3.5 w-3.5 text-primary ml-auto" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("residencyUsDesc")}
                    </p>
                  </button>
                </div>
              </div>
            )}

          {/* Profession */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("professionLabel")}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROFESSION_KEYS.map((key) => (
                <GridOption
                  key={key}
                  selected={profession === key}
                  onClick={() => setProfession(key)}
                  className="capitalize min-h-16"
                >
                  {t(`profession.${key}`)}
                </GridOption>
              ))}
            </div>
          </div>

          {/* Monthly usage */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("monthlyUsageLabel")}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {MONTHLY_USAGE_KEYS.map((key) => (
                <GridOption
                  key={key}
                  selected={monthlyUsage === key}
                  onClick={() => setMonthlyUsage(key)}
                >
                  {t(`monthlyUsage.${key}`)}
                </GridOption>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={() => goTo("security")}
            >
              {t("skip")}
            </Button>
            <Button
              disabled={loading}
              className="flex-1"
              size="lg"
              onClick={async () => {
                setLoading(true);
                try {
                  await updateUser.mutateAsync({
                    ...(profession && { profession }),
                    ...(monthlyUsage && { monthlyUsage }),
                    dataResidency: residency,
                    onboardingStep: "security",
                  });
                } catch (error) {
                  console.error("Error saving profile:", error);
                } finally {
                  setLoading(false);
                  setState("security");
                }
              }}
            >
              {t("continue")}
            </Button>
          </div>
        </div>
      </OnboardingShell>
    );
  }

  if (state === "security") {
    return (
      <OnboardingShell step={stepIndex} stepCount={STEP_ORDER.length} bgVariant={bgOverride}>
        <SecurityStep
          userName={data?.name}
          onContinue={() => goTo("referral")}
          onSkip={() => goTo("referral")}
        />
      </OnboardingShell>
    );
  }

  if (state === "referral") {
    return (
      <OnboardingShell step={stepIndex} stepCount={STEP_ORDER.length} bgVariant={bgOverride}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("referralTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("referralSubtitle")}</p>
        </div>

        <ReferralEmails />

        <Button className="w-full" size="lg" onClick={() => goTo("ready")}>
          {t("continue")}
        </Button>
      </OnboardingShell>
    );
  }

  if (state === "ready") {
    return (
      <OnboardingShell step={stepIndex} stepCount={STEP_ORDER.length} bgVariant={bgOverride}>
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-green-100 dark:bg-green-950 p-3">
            <RocketIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("allSetTitle")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("allSetSubtitle")}</p>
          </div>
        </div>

        <div className="space-y-3 py-2">
          <div className="flex items-start gap-3 text-sm">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">
              {t("accountConfigured")}
            </span>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{t("firstProject")}</span>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">{t("learnFeatures")}</span>
          </div>
        </div>

        <Button
          disabled={loading}
          className="w-full"
          size="lg"
          onClick={async () => {
            setLoading(true);
            try {
              await updateUser.mutateAsync({ isWelcomeDone: true });
              await handleResetTutorial(data?.language || "en");
            } catch (err) {
              console.error("Error completing welcome:", err);
              toast.error(t("setupError"));
            } finally {
              setLoading(false);
            }
          }}
        >
          <RocketIcon className="w-4 h-4 mr-2" />
          {loading ? t("starting") : t("startTutorial")}
        </Button>
      </OnboardingShell>
    );
  }

  return null;
}
