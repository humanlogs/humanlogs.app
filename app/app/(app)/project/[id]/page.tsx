"use client";

import { CodebookSection } from "@/components/codebooks/codebook-section";
import { useProjectModal } from "@/components/dialogs/project-create-modal";
import { GuideCallout } from "@/components/guidance/guide-callout";
import { useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import { ProjectBadge } from "@/components/projects/project-badge";
import { DocumentList } from "@/components/transcriptions/document-list";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBetaFeatures, useProjects } from "@/hooks/use-api";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import { ArrowLeftIcon, PlusIcon, Settings2Icon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";

export default function StudyPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const t = useTranslations("study");
  const router = useRouter();
  const { openRename } = useProjectModal();

  const betaFeatures = useBetaFeatures();
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const { data: transcriptions = [], isLoading: isLoadingTranscriptions } =
    useTranscriptions();

  const project = projects.find((p) => p.id === projectId);
  const documents = React.useMemo(
    () =>
      transcriptions
        .filter((tr) => tr.projectId === projectId && tr.isOwner !== false)
        .sort((a, b) =>
          a.title.localeCompare(b.title, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [transcriptions, projectId],
  );

  const goImport = () => router.push(`/app/new?projectId=${projectId}`);

  if (isLoadingProjects) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-4 py-12">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto max-w-4xl space-y-4 p-4 py-12 text-center">
        <h1 className="text-2xl font-bold">{t("notFound.title")}</h1>
        <p className="text-muted-foreground">{t("notFound.description")}</p>
        <Button variant="outline" onClick={() => router.push("/app")}>
          <ArrowLeftIcon className="h-4 w-4" />
          {t("notFound.back")}
        </Button>
      </div>
    );
  }

  // The study's badge sits to the left of its name; the name is edited from the
  // settings dialog (opened by the action button), not inline.
  const titleNode = (
    <span className="inline-flex items-center gap-3">
      <ProjectBadge
        appearance={project}
        projectId={project.id}
        name={project.name}
        size="lg"
        imageVersion={project.updatedAt}
      />
      <span>{project.name}</span>
    </span>
  );

  return (
    <PageLayout
      backHref="/app"
      backLabel={t("backHome")}
      title={titleNode}
      action={
        <div className="flex items-center gap-2">
          <Button onClick={goImport}>
            <PlusIcon className="h-4 w-4" />
            {t("addDocument")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => openRename(project.id, project.name)}
            aria-label={t("settings")}
          >
            <Settings2Icon className="h-4 w-4" />
          </Button>
        </div>
      }
      maxWidth="max-w-4xl"
    >
      {/* Documents */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("documents.title", { count: documents.length })}
        </h2>

        {isLoadingTranscriptions ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <GuideCallout
            icon={<PlusIcon className="h-5 w-5" />}
            title={t("empty.title")}
            description={t("empty.description")}
            action={{
              label: t("empty.action"),
              onClick: goImport,
              icon: <PlusIcon className="h-4 w-4" />,
            }}
          />
        ) : (
          <DocumentList documents={documents} />
        )}
      </section>

      {/* Codebooks available from this study. Still beta, so it only shows for
          users who opted in from /app/account. Hidden until the study holds a
          document too — there is nothing to code before that. */}
      {betaFeatures && documents.length > 0 && (
        <CodebookSection projectId={projectId} />
      )}
    </PageLayout>
  );
}
