"use client";

import { ExcerptExportButton } from "@/components/codebooks/excerpts/excerpt-export";
import {
  useExcerptPanel,
  useExcerptPanelContext,
} from "@/components/codebooks/excerpts/excerpt-panel-context";
import { useExcerptTable } from "@/components/codebooks/excerpts/use-excerpt-table";
import { useTranslations } from "@/components/locale-provider";
import { ProjectBadge } from "@/components/projects/project-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBetaFeatures, useProjects } from "@/hooks/use-api";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Suspense } from "react";

/**
 * Analysis: the excerpt table, full page, over one study.
 *
 * The same table the panel docks beside a transcript — the same hook, the same
 * state — with the width it never has there. That is the whole of analysis for
 * now, and deliberately so: the question a researcher asks at this stage is "what
 * did we say about this corpus", and the table already answers it. What changes is
 * that nothing else is on screen competing with it.
 *
 * A document named in the sidebar arrives here as `?document=`, and NARROWS the
 * table rather than opening anything: there is no analysis pass over a single
 * interview, only a corpus looked at through one.
 */
export default function StudyAnalysisPage() {
  return (
    // `useSearchParams` in a client page needs one, or the route cannot be
    // prerendered at build time.
    <Suspense fallback={null}>
      <StudyAnalysisContent />
    </Suspense>
  );
}

function StudyAnalysisContent() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const searchParams = useSearchParams();
  const documentId = searchParams.get("document");

  const t = useTranslations("codebook.analysis");
  const tBoard = useTranslations("codebook.board");
  const tStudy = useTranslations("study");
  const router = useRouter();

  const betaFeatures = useBetaFeatures();
  const { data: projects = [], isLoading } = useProjects();
  const { data: documents = [] } = useTranscriptions();
  const project = projects.find((p) => p.id === projectId);
  const focused = documents.find((doc) => doc.id === documentId);

  // The table reads the panel's context, so the page states where it is — with the
  // interview from the URL, when there is one. No codebook: analysis is not being
  // coded through one, it is reading every code already applied.
  useExcerptPanelContext({ documentId, projectId, codebookId: null });

  const panel = useExcerptPanel();
  const setFilter = panel.setFilter;

  /**
   * The scope follows the URL, both ways.
   *
   * Arriving with a document narrows the table to it; going back to the overview
   * widens it again. The second half is the one that has to be explicit: the
   * panel's own "a document just opened" rule only fires ON a document, so
   * leaving one would otherwise keep the table scoped to an interview the page is
   * no longer about.
   */
  React.useEffect(() => {
    setFilter((current) =>
      current.scope === (documentId ? "document" : "study")
        ? current
        : { ...current, scope: documentId ? "document" : "study" },
    );
  }, [documentId, setFilter]);

  const table = useExcerptTable({ enabled: !!betaFeatures && !!project });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // Codebooks are beta, and the table reads against them: without the opt-in this
  // page has nothing to show.
  if (!betaFeatures) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 py-12 text-center">
        <p className="text-muted-foreground">{tBoard("beta")}</p>
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
      <div className="mx-auto max-w-2xl space-y-4 p-6 py-12 text-center">
        <h1 className="text-2xl font-bold">{tStudy("notFound.title")}</h1>
        <Button variant="outline" onClick={() => router.push("/app")}>
          <ArrowLeftIcon className="h-4 w-4" />
          {tStudy("notFound.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
        <Link
          href={`/app/project/${projectId}`}
          className="flex shrink-0 items-center gap-2 hover:opacity-80"
        >
          <ProjectBadge
            appearance={project}
            projectId={project.id}
            name={project.name}
            size="sm"
            imageVersion={project.updatedAt}
          />
          <span className="font-medium">{project.name}</span>
        </Link>
        <span className="text-muted-foreground/60">/</span>
        <h1 className="font-semibold">{t("title")}</h1>
        {/* The interview the table is narrowed to, when there is one. Named here
            rather than only in the sidebar: the table's own rows say which
            document each passage comes from, so without this the page would not
            say why the others are missing. */}
        {focused && (
          <span className="truncate rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {focused.title}
          </span>
        )}
        <span className="text-xs text-muted-foreground tabular-nums">
          {table.total}
        </span>
        <span className="ml-auto" />
        <ExcerptExportButton disabled={table.total === 0} />
      </div>

      <p className="px-4 pt-3 text-sm text-muted-foreground">
        {t("description")}
      </p>

      <div className="flex-1">{table.node}</div>

      {table.footer}
    </div>
  );
}
