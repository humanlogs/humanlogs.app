"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";

export type TranscriptionDeleteModalData = {
  transcriptionId: string;
  transcriptionName: string;
  redirectAfterDelete?: boolean;
};

export function useTranscriptionDeleteModal() {
  const modal = useModal<TranscriptionDeleteModalData>(
    "transcription-delete-modal",
  );

  return {
    ...modal,
    openDelete: (
      transcriptionId: string,
      transcriptionName: string,
      redirectAfterDelete?: boolean,
    ) => {
      modal.open({ transcriptionId, transcriptionName, redirectAfterDelete });
    },
  };
}

export function TranscriptionDeleteDialog() {
  const { isOpen, data, close } = useTranscriptionDeleteModal();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("dialog.delete");

  const handleDelete = async () => {
    if (!data) return;

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/transcriptions/${data.transcriptionId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("error"));
      }

      toast.success(t("success"));

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });

      close();

      // Redirect if requested (e.g., when deleting from detail page)
      if (data.redirectAfterDelete) {
        router.push("/");
      }
    } catch (error) {
      console.error("Error deleting transcription:", error);
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangleIcon className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("description", { name: data?.transcriptionName || "-" })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={isDeleting}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? t("deleting") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
