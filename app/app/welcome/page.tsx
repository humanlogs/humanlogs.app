"use client";

import {
  CheckCircleIcon,
  GlobeIcon,
  RocketIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useResetTutorial } from "../../../components/dialogs/help-dialog";
import {
  useLocale,
  useTranslations,
} from "../../../components/locale-provider";
import { ReferralEmails } from "../../../components/referral/referral-emails";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";
import { SecurityStep } from "../../../components/welcome/security-step";
import { useUpdateUser, useUserProfile } from "../../../hooks/use-api";
import { languagesNames, Locale, locales } from "../../../lib/utils/i18n";

type Step = "profile" | "security" | "referral" | "ready";

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

function StepCard({
  children,
  wide,
}: {
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
      <div
        className={`w-full space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950 ${wide ? "max-w-lg" : "max-w-md"}`}
      >
        {children}
      </div>
    </div>
  );
}

function GridOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-sm text-center transition-colors ${
        selected
          ? "border-primary bg-primary/5 font-medium"
          : "border-border hover:border-primary/50"
      }`}
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

  useEffect(() => {
    if (data?.dataResidency === "eu" || data?.dataResidency === "us") {
      setResidency(data.dataResidency);
    }
  }, [data?.dataResidency]);

  if (state === "profile") {
    return (
      <StepCard wide>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {data?.name
              ? t("title").replace("{name}", data.name)
              : t("titleDefault")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("profileSubtitle")}</p>
        </div>

        <div className="space-y-5">
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
            <div className="grid grid-cols-2 gap-2">
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

          {/* Server / data residency */}
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

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={() => setState("security")}
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
                  });
                  setState("security");
                } catch (error) {
                  console.error("Error saving profile:", error);
                  setState("security");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {t("continue")}
            </Button>
          </div>
        </div>
      </StepCard>
    );
  }

  if (state === "security") {
    return (
      <SecurityStep
        userName={data?.name}
        onContinue={() => setState("referral")}
        onSkip={() => setState("referral")}
      />
    );
  }

  if (state === "referral") {
    return (
      <StepCard>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("referralTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("referralSubtitle")}</p>
        </div>

        <ReferralEmails />

        <Button
          className="w-full"
          size="lg"
          onClick={() => setState("ready")}
        >
          {t("continue")}
        </Button>
      </StepCard>
    );
  }

  if (state === "ready") {
    return (
      <StepCard>
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
      </StepCard>
    );
  }

  return null;
}
