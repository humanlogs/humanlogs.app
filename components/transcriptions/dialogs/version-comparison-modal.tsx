"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useModal } from "@/components/use-modal";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  useTranscriptionHistory,
  useTranscriptionVersion,
  useRevertTranscription,
  calculateWordChanges,
  type HistoryEntry,
  type TranscriptionSegment,
} from "@/hooks/use-transcriptions";

export type VersionComparisonModalData = {
  transcriptionId: string;
  versionId: string;
  versionIndex: number; // Index in the history list
};

export function useVersionComparisonModal() {
  const modal = useModal<VersionComparisonModalData>(
    "version-comparison-modal",
  );

  return {
    ...modal,
    openVersion: (
      transcriptionId: string,
      versionId: string,
      versionIndex: number,
    ) => {
      modal.open({ transcriptionId, versionId, versionIndex });
    },
  };
}

export function VersionComparisonModal() {
  const { isOpen, data, close, open } = useVersionComparisonModal();
  const queryClient = useQueryClient();

  // Fetch all history to get the list
  const { data: allHistory } = useTranscriptionHistory(
    (isOpen && data?.transcriptionId) || "",
  );

  // Fetch the specific version data
  const { data: versionData, isLoading } = useTranscriptionVersion(
    (isOpen && data?.transcriptionId) || "",
    (isOpen && data?.versionId) || "",
  );

  // Revert mutation
  const revertMutation = useRevertTranscription(data?.transcriptionId || "");

  // Handle success/error
  React.useEffect(() => {
    if (revertMutation.isSuccess) {
      toast.success("Version restored successfully");
      close();
    }
    if (revertMutation.isError) {
      toast.error("Failed to restore version");
    }
  }, [revertMutation.isSuccess, revertMutation.isError, close]);

  const currentVersion = allHistory?.[data?.versionIndex ?? -1];
  const hasPrevious = (data?.versionIndex ?? 0) < (allHistory?.length ?? 0) - 1;
  const hasNext = (data?.versionIndex ?? 0) > 0;

  const goToPrevious = () => {
    if (hasPrevious && allHistory && data) {
      const newIndex = data.versionIndex + 1;
      const newVersion = allHistory[newIndex];
      open({
        transcriptionId: data.transcriptionId,
        versionId: newVersion.id,
        versionIndex: newIndex,
      });
    }
  };

  const goToNext = () => {
    if (hasNext && allHistory && data) {
      const newIndex = data.versionIndex - 1;
      const newVersion = allHistory[newIndex];
      open({
        transcriptionId: data.transcriptionId,
        versionId: newVersion.id,
        versionIndex: newIndex,
      });
    }
  };

  const handleRevert = () => {
    if (data?.versionId) {
      revertMutation.mutate(data.versionId);
    }
  };

  // Generate diff view
  const renderDiff = () => {
    if (!versionData) return null;

    const currentWords = versionData.current.words || [];
    const previousWords = versionData.previous?.words || [];

    // Use word.start as unique identifier for accurate diffing
    const currentMap = new Map<number, TranscriptionSegment>();
    const previousMap = new Map<number, TranscriptionSegment>();

    for (const word of currentWords) {
      if (word.start !== undefined) {
        currentMap.set(word.start, word);
      }
    }

    for (const word of previousWords) {
      if (word.start !== undefined) {
        previousMap.set(word.start, word);
      }
    }

    // Get all unique start times and sort them chronologically
    const allStarts = new Set([...currentMap.keys(), ...previousMap.keys()]);
    const sortedStarts = Array.from(allStarts).sort((a, b) => a - b);

    const elements: React.ReactNode[] = [];

    for (const start of sortedStarts) {
      const currentWord = currentMap.get(start);
      const previousWord = previousMap.get(start);

      if (currentWord && !previousWord) {
        // Added word (exists in current but not in previous)
        elements.push(
          <span
            key={`add-${start}`}
            className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-0.5 rounded"
          >
            {currentWord.text}
          </span>,
          " ",
        );
      } else if (!currentWord && previousWord) {
        // Removed word (exists in previous but not in current)
        elements.push(
          <span
            key={`remove-${start}`}
            className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through px-0.5 rounded"
          >
            {previousWord.text}
          </span>,
          " ",
        );
      } else if (currentWord && previousWord) {
        if (currentWord.text !== previousWord.text) {
          // Changed word (same start time but different text)
          elements.push(
            <span key={`change-${start}`}>
              <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through px-0.5 rounded">
                {previousWord.text}
              </span>{" "}
              <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-0.5 rounded">
                {currentWord.text}
              </span>
            </span>,
            " ",
          );
        } else {
          // Unchanged word
          elements.push(
            <span key={`same-${start}`}>{currentWord.text}</span>,
            " ",
          );
        }
      }
    }

    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap">
        {elements}
      </div>
    );
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Version Comparison</span>
          </DialogTitle>
          {currentVersion && (
            <DialogDescription className="flex items-center gap-3">
              <UserAvatar user={currentVersion.user} size="sm" />
              <span>
                {currentVersion.user.name || currentVersion.user.email} •{" "}
                {formatDateTime(currentVersion.updatedAt)}
              </span>
              <div className="text-sm text-muted-foreground">
                {currentVersion && (
                  <>
                    <span className="text-green-600">
                      +{currentVersion.additions}
                    </span>
                    {" / "}
                    <span className="text-red-600">
                      -{currentVersion.removals}
                    </span>
                    {currentVersion.changed > 0 && (
                      <>
                        {" / "}
                        <span className="text-orange-600">
                          ~{currentVersion.changed}
                        </span>
                      </>
                    )}
                    {" words"}
                  </>
                )}
              </div>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 px-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading version...
            </div>
          )}

          {!isLoading && !versionData && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Failed to load version
            </div>
          )}

          {!isLoading && versionData && renderDiff()}
        </div>

        <div className="flex items-center justify-between p-4 px-6 border-t">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={!hasPrevious}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Older
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={!hasNext}
            >
              Newer
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={handleRevert}
            disabled={revertMutation.isPending}
            variant="default"
            confirm="Are you sure you want to revert to this version?"
          >
            <RotateCcwIcon className="h-4 w-4" />
            Revert to this version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
