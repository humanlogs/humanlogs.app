"use client";

import { CannotAccessTranscription } from "@/components/encryption";
import { TranscriptionActions } from "@/components/transcriptions/transcription-actions";
import { TranscriptionEditor } from "@/components/transcriptions/transcription-editor";
import { TranscriptionFailed } from "@/components/transcriptions/transcription-failed";
import { TranscriptionLoading } from "@/components/transcriptions/transcription-loading";
import { useEncryptionStatus } from "@/hooks/use-encryption";
import { useTranscription } from "@/hooks/use-transcriptions";
import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
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

export default function TranscriptionPage({ params }: TranscriptionPageProps) {
  const { id } = use(params);
  const { data: transcription, isLoading, error } = useTranscription(id);
  const { data: encryptionState } = useEncryptionStatus();
  const { openRename } = useTranscriptionRenameModal();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [editorAPI, setEditorAPI] = useState<any>(null);
  const router = useRouter();

  const isEncryptionError = error?.message === "error_encrypted";

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

    return (
      <div className="flex flex-col flex-1 p-8">
        <div className="w-full max-w-4xl mx-auto">
          <CannotAccessTranscription
            reason={reason}
            onImportCertificate={handleImportCertificate}
          />
        </div>
      </div>
    );
  }

  if (isLoading || error) {
    return <></>;
  }

  const hasWriteAccess =
    transcription && (transcription.isOwner || transcription.role === "write");
  const hasListenAccess =
    transcription &&
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
              <div className="flex-1">
                <span className="font-semibold group/label">
                  {transcription.title || transcription.audioFileName}
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
          hasWriteAccess={!!hasWriteAccess}
          hasListenAccess={!!hasListenAccess}
          transcription={transcription}
          onEditorReady={setEditorAPI}
          onSaveStatusChange={setSaveStatus}
        />
      )}
    </>
  );
}
