"use client";

import { StudyCodingBoard } from "@/components/codebooks/study-coding-board";
import { useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import { ProjectBadge } from "@/components/projects/project-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBetaFeatures, useProjects } from "@/hooks/use-api";
import { ArrowLeftIcon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

/**
 * Coding pass over a whole study. A page of its own rather than a section of
 * the study page: it is a working screen you stay on for a while, and it wants
 * the full height.
 */
export default function StudyCodingPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const t = useTranslations("codebook.board");
  const tStudy = useTranslations("study");
  const router = useRouter();

  const betaFeatures = useBetaFeatures();
  const { data: projects = [], isLoading } = useProjects();
  const project = projects.find((p) => p.id === projectId);

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-4 py-12">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Codebooks are beta: without the opt-in this page has nothing to show, so it
  // sends the visitor back to the study rather than rendering an empty board.
  if (!betaFeatures) {
    return (
      <div className="container mx-auto max-w-4xl space-y-4 p-4 py-12 text-center">
        <p className="text-muted-foreground">{t("beta")}</p>
        <Button
          variant="outline"
          onClick={() => router.push(`/app/project/${projectId}`)}
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {project?.name ?? tStudy("notFound.back")}
        </Button>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container mx-auto max-w-4xl space-y-4 p-4 py-12 text-center">
        <h1 className="text-2xl font-bold">{tStudy("notFound.title")}</h1>
        <Button variant="outline" onClick={() => router.push("/app")}>
          <ArrowLeftIcon className="h-4 w-4" />
          {tStudy("notFound.back")}
        </Button>
      </div>
    );
  }

  return (
    <PageLayout
      backHref={`/app/project/${projectId}`}
      backLabel={project.name}
      title={
        <span className="inline-flex items-center gap-3">
          <ProjectBadge
            appearance={project}
            projectId={project.id}
            name={project.name}
            size="lg"
            imageVersion={project.updatedAt}
          />
          <span>{t("title")}</span>
        </span>
      }
      description={t("description")}
      maxWidth="max-w-4xl"
    >
      <StudyCodingBoard projectId={projectId} />
    </PageLayout>
  );
}
