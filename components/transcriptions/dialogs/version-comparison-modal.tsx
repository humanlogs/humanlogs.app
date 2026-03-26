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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon, RotateCcwIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

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

type HistoryEntry = {
  id: string;
  updatedAt: string;
  updatedBy: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  additions: number;
  removals: number;
  changed: number;
};

type Word = {
  text: string;
  start: number;
  end: number;
  speaker?: string;
};

type TranscriptionContent = {
  words: Word[];
  [key: string]: unknown;
};

export function VersionComparisonModal() {
  const { isOpen, data, close, open } = useVersionComparisonModal();
  const queryClient = useQueryClient();

  // Fetch all history to get the list
  const { data: allHistory } = useQuery({
    queryKey: ["transcription-history", data?.transcriptionId],
    queryFn: async () => {
      if (!data?.transcriptionId) return [];
      const response = await fetch(
        `/api/transcriptions/${data.transcriptionId}/history`,
      );
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json() as Promise<HistoryEntry[]>;
    },
    enabled: isOpen && !!data?.transcriptionId,
  });

  // Fetch the specific version data
  const { data: versionData, isLoading } = useQuery({
    queryKey: ["transcription-version", data?.transcriptionId, data?.versionId],
    queryFn: async () => {
      if (!data?.transcriptionId || !data?.versionId) return null;
      const response = await fetch(
        `/api/transcriptions/${data.transcriptionId}/history/${data.versionId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch version");
      return response.json() as Promise<{
        current: TranscriptionContent;
        previous: TranscriptionContent | null;
      }>;
    },
    enabled: isOpen && !!data?.transcriptionId && !!data?.versionId,
  });

  // Revert mutation
  const revertMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!data?.transcriptionId) throw new Error("No transcription ID");
      const response = await fetch(
        `/api/transcriptions/${data.transcriptionId}/revert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        },
      );
      if (!response.ok) throw new Error("Failed to revert");
      return response.json();
    },
    onSuccess: () => {
      toast.success("Version restored successfully");
      queryClient.invalidateQueries({
        queryKey: ["transcription", data?.transcriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transcription-history", data?.transcriptionId],
      });
      close();
    },
    onError: () => {
      toast.error("Failed to restore version");
    },
  });

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

    // Simple diff: compare by position
    const maxLength = Math.max(currentWords.length, previousWords.length);
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < maxLength; i++) {
      const currentWord = currentWords[i];
      const previousWord = previousWords[i];

      if (currentWord && !previousWord) {
        // Added word
        elements.push(
          <span
            key={`add-${i}`}
            className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-0.5 rounded"
          >
            {currentWord.text}
          </span>,
          " ",
        );
      } else if (!currentWord && previousWord) {
        // Removed word
        elements.push(
          <span
            key={`remove-${i}`}
            className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through px-0.5 rounded"
          >
            {previousWord.text}
          </span>,
          " ",
        );
      } else if (currentWord && previousWord) {
        if (currentWord.text !== previousWord.text) {
          // Changed word - show both
          elements.push(
            <span key={`change-${i}`}>
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
          elements.push(<span key={`same-${i}`}>{currentWord.text}</span>, " ");
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                disabled={!hasPrevious}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                Older
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                disabled={!hasNext}
              >
                Newer
                <ChevronRightIcon className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </DialogTitle>
          {currentVersion && (
            <DialogDescription className="flex items-center gap-3">
              <UserAvatar user={currentVersion.user} size="sm" />
              <span>
                {currentVersion.user.name || currentVersion.user.email} •{" "}
                {formatDateTime(currentVersion.updatedAt)}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-muted/30">
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

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {currentVersion && (
              <>
                <span className="text-green-600">
                  +{currentVersion.additions}
                </span>
                {" / "}
                <span className="text-red-600">-{currentVersion.removals}</span>
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
          <Button
            onClick={handleRevert}
            disabled={revertMutation.isPending}
            variant="default"
          >
            <RotateCcwIcon className="h-4 w-4 mr-2" />
            Revert to this version
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
