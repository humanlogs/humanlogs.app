"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useResetTutorial } from "../../../components/dialogs/help-dialog";
import {
  useLocale,
  useTranslations,
} from "../../../components/locale-provider";
import { AnimateHeight } from "@/components/ui/animate-height";
import { InlineChoice } from "@/components/ui/inline-choice";
import type { AmbientBgVariant } from "@/components/ui/ambient-background";
import { OnboardingShell } from "../../../components/welcome/onboarding-shell";
import { EngageStep } from "../../../components/welcome/engage-step";
import { ProvisioningStep } from "../../../components/welcome/provisioning-step";
import { RoleStep } from "../../../components/welcome/role-step";
import {
  hoursPreset,
  residencyPreset,
  roleBucket,
} from "../../../components/welcome/onboarding-roles";
import { SecurityStep } from "../../../components/welcome/security-step";
import { WELCOME_INTRO_FLAG } from "../../../components/welcome/welcome-intro";
import { useUpdateUser, useUserProfile } from "../../../hooks/use-api";
import type { OnboardingStep } from "../../../hooks/use-api";
import { GlobeIcon } from "lucide-react";
import { languagesNames, Locale, locales } from "../../../lib/utils/i18n";

type Step = "role" | "engage" | "provisioning" | "security";

// Step order drives both the routing and the stepper progress indicator.
const STEP_ORDER: Step[] = ["role", "engage", "provisioning", "security"];

export default function WelcomePage() {
  const t = useTranslations("welcome");
  const { data } = useUserProfile();
  const updateUser = useUpdateUser();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<Step>("role");
  const { handleResetTutorial } = useResetTutorial();
  const { locale, setLocale } = useLocale();

  const [profession, setProfession] = useState<string>("");
  const [monthlyUsage, setMonthlyUsage] = useState<string>("h1to5");
  const [residency, setResidency] = useState<"eu" | "us">("eu");

  // Optional background override via ?bg=aurora|warm|minimal (design preview).
  const [bgOverride, setBgOverride] = useState<AmbientBgVariant | undefined>(
    undefined,
  );
  useEffect(() => {
    const bg = new URLSearchParams(window.location.search).get("bg");
    if (bg === "aurora" || bg === "warm" || bg === "minimal") setBgOverride(bg);
  }, []);

  // Seed from any previously saved onboarding data (returning user).
  useEffect(() => {
    if (data?.profession) setProfession(data.profession);
    if (data?.monthlyUsage) setMonthlyUsage(data.monthlyUsage);
    if (data?.dataResidency === "eu" || data?.dataResidency === "us") {
      setResidency(data.dataResidency);
    }
  }, [data?.profession, data?.monthlyUsage, data?.dataResidency]);

  // Record arrival at the onboarding once, so the admin funnel can tell users
  // who opened it apart from those who bounced right after signup.
  const recordedArrival = useRef(false);
  useEffect(() => {
    if (data?.id && !recordedArrival.current) {
      recordedArrival.current = true;
      updateUser.mutate({ onboardingStep: "role" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.id]);

  const stepIndex = STEP_ORDER.indexOf(state);
  const showResidency =
    !!data?.availableSttProviders?.eu && !!data?.availableSttProviders?.us;

  // Selecting a role applies smart presets for residency and volume.
  function applyRole(prof: string) {
    setProfession(prof);
    setResidency(residencyPreset(prof, locale));
    setMonthlyUsage(hoursPreset(prof));
  }

  async function changeLanguage(next: Locale) {
    setLocale(next);
    // Re-derive the residency preset for the new language (unless the user
    // already picked a role and overrode it — presets only run on role select).
    try {
      await updateUser.mutateAsync({ language: next });
    } catch (error) {
      console.error("Error saving language:", error);
    }
  }

  async function goToEngage() {
    setLoading(true);
    try {
      await updateUser.mutateAsync({
        ...(profession && { profession }),
        ...(monthlyUsage && { monthlyUsage }),
        dataResidency: residency,
        onboardingStep: "engage",
      });
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setLoading(false);
      setState("engage");
    }
  }

  function goToProvisioning() {
    updateUser.mutate({ onboardingStep: "provisioning" as OnboardingStep });
    setState("provisioning");
  }

  function goToSecurity() {
    updateUser.mutate({ onboardingStep: "security" });
    setState("security");
  }

  // Step back to an earlier, user-actionable step (provisioning is transient).
  function goBack(target: Step) {
    updateUser.mutate({ onboardingStep: target as OnboardingStep });
    setState(target);
  }

  async function finishOnboarding() {
    setLoading(true);
    try {
      await updateUser.mutateAsync({ isWelcomeDone: true });
      // Ask the app to play its zoom-in entrance once we land there.
      try {
        sessionStorage.setItem(WELCOME_INTRO_FLAG, "1");
      } catch {
        // Non-fatal: the app just won't play the entrance.
      }
      // Navigates to the tutorial transcription (no conclusion screen).
      await handleResetTutorial(locale || "en");
    } catch (err) {
      console.error("Error completing welcome:", err);
      toast.error(t("setupError"));
      setLoading(false);
    }
  }

  const languageSwitcher = (
    <InlineChoice
      value={locale}
      align="right"
      icon={<GlobeIcon className="h-3.5 w-3.5" />}
      onChange={(v) => changeLanguage(v as Locale)}
      options={locales.map((l) => ({
        value: l,
        label: (languagesNames as Record<string, string>)[l],
      }))}
    />
  );

  const stepContent =
    state === "role" ? (
      <RoleStep
        name={data?.name}
        profession={profession}
        onSelectProfession={applyRole}
        residency={residency}
        onResidencyChange={setResidency}
        monthlyUsage={monthlyUsage}
        onMonthlyUsageChange={setMonthlyUsage}
        showResidency={showResidency}
        onContinue={goToEngage}
        loading={loading}
      />
    ) : state === "engage" ? (
      <EngageStep
        bucket={roleBucket(profession)}
        userEmail={data?.email}
        isBillingEnabled={!!data?.isBillingEnabled}
        onContinue={goToProvisioning}
      />
    ) : state === "provisioning" ? (
      <ProvisioningStep onDone={goToSecurity} />
    ) : (
      <SecurityStep
        userName={data?.name}
        onContinue={finishOnboarding}
        onSkip={finishOnboarding}
      />
    );

  // Provisioning is a transient auto-advance step, so no back from it.
  const onBack =
    state === "engage"
      ? () => goBack("role")
      : state === "security"
        ? () => goBack("engage")
        : undefined;

  return (
    <OnboardingShell
      step={stepIndex}
      stepCount={STEP_ORDER.length}
      bgVariant={bgOverride}
      topRight={languageSwitcher}
      onBack={onBack}
      wide
    >
      {/* One persistent card; height eases between steps and sub-block reveals. */}
      <AnimateHeight>
        <div key={state} className="space-y-6">
          {stepContent}
        </div>
      </AnimateHeight>
    </OnboardingShell>
  );
}
