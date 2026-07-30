"use client";

import { CannotAccessTranscription } from "@/components/encryption";
import { DocumentPhaseSwitch } from "@/components/transcriptions/document-phase-switch";
import {
  parseDocumentPhase,
  type DocumentPhase,
} from "@/components/transcriptions/editor/phase";
import { TranscriptionActions } from "@/components/transcriptions/transcription-actions";
import { TranscriptionEditor } from "@/components/transcriptions/transcription-editor";
import { TranscriptionFailed } from "@/components/transcriptions/transcription-failed";
import { TranscriptionLoading } from "@/components/transcriptions/transcription-loading";
import { ProjectBadge } from "@/components/projects/project-badge";
import { useBetaFeatures, useProjects } from "@/hooks/use-api";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useEncryptionStatus } from "@/hooks/use-encryption";
import { useTranscription, useTranscriptions } from "@/hooks/use-transcriptions";
import { useTranscriptionDeleteModal } from "@/components/transcriptions/dialogs/transcription-delete-dialog";
import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, use, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useTranscriptionRenameModal } from "../../../../../components/transcriptions/dialogs/transcription-rename-dialog";
import { Button } from "../../../../../components/ui/button";
import { SaveStatus } from "@/components/transcriptions/editor/text/hooks/use-auto-save";

type TranscriptionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function TranscriptionPageContent({ params }: TranscriptionPageProps) {
  const { id } = use(params);
  const {
    data: transcription,
    isLoading,
    isFetching,
    isFetchedAfterMount,
    error,
  } = useTranscription(id);
  const { data: encryptionState } = useEncryptionStatus();
  const { openRename } = useTranscriptionRenameModal();
  const { openDelete } = useTranscriptionDeleteModal();
  const { data: allTranscriptions = [] } = useTranscriptions();
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === transcription?.projectId);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [editorAPI, setEditorAPI] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const betaFeatures = useBetaFeatures();

  // The phase lives in the URL so a reload — or a link sent to a colleague — lands on
  // the same pass over the document. Coding is part of the codebooks beta, so without
  // the opt-in there is only one phase and no switch to show.
  const phase: DocumentPhase = betaFeatures
    ? parseDocumentPhase(searchParams.get("phase"))
    : "transcription";
  const setPhase = (next: DocumentPhase) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next === "transcription") query.delete("phase");
    else query.set("phase", next);
    const suffix = query.toString();
    router.replace(`/app/transcription/${id}${suffix ? `?${suffix}` : ""}`, {
      scroll: false,
    });
  };

  const isEncryptionError = error?.message === "error_encrypted";

  // The list carries plaintext titles, so the tab still shows a name while the
  // document itself is loading (or can't be decrypted).
  const listTitle = allTranscriptions.find((tr) => tr.id === id)?.title;
  useDocumentTitle(transcription?.title || listTitle);

  useEffect(() => {
    if (error && !isEncryptionError) {
      toast.error(
        error.message || "An error occurred while fetching the transcription.",
      );
    }
  }, [error, isEncryptionError]);

  // Handle navigation to import certificate
  function handleImportCertificate() {
    router.push("/app/account/security");
  }

  // Show encryption error state
  if (isEncryptionError) {
    const hasLocalKey = encryptionState?.hasLocalKey ?? false;
    const reason = hasLocalKey ? "certificate-mismatch" : "no-certificate";

    // The content can't be decrypted, but the list still carries plaintext
    // metadata (title/ownership), so an owner can still delete the doc from here.
    const listEntry = allTranscriptions.find((tr) => tr.id === id);
    const canDelete = !listEntry || listEntry.isOwner !== false;

    return (
      <div className="flex flex-col flex-1 p-8">
        <div className="w-full max-w-4xl mx-auto">
          <CannotAccessTranscription
            reason={reason}
            onImportCertificate={handleImportCertificate}
            transcriptionTitle={listEntry?.title}
            onDelete={
              canDelete
                ? () => openDelete(id, listEntry?.title || id, true)
                : undefined
            }
          />
        </div>
      </div>
    );
  }

  const waitingForFreshMountData = isFetching && !isFetchedAfterMount;

  if (isLoading || waitingForFreshMountData || error) {
    return <></>;
  }

  const hasWriteAccess =
    transcription && (transcription.isOwner || transcription.role === "write");
  // Imported text documents have no audio, so there is nothing to listen to.
  const hasAudio = transcription && transcription.mediaType !== "text";
  const hasListenAccess =
    transcription &&
    hasAudio &&
    (transcription.isOwner ||
      transcription.role === "read+listen" ||
      transcription.role === "write");
  const isOwner = !!transcription?.isOwner;

  return (
    <>
      {transcription && (
        <>
          {createPortal(
            <div className="flex items-center gap-2 w-full">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* Breadcrumb: study (badge + name, links to the study) / doc. */}
                {project && (
                  <>
                    <Link
                      href={`/app/project/${project.id}`}
                      className="flex shrink-0 items-center gap-1.5 hover:opacity-80"
                    >
                      <ProjectBadge
                        appearance={project}
                        projectId={project.id}
                        name={project.name}
                        size="sm"
                        imageVersion={project.updatedAt}
                      />
                      <span className="max-w-[10rem] truncate font-medium">
                        {project.name}
                      </span>
                    </Link>
                    <span className="shrink-0 text-muted-foreground/60">/</span>
                  </>
                )}
                <span className="group/label flex min-w-0 items-center font-semibold">
                  <span className="truncate">
                    {transcription.title || transcription.audioFileName}
                  </span>
                  {isOwner && (
                    <Button
                      type="button"
                      className="opacity-0 group-hover/label:opacity-100 transition-opacity"
                      variant={"ghost"}
                      size={"icon-xs"}
                      onClick={() => {
                        openRename(
                          transcription.id,
                          transcription.title || transcription.audioFileName,
                        );
                      }}
                      aria-label="Edit name"
                    >
                      <PencilIcon className="h-3 w-3" />
                    </Button>
                  )}
                </span>
                {betaFeatures && transcription.state === "COMPLETED" && (
                  <DocumentPhaseSwitch phase={phase} onChange={setPhase} />
                )}
              </div>
              <TranscriptionActions
                hasWriteAccess={!!hasWriteAccess}
                hasListenAccess={!!hasListenAccess}
                transcriptionId={transcription.id}
                transcriptionName={
                  transcription.title || transcription.audioFileName
                }
                projectId={transcription.projectId}
                saveStatus={saveStatus}
                transcription={transcription.transcription}
                audioFileEncryption={transcription.audioFileEncryption}
                shared={transcription.shared}
                isOwner={isOwner}
                editorAPI={editorAPI}
              />
            </div>,
            document.getElementById("header-actions-portal")!,
          )}
        </>
      )}

      {transcription?.state === "ERROR" && (
        <div className="flex flex-col flex-1 p-8">
          <div className="w-full max-w-4xl mx-auto">
            <TranscriptionFailed transcription={transcription} />
          </div>
        </div>
      )}

      {transcription?.state === "PENDING" && (
        <div className="flex flex-col flex-1 p-8">
          <div className="w-full max-w-4xl mx-auto">
            <TranscriptionLoading transcription={transcription} />
          </div>
        </div>
      )}

      {transcription?.state === "COMPLETED" && (
        <TranscriptionEditor
          key={transcription.id} // Force remount editor on transcription change
          hasWriteAccess={!!hasWriteAccess}
          hasListenAccess={!!hasListenAccess}
          transcription={transcription}
          phase={phase}
          onEditorReady={setEditorAPI}
          onSaveStatusChange={setSaveStatus}
        />
      )}
    </>
  );
}

// useSearchParams() must be wrapped in a Suspense boundary for the production build.
export default function TranscriptionPage(props: TranscriptionPageProps) {
  return (
    <Suspense fallback={null}>
      <TranscriptionPageContent {...props} />
    </Suspense>
  );
}
