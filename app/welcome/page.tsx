"use client";

import { CheckCircleIcon, RocketIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useResetTutorial } from "../../components/dialogs/help-dialog";
import { useLocale, useTranslations } from "../../components/locale-provider";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { SecurityStep } from "../../components/welcome/security-step";
import { useUpdateUser, useUserProfile } from "../../hooks/use-api";
import { Locale, locales } from "../../lib/i18n";

export default function WelcomePage() {
  const t = useTranslations("welcome");
  const { data } = useUserProfile();
  const updateLanguage = useUpdateUser();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<"select-language" | "security" | "ready">(
    "select-language",
  );
  const { handleResetTutorial } = useResetTutorial();
  const { setLocale } = useLocale();

  if (state === "select-language") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950">
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
                    await updateLanguage.mutateAsync({ language: value });
                  } catch (error) {
                    console.error("Error saving language:", error);
                    toast.error(t("errorSavingLanguage"));
                  } finally {
                    setLoading(false);
                  }
                }}
                options={locales.map((locale) => ({
                  value: locale,
                  label: t("languages." + locale),
                }))}
              />
            </div>

            <Button
              disabled={loading}
              className="w-full"
              size="lg"
              onClick={() => setState("security")}
            >
              {t("continue")}
            </Button>
          </div>
        </div>
      </div>
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-green-100 dark:bg-green-950 p-3">
              <RocketIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {t("allSetTitle")}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t("allSetSubtitle")}
              </p>
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
              <span className="text-muted-foreground">
                {t("learnFeatures")}
              </span>
            </div>
          </div>

          <Button
            disabled={loading}
            className="w-full"
            size="lg"
            onClick={async () => {
              setLoading(true);
              try {
                await updateLanguage.mutateAsync({ isWelcomeDone: true });
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
        </div>
      </div>
    );
  }

  return null;
}
