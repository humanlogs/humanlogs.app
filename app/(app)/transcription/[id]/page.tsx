"use client";

import { TranscriptionActions } from "@/components/transcriptions/transcription-actions";
import { TranscriptionEditor } from "@/components/transcriptions/transcription-editor";
import { TranscriptionFailed } from "@/components/transcriptions/transcription-failed";
import { TranscriptionLoading } from "@/components/transcriptions/transcription-loading";
import { useTranscription } from "@/hooks/use-api";
import { PencilIcon } from "lucide-react";
import { use, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useTranscriptionRenameModal } from "../../../../components/transcriptions/dialogs/transcription-rename-dialog";
import { Button } from "../../../../components/ui/button";

type TranscriptionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function TranscriptionPage({ params }: TranscriptionPageProps) {
  const { id } = use(params);
  const { data: transcription, isLoading, error } = useTranscription(id);
  const { openRename } = useTranscriptionRenameModal();

  useEffect(() => {
    if (error) {
      toast.error(
        error.message || "An error occurred while fetching the transcription.",
      );
    }
  }, [error]);

  if (isLoading || error) {
    return <></>;
  }

  return (
    <>
      {transcription && (
        <>
          {createPortal(
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1">
                <span className="font-semibold group/label">
                  {transcription.title || transcription.audioFileName}
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
                </span>
              </div>
              <TranscriptionActions
                transcriptionId={transcription.id}
                transcriptionName={
                  transcription.title || transcription.audioFileName
                }
                projectId={transcription.projectId}
              />
            </div>,
            document.getElementById("transcription-header-portal")!,
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
        <TranscriptionEditor transcription={transcription} />
      )}
    </>
  );
}
