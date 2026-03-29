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
import { Label } from "@/components/ui/label";
import { ProjectSelector } from "@/components/project-selector";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "@/components/locale-provider";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";

export type TranscriptionSetProjectModalData = {
  transcriptionId: string;
  currentProjectId?: string;
};

export function useTranscriptionSetProjectModal() {
  const modal = useModal<TranscriptionSetProjectModalData>(
    "transcription-set-project-modal",
  );

  return {
    ...modal,
    openSetProject: (transcriptionId: string, currentProjectId?: string) => {
      modal.open({ transcriptionId, currentProjectId });
    },
  };
}

export function TranscriptionSetProjectDialog() {
  const { isOpen, data, close } = useTranscriptionSetProjectModal();
  const [projectId, setProjectId] = React.useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations("dialog.setProject");

  // Update the project ID when modal opens
  React.useEffect(() => {
    if (isOpen && data) {
      setProjectId(data.currentProjectId);
    }
  }, [isOpen, data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!data) return;

    if (projectId === data.currentProjectId) {
      close();
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/transcriptions/${data.transcriptionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ projectId: projectId || null }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("error"));
      }

      toast.success(projectId ? t("successUpdated") : t("successRemoved"));

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["transcription", data.transcriptionId],
      });

      close();
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 px-6">
              <div className="space-y-2">
                <Label htmlFor="project">{t("label")}</Label>
                <ProjectSelector value={projectId} onChange={setProjectId} />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={isSubmitting}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" variant={"primary"} disabled={isSubmitting}>
                {isSubmitting ? t("saving") : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
