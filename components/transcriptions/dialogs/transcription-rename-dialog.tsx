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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "@/components/locale-provider";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";

export type TranscriptionRenameModalData = {
  transcriptionId: string;
  currentName: string;
};

export function useTranscriptionRenameModal() {
  const modal = useModal<TranscriptionRenameModalData>(
    "transcription-rename-modal",
  );

  return {
    ...modal,
    openRename: (transcriptionId: string, currentName: string) => {
      modal.open({ transcriptionId, currentName });
    },
  };
}

export function TranscriptionRenameDialog() {
  const { isOpen, data, close } = useTranscriptionRenameModal();
  const [name, setName] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const queryClient = useQueryClient();
  const t = useTranslations("dialog.rename");

  // Update the name when modal opens
  React.useEffect(() => {
    if (isOpen && data?.currentName) {
      setName(data.currentName);
    }
  }, [isOpen, data?.currentName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!data) return;

    if (!name.trim()) {
      toast.error(t("errorEmpty"));
      return;
    }

    if (name.trim() === data.currentName) {
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
          body: JSON.stringify({ title: name.trim() }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("error"));
      }

      toast.success(t("success"));

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["transcription", data.transcriptionId],
      });

      close();
    } catch (error) {
      console.error("Error renaming transcription:", error);
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="px-6">
            <div className="space-y-2">
              <Label htmlFor="transcription-name">{t("label")}</Label>
              <Input
                id="transcription-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("placeholder")}
                autoFocus
              />
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
              {isSubmitting ? t("renaming") : t("rename")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
