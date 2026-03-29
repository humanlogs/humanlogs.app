"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useModal } from "@/components/use-modal";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RotateCcwIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import * as React from "react";
import { toast } from "sonner";
import {
  useTranscriptionHistory,
  useTranscriptionVersion,
  useRevertTranscription,
  useTranscription,
  type HistoryEntry,
  type TranscriptionSegment,
} from "@/hooks/use-transcriptions";
import { useRouter } from "next/navigation";

export type TranscriptionHistoryModalData = {
  transcriptionId: string;
};

export function useTranscriptionHistoryModal() {
  const modal = useModal<TranscriptionHistoryModalData>(
    "transcription-history-modal",
  );

  return {
    ...modal,
    openHistory: (transcriptionId: string) => {
      modal.open({ transcriptionId });
    },
  };
}

export function TranscriptionHistorySheet() {
  const { isOpen, data, close } = useTranscriptionHistoryModal();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("dialog.history");
  const [selectedVersionIndex, setSelectedVersionIndex] = React.useState<
    number | null
  >(null);

  const { data: history, isLoading } = useTranscriptionHistory(
    (isOpen && data?.transcriptionId) || "",
  );

  const isViewingCurrent = selectedVersionIndex === -1;
  const selectedVersion =
    selectedVersionIndex !== null && !isViewingCurrent && history
      ? history[selectedVersionIndex]
      : null;

  // Fetch the current live transcription (when viewing current version at index -1)
  const { data: currentTranscription } = useTranscription(
    (isOpen && isViewingCurrent && data?.transcriptionId) || "",
  );

  // When viewing current, we need to fetch the most recent history entry to compare with
  const mostRecentHistoryId = history?.[0]?.id;
  const { data: mostRecentVersionData } = useTranscriptionVersion(
    (isOpen && isViewingCurrent && data?.transcriptionId) || "",
    (isOpen && isViewingCurrent && mostRecentHistoryId) || "",
  );

  // Fetch the specific version data when a version is selected
  const { data: versionData, isLoading: isLoadingVersion } =
    useTranscriptionVersion(
      (isOpen && data?.transcriptionId) || "",
      (isOpen && !isViewingCurrent && selectedVersion?.id) || "",
    );

  // Revert mutation
  const revertMutation = useRevertTranscription(data?.transcriptionId || "");

  // Handle success/error
  React.useEffect(() => {
    if (revertMutation.isSuccess) {
      toast.success(t("revertSuccess"));
      setSelectedVersionIndex(null);
    }
    if (revertMutation.isError) {
      toast.error(t("revertError"));
    }
  }, [revertMutation.isSuccess, revertMutation.isError]);

  // Reset selection when sheet closes
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedVersionIndex(null);
    }
  }, [isOpen]);

  const hasPrevious = isViewingCurrent
    ? (history?.length ?? 0) > 0
    : selectedVersionIndex !== null &&
      selectedVersionIndex < (history?.length ?? 0) - 1;
  const hasNext = isViewingCurrent
    ? false
    : selectedVersionIndex !== null && selectedVersionIndex >= 0;

  const goToPrevious = () => {
    if (hasPrevious && history) {
      if (selectedVersionIndex === -1) {
        // Going from current to most recent history entry
        setSelectedVersionIndex(0);
      } else if (selectedVersionIndex !== null) {
        // Going to an older historical version
        setSelectedVersionIndex(selectedVersionIndex + 1);
      }
    }
  };

  const goToNext = () => {
    if (hasNext && history && selectedVersionIndex !== null) {
      if (selectedVersionIndex === -1) {
        // Already at current, shouldn't happen
        return;
      } else if (selectedVersionIndex === 0) {
        // Going from most recent history to current version
        setSelectedVersionIndex(-1);
      } else {
        // Going to a newer historical version
        setSelectedVersionIndex(selectedVersionIndex - 1);
      }
    }
  };

  const handleRevert = () => {
    if (selectedVersion?.id) {
      revertMutation.mutate(selectedVersion.id);
    }
  };

  const handleOpenCurrent = () => {
    if (data?.transcriptionId) {
      router.push(`/transcription/${data.transcriptionId}`);
      close();
    }
  };

  // Generate diff view
  const renderDiff = () => {
    let currentWords: TranscriptionSegment[] = [];
    let previousWords: TranscriptionSegment[] = [];

    if (isViewingCurrent) {
      // For current version, compare live data with most recent history
      if (!currentTranscription?.transcription) return null;
      currentWords = currentTranscription.transcription.words || [];

      // If there's no history yet, show current version without diff
      if (!history || history.length === 0) {
        return (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {currentWords.map((word, idx) => (
              <span key={idx}>{word.text} </span>
            ))}
          </div>
        );
      }

      // Use the most recent history version data for comparison
      if (mostRecentVersionData) {
        // The "current" field in mostRecentVersionData is actually the most recent history entry
        previousWords = mostRecentVersionData.current.words || [];
      }
    } else {
      // For historical versions, use the version data from the API
      if (!versionData) return null;
      currentWords = versionData.current.words || [];
      previousWords = versionData.previous?.words || [];
    }

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return t("justNow");
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return minutes === 1
        ? t("minuteAgo", { count: minutes })
        : t("minutesAgo", { count: minutes });
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return hours === 1
        ? t("hourAgo", { count: hours })
        : t("hoursAgo", { count: hours });
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return days === 1
        ? t("dayAgo", { count: days })
        : t("daysAgo", { count: days });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className={cn(
          "min-w-[500px] flex flex-col",
          selectedVersionIndex !== null && "max-w-[100vw]!  w-[50vw]!",
        )}
      >
        {selectedVersionIndex === null ? (
          <>
            <SheetHeader>
              <SheetTitle>{t("title")}</SheetTitle>
              <SheetDescription>{t("description")}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-8 text-muted-foreground px-6">
                  {t("loadingHistory")}
                </div>
              )}

              {!isLoading && history && history.length === 0 && (
                <div className="flex items-center justify-center py-8 text-muted-foreground px-6">
                  {t("noHistory")}
                </div>
              )}

              {!isLoading && history && history.length > 0 && (
                <>
                  {/* Current Version Entry */}
                  <div
                    className={cn(
                      "border-b border-t px-6 py-4 hover:bg-accent/50 transition-colors cursor-pointer bg-accent/20",
                    )}
                    onClick={() => setSelectedVersionIndex(-1)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{t("currentVersion")}</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-xs text-muted-foreground">
                      {t("currentDescription")}
                    </div>
                  </div>

                  {/* History Entries */}
                  {history.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "border-b px-6 py-4 hover:bg-accent/50 transition-colors cursor-pointer",
                      )}
                      onClick={() => setSelectedVersionIndex(index)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>{formatDate(entry.updatedAt)}</span>
                          <span className="text-muted-foreground">
                            {formatTime(entry.updatedAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 text-xs">
                        {entry.additions > 0 ||
                        entry.removals > 0 ||
                        entry.changed > 0 ? (
                          <div className="flex items-center gap-3">
                            {entry.additions > 0 && (
                              <span className="flex items-center gap-1 text-green-600">
                                +{entry.additions}{" "}
                                {entry.additions !== 1 ? t("words") : t("word")}
                              </span>
                            )}
                            {entry.removals > 0 && (
                              <span className="flex items-center gap-1 text-red-600">
                                -{entry.removals}{" "}
                                {entry.removals !== 1 ? t("words") : t("word")}
                              </span>
                            )}
                            {entry.changed > 0 && (
                              <span className="flex items-center gap-1 text-yellow-600">
                                ~{entry.changed}{" "}
                                {entry.changed !== 1 ? t("words") : t("word")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div>{t("noChanges")}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                        <UserAvatar user={entry.user} size="sm" />
                        <span className="truncate">
                          {entry.user.name || entry.user.email}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SheetTitle>{t("comparisonTitle")}</SheetTitle>
                  {isViewingCurrent ? (
                    <SheetDescription className="mt-2">
                      <span className="font-medium">{t("currentVersion")}</span>
                      {history && history.length > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          • {t("comparedWith")}
                        </span>
                      )}
                    </SheetDescription>
                  ) : (
                    selectedVersion && (
                      <SheetDescription className="flex items-center gap-3 mt-2">
                        <UserAvatar user={selectedVersion.user} size="sm" />
                        <span>
                          {selectedVersion.user.name ||
                            selectedVersion.user.email}{" "}
                          • {formatDateTime(selectedVersion.updatedAt)}
                        </span>
                        <div className="text-sm text-muted-foreground">
                          <span className="text-green-600">
                            +{selectedVersion.additions}
                          </span>
                          {" / "}
                          <span className="text-red-600">
                            -{selectedVersion.removals}
                          </span>
                          {selectedVersion.changed > 0 && (
                            <>
                              {" / "}
                              <span className="text-orange-600">
                                ~{selectedVersion.changed}
                              </span>
                            </>
                          )}{" "}
                          {t("words")}
                        </div>
                      </SheetDescription>
                    )
                  )}
                </div>
              </div>
            </SheetHeader>

            <div className="flex items-center justify-between pb-4 px-4 border-b -mt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevious}
                  disabled={!hasPrevious}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  {t("older")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNext}
                  disabled={!hasNext}
                >
                  {t("newer")}
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
              {isViewingCurrent ? (
                <Button onClick={handleOpenCurrent} variant="default">
                  {t("openCurrent")}
                </Button>
              ) : (
                <Button
                  onClick={handleRevert}
                  disabled={revertMutation.isPending}
                  variant="primary"
                  confirm={t("revertConfirm")}
                >
                  <RotateCcwIcon className="h-4 w-4" />
                  {t("revertButton")}
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 px-6">
              {(isLoadingVersion ||
                (isViewingCurrent &&
                  (!currentTranscription ||
                    (history &&
                      history.length > 0 &&
                      !mostRecentVersionData)))) && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  {t("loadingVersion")}
                </div>
              )}

              {!isLoadingVersion && !isViewingCurrent && !versionData && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  {t("failedToLoad")}
                </div>
              )}

              {!isLoadingVersion &&
                ((isViewingCurrent && currentTranscription) ||
                  (!isViewingCurrent && versionData)) &&
                renderDiff()}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
