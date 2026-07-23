"use client";

import { GuideCallout } from "@/components/guidance/guide-callout";
import { useLocale, useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-api";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  FileIcon,
  LoaderIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

export default function StudyPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const t = useTranslations("study");
  const { locale } = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();
  const { data: transcriptions = [], isLoading: isLoadingTranscriptions } =
    useTranscriptions();

  const project = projects.find((p) => p.id === projectId);
  const documents = React.useMemo(
    () =>
      transcriptions
        .filter((tr) => tr.projectId === projectId && tr.isOwner !== false)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [transcriptions, projectId],
  );

  // Inline-editable title.
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState("");
  const [isSavingTitle, setIsSavingTitle] = React.useState(false);

  const startEditingTitle = () => {
    if (!project) return;
    setTitleDraft(project.name);
    setIsEditingTitle(true);
  };

  const saveTitle = async () => {
    const name = titleDraft.trim();
    if (!name || !project || name === project.name) {
      setIsEditingTitle(false);
      setTitleDraft(project?.name ?? "");
      return;
    }
    setIsSavingTitle(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      toast.success(t("titleSaved"));
      setIsEditingTitle(false);
    } catch {
      toast.error(t("titleError"));
    } finally {
      setIsSavingTitle(false);
    }
  };

  const goImport = () => router.push(`/app/new?projectId=${projectId}`);

  if (isLoadingProjects) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-4 py-12">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // The heading is the (inline-editable) study name. Form controls don't inherit
  // typography, so the input/button keep explicit heading styles even though
  // they render inside the PageHeader <h1>.
  const titleNode =
    project && isEditingTitle ? (
      <span className="inline-flex items-center gap-2">
        <input
          autoFocus
          value={titleDraft}
          disabled={isSavingTitle}
          onChange={(e) => setTitleDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveTitle();
            if (e.key === "Escape") {
              setIsEditingTitle(false);
              setTitleDraft(project.name);
            }
          }}
          onBlur={saveTitle}
          className="border-b border-input bg-transparent text-3xl font-bold tracking-tight outline-none focus:border-primary"
        />
        <Button
          size="icon"
          variant="ghost"
          disabled={isSavingTitle}
          onMouseDown={(e) => e.preventDefault()}
          onClick={saveTitle}
          aria-label={t("saveTitle")}
        >
          <CheckIcon className="h-4 w-4" />
        </Button>
      </span>
    ) : (
      <button
        type="button"
        onClick={startEditingTitle}
        className="rounded-md text-left text-3xl font-bold tracking-tight hover:opacity-80"
        title={t("editTitle")}
      >
        {project?.name}
      </button>
    );

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

  return (
    <PageLayout
      backHref="/app"
      backLabel={t("backHome")}
      title={titleNode}
      action={
        <Button onClick={goImport}>
          <PlusIcon className="h-4 w-4" />
          {t("addDocument")}
        </Button>
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
          <ul className="divide-y rounded-xl border">
            {documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/app/transcription/${doc.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
                >
                  <DocumentStateIcon state={doc.state} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {doc.title || t("documents.untitled")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("documents.updatedAt", {
                        date: new Date(doc.updatedAt).toLocaleDateString(
                          locale,
                        ),
                      })}
                    </p>
                  </div>
                  <SpeakerSummary
                    speakerCount={doc.speakerCount}
                    speakerNames={doc.speakerNames}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}

function DocumentStateIcon({
  state,
}: {
  state: "PENDING" | "COMPLETED" | "ERROR";
}) {
  if (state === "PENDING")
    return (
      <LoaderIcon
        className="h-5 w-5 shrink-0 animate-spin text-muted-foreground"
        style={{ animationDuration: "5s" }}
      />
    );
  if (state === "ERROR")
    return <AlertCircleIcon className="h-5 w-5 shrink-0 text-red-500" />;
  return <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />;
}

/**
 * Shows the document's speakers on the right of a row: their names when the
 * panel is small (fewer than 4 speakers and names are available), otherwise a
 * plain count. Names come from the transcription content and are absent for
 * E2E-encrypted documents, in which case we fall back to the count.
 */
function SpeakerSummary({
  speakerCount,
  speakerNames,
}: {
  speakerCount?: number;
  speakerNames?: (string | null)[];
}) {
  const count = speakerCount ?? 0;
  const names = (speakerNames ?? []).filter((n): n is string => !!n);
  const showNames = count > 0 && count < 4 && names.length > 0;
  const label = showNames ? names.join(", ") : count > 0 ? String(count) : null;

  if (!label) return null;

  return (
    <span className="hidden max-w-[45%] items-center gap-1.5 text-xs text-muted-foreground sm:flex">
      <UsersIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
