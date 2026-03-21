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
      toast.error("Please enter a transcription name");
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
        throw new Error(error.error || "Failed to rename transcription");
      }

      toast.success("Transcription renamed successfully!");

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["transcription", data.transcriptionId],
      });

      close();
    } catch (error) {
      console.error("Error renaming transcription:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to rename transcription",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Transcription</DialogTitle>
          <DialogDescription>
            Enter a new name for your transcription.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4 px-6">
            <div className="space-y-2">
              <Label htmlFor="transcription-name">Transcription Name</Label>
              <Input
                id="transcription-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Interview with Jane Doe"
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
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-500"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
