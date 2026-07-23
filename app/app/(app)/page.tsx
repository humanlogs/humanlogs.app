"use client";

import { GuideCallout } from "@/components/guidance/guide-callout";
import { useResetTutorial } from "@/components/dialogs/help-dialog";
import { useProjectModal } from "@/components/dialogs/project-create-modal";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects, useUserProfile } from "@/hooks/use-api";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import {
  ArrowRightIcon,
  FolderIcon,
  FolderPlusIcon,
  GraduationCapIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { twMerge } from "tailwind-merge";

export default function HomePage() {
  const t = useTranslations("home");
  const router = useRouter();
  const { locale } = useLocale();
  const { data: user, isLoading: isLoadingUser } = useUserProfile();
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const { data: transcriptions = [], isLoading: isLoadingTranscriptions } =
    useTranscriptions();
  const { openCreate } = useProjectModal();
  const { isResettingTutorial, handleResetTutorial } = useResetTutorial();

  // Pick one welcome-back greeting per mount (the (app) template re-mounts on
  // each navigation, so it varies as you come and go). Random in the state
  // initializer is fine here: it's only read once the profile has loaded, well
  // after hydration, so it never lands in the server-rendered HTML.
  const WELCOME_BACK_COUNT = 4;
  const [greetingIndex] = React.useState(() =>
    Math.floor(Math.random() * WELCOME_BACK_COUNT),
  );

  // Number of owned documents per study, to enrich the study cards.
  const docCountByProject = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const tr of transcriptions) {
      if (tr.projectId && tr.isOwner !== false) {
        counts.set(tr.projectId, (counts.get(tr.projectId) ?? 0) + 1);
      }
    }
    return counts;
  }, [transcriptions]);

  // Creating a study only asks for a name, then drops the user into the study
  // page where they import their audios.
  const handleCreateStudy = () => {
    openCreate((projectId) => router.push(`/app/project/${projectId}`));
  };

  const handleLaunchTutorial = () => {
    handleResetTutorial(locale || "en");
  };

  const hasNoStudies = projects.length === 0;

  // The onboarding shortcuts (create a study / launch the tutorial) are only
  // useful early on. Keep them while the user still has nothing set up, or for
  // the first week after signup; hide them for established accounts.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isNewAccount = user?.createdAt
    ? Date.now() - new Date(user.createdAt).getTime() < SEVEN_DAYS_MS
    : false;
  const showOnboardingActions =
    hasNoStudies || transcriptions.length === 0 || isNewAccount;

  // Wait for the profile + lists before painting: rendering with the empty
  // defaults and then swapping once the backend answers is what made the page
  // jump. React Query's isLoading is only true on the first, uncached fetch, so
  // subsequent visits render instantly from cache.
  const isLoading =
    isLoadingUser || isLoadingProjects || isLoadingTranscriptions;

  if (isLoading) {
    return (
      <PageLayout
        title={<Skeleton className="h-9 w-72 max-w-full" />}
        maxWidth="max-w-4xl"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </PageLayout>
    );
  }

  const title = !user?.name
    ? t("title")
    : showOnboardingActions
      ? t("titleNamed", { name: user.name })
      : t(`welcomeBack.${greetingIndex}`, { name: user.name });

  return (
    <PageLayout
      title={title}
      description={showOnboardingActions ? t("subtitle") : undefined}
      action={
        !hasNoStudies ? (
          <Button onClick={handleCreateStudy}>
            <PlusIcon className="h-4 w-4" />
            {t("studies.new")}
          </Button>
        ) : undefined
      }
      maxWidth="max-w-4xl"
    >
      {hasNoStudies && (
        <GuideCallout
          icon={<UploadIcon className="h-5 w-5" />}
          title={t("callout.title")}
          description={t("callout.description")}
          action={{
            label: t("callout.action"),
            onClick: handleCreateStudy,
            icon: <FolderPlusIcon className="h-4 w-4" />,
          }}
        />
      )}

      {showOnboardingActions && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ActionCard
            icon={<FolderPlusIcon className="h-5 w-5" />}
            iconClassName="bg-pink-500"
            title={t("createStudy.title")}
            description={t("createStudy.description")}
            onClick={handleCreateStudy}
            emphasized
          />
          <ActionCard
            icon={<GraduationCapIcon className="h-5 w-5" />}
            iconClassName="bg-primary/20"
            title={t("tutorial.title")}
            description={
              isResettingTutorial
                ? t("tutorial.loading")
                : t("tutorial.description")
            }
            onClick={handleLaunchTutorial}
            disabled={isResettingTutorial}
          />
        </div>
      )}

      {!hasNoStudies && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-medium text-muted-foreground">
            {t("studies.title", { count: projects.length })}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <Link key={project.id} href={`/app/project/${project.id}`}>
                <Card className="group flex items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500 text-white">
                    <FolderIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("studies.documentCount", {
                        count: docCountByProject.get(project.id) ?? 0,
                      })}
                    </p>
                  </div>
                  <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </PageLayout>
  );
}

function ActionCard({
  icon,
  iconClassName,
  title,
  description,
  onClick,
  emphasized,
  disabled,
}: {
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  description: string;
  onClick: () => void;
  emphasized?: boolean;
  disabled?: boolean;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={[
        "group flex cursor-pointer flex-col p-6 transition-all hover:-translate-y-0.5 hover:shadow-sm",
        emphasized
          ? "border-primary/30 bg-primary/[0.03] hover:border-primary/50"
          : "hover:border-primary/40 hover:bg-accent/40",
        disabled ? "pointer-events-none opacity-70" : "",
      ].join(" ")}
    >
      <div
        className={twMerge(
          "flex h-11 w-11 items-center justify-center rounded-xl text-white",
          iconClassName,
        )}
      >
        {icon}
      </div>
      <div className="mt-4 space-y-1">
        <h2 className="flex items-center gap-1 text-lg font-semibold tracking-tight">
          {title}
          <ArrowRightIcon className="h-4 w-4 opacity-0 -translate-x-1 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Card>
  );
}
