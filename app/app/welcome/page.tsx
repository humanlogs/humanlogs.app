"use client";

import {
  CheckCircleIcon,
  GlobeIcon,
  RocketIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useState } from "react";
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

type Step =
  | "select-language"
  | "profile"
  | "referral"
  | "residency"
  | "security"
  | "ready";

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

// Card wrapper shared by all steps for a consistent look
function StepCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950">
        {children}
      </div>
    </div>
  );
}

export default function WelcomePage() {
  const t = useTranslations("welcome");
  const { data } = useUserProfile();
  const updateUser = useUpdateUser();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<Step>("select-language");
  const { handleResetTutorial } = useResetTutorial();
  const { setLocale } = useLocale();

  // Local working copies for the profile + residency steps
  const [profession, setProfession] = useState<string>("");
  const [monthlyUsage, setMonthlyUsage] = useState<string>("");
  const [residency, setResidency] = useState<"eu" | "us">("eu");

  if (state === "select-language") {
    return (
      <StepCard>
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {data?.name
                ? t("title").replace("{name}", data.name)
                : t("titleDefault")}
            </h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
        </div>

        <div className="space-y-4">
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

          <Button
            disabled={loading || !data?.language}
            className="w-full"
            size="lg"
            onClick={() => setState("profile")}
          >
            {t("continue")}
          </Button>
        </div>
      </StepCard>
    );
  }

  if (state === "profile") {
    return (
      <StepCard>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("profileTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("profileSubtitle")}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("professionLabel")}
            </label>
            <Select
              value={profession}
              onChange={setProfession}
              placeholder={t("professionPlaceholder")}
              options={PROFESSION_KEYS.map((key) => ({
                value: key,
                label: t(`profession.${key}`),
              }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t("monthlyUsageLabel")}
            </label>
            <Select
              value={monthlyUsage}
              onChange={setMonthlyUsage}
              placeholder={t("monthlyUsagePlaceholder")}
              options={MONTHLY_USAGE_KEYS.map((key) => ({
                value: key,
                label: t(`monthlyUsage.${key}`),
              }))}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              size="lg"
              onClick={() => setState("referral")}
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
                  });
                  setState("referral");
                } catch (error) {
                  console.error("Error saving profile:", error);
                  setState("referral");
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
          onClick={() => setState("residency")}
        >
          {t("continue")}
        </Button>
      </StepCard>
    );
  }

  if (state === "residency") {
    const ResidencyOption = ({
      value,
      icon,
      title,
      description,
    }: {
      value: "eu" | "us";
      icon: React.ReactNode;
      title: string;
      description: string;
    }) => (
      <button
        type="button"
        onClick={() => setResidency(value)}
        className={`w-full text-left rounded-xl border p-4 transition-colors ${
          residency === value
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{title}</span>
              {residency === value && (
                <CheckCircleIcon className="h-4 w-4 text-primary" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
      </button>
    );

    return (
      <StepCard>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("residencyTitle")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("residencySubtitle")}</p>
        </div>

        <div className="space-y-3">
          <ResidencyOption
            value="eu"
            icon={<ShieldCheckIcon className="h-5 w-5 text-primary" />}
            title={t("residencyEuTitle")}
            description={t("residencyEuDesc")}
          />
          <ResidencyOption
            value="us"
            icon={<GlobeIcon className="h-5 w-5 text-primary" />}
            title={t("residencyUsTitle")}
            description={t("residencyUsDesc")}
          />
        </div>

        <Button
          disabled={loading}
          className="w-full"
          size="lg"
          onClick={async () => {
            setLoading(true);
            try {
              await updateUser.mutateAsync({ dataResidency: residency });
            } catch (error) {
              console.error("Error saving data residency:", error);
            } finally {
              setLoading(false);
              setState("security");
            }
          }}
        >
          {t("continue")}
        </Button>
      </StepCard>
    );
  }

  if (state === "security") {
    return (
      <SecurityStep
        userName={data?.name}
        onContinue={() => setState("ready")}
        onSkip={() => setState("ready")}
      />
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
