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
import diff from "fast-diff";

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
      window.location.reload();
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
      router.push(`/app/transcription/${data.transcriptionId}`);
      close();
    }
  };

  // Generate diff view with context around changes
  const renderDiff = () => {
    const CONTEXT_ITEMS = 10; // Number of segments to show before/after changes
    const MIN_GAP_TO_SKIP = 30; // Only skip if there are more than this many unchanged segments

    let currentSegments: TranscriptionSegment[] = [];
    let previousSegments: TranscriptionSegment[] = [];
    let speakers: { id: string; name?: string }[] = [];

    if (isViewingCurrent) {
      // For current version, compare live data with most recent history
      if (!currentTranscription?.transcription) return null;
      currentSegments = currentTranscription.transcription.words || [];
      speakers = currentTranscription.transcription.speakers || [];

      // If there's no history yet, show current version without diff
      if (!history || history.length === 0) {
        return (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {currentSegments.map((seg, idx) => (
              <span key={idx}>{seg.text}</span>
            ))}
          </div>
        );
      }

      // Use the most recent history version data for comparison
      if (mostRecentVersionData) {
        previousSegments = mostRecentVersionData.current.words || [];
      }
    } else {
      // For historical versions, use the version data from the API
      if (!versionData) return null;
      currentSegments = versionData.current.words || [];
      previousSegments = versionData.previous?.words || [];
      // Get speakers from current transcription - they don't change between versions
      speakers = currentTranscription?.transcription?.speakers || [];
    }

    // Create speaker lookup map
    const speakerMap = new Map(speakers.map((s) => [s.id, s.name || s.id]));

    // Convert segments to text for fast-diff
    const currentText = currentSegments.map((s) => s.text).join("");
    const previousText = previousSegments.map((s) => s.text).join("");

    // If no changes, show the current text
    if (currentText === previousText) {
      return (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {t("noChanges")}
        </div>
      );
    }

    // Use fast-diff to compute differences
    const diffs = diff(previousText, currentText);

    // Build a unified segment list with diff markers by processing diffs
    type SegmentWithDiff = {
      segment: TranscriptionSegment;
      diffType: "equal" | "add" | "remove";
      index: number;
    };

    const unifiedSegments: SegmentWithDiff[] = [];
    let prevIndex = 0;
    let currIndex = 0;
    let segmentIndex = 0;

    for (const [type, text] of diffs) {
      if (type === diff.EQUAL) {
        // Add segments from current (they're the same in both)
        let remaining = text.length;
        while (remaining > 0 && currIndex < currentSegments.length) {
          const seg = currentSegments[currIndex];
          if (seg.text.length <= remaining) {
            unifiedSegments.push({
              segment: seg,
              diffType: "equal",
              index: segmentIndex++,
            });
            remaining -= seg.text.length;
            currIndex++;
            prevIndex++;
          } else {
            break;
          }
        }
      } else if (type === diff.INSERT) {
        // Add segments from current (additions)
        let remaining = text.length;
        while (remaining > 0 && currIndex < currentSegments.length) {
          const seg = currentSegments[currIndex];
          if (seg.text.length <= remaining) {
            unifiedSegments.push({
              segment: seg,
              diffType: "add",
              index: segmentIndex++,
            });
            remaining -= seg.text.length;
            currIndex++;
          } else {
            break;
          }
        }
      } else if (type === diff.DELETE) {
        // Add segments from previous (deletions)
        let remaining = text.length;
        while (remaining > 0 && prevIndex < previousSegments.length) {
          const seg = previousSegments[prevIndex];
          if (seg.text.length <= remaining) {
            unifiedSegments.push({
              segment: seg,
              diffType: "remove",
              index: segmentIndex++,
            });
            remaining -= seg.text.length;
            prevIndex++;
          } else {
            break;
          }
        }
      }
    }

    // Find indices of all changed segments
    const changedIndices = unifiedSegments
      .map((s, i) => (s.diffType !== "equal" ? i : -1))
      .filter((i) => i !== -1);

    if (changedIndices.length === 0) {
      return (
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
          {t("noChanges")}
        </div>
      );
    }

    // Group changes into chunks with context
    type Chunk = { start: number; end: number };
    const chunks: Chunk[] = [];
    let currentChunk: Chunk | null = null;

    for (const idx of changedIndices) {
      const chunkStart = Math.max(0, idx - CONTEXT_ITEMS);
      const chunkEnd = Math.min(
        unifiedSegments.length - 1,
        idx + CONTEXT_ITEMS,
      );

      if (!currentChunk) {
        currentChunk = { start: chunkStart, end: chunkEnd };
      } else if (chunkStart <= currentChunk.end + MIN_GAP_TO_SKIP) {
        // Merge overlapping or close chunks
        currentChunk.end = Math.max(currentChunk.end, chunkEnd);
      } else {
        // Start a new chunk
        chunks.push(currentChunk);
        currentChunk = { start: chunkStart, end: chunkEnd };
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    // Count lines (newlines) between chunks
    const countLinesBetween = (start: number, end: number): number => {
      let count = 0;
      for (let i = start; i < end && i < unifiedSegments.length; i++) {
        if (unifiedSegments[i].segment.text === "\n") {
          count++;
        }
      }
      return count;
    };

    // Render chunks with ellipses between them
    const elements: React.ReactNode[] = [];

    chunks.forEach((chunk, chunkIdx) => {
      // Add ellipsis before chunk if not at start
      if (chunk.start > 0) {
        const skippedLines = countLinesBetween(
          chunkIdx > 0 ? chunks[chunkIdx - 1].end + 1 : 0,
          chunk.start,
        );
        elements.push(
          <div
            key={`ellipsis-before-${chunkIdx}`}
            className="text-muted-foreground italic text-xs py-2"
          >
            [{skippedLines} {skippedLines === 1 ? "line" : "lines"}]
          </div>,
        );
      }

      // Render segments in chunk
      const chunkElements: React.ReactNode[] = [];
      let lastSpeakerId: string | undefined = undefined;
      const firstSegment = unifiedSegments[chunk.start]?.segment;
      const isStartTruncated = chunk.start > 0;
      let addedLeadingEllipsis = false;

      for (
        let i = chunk.start;
        i <= chunk.end && i < unifiedSegments.length;
        i++
      ) {
        const { segment, diffType } = unifiedSegments[i];
        const key = `seg-${chunkIdx}-${i}`;

        // Show speaker name when it changes
        if (
          segment.speakerId &&
          segment.speakerId !== lastSpeakerId &&
          segment.text !== "\n"
        ) {
          const speakerName =
            speakerMap.get(segment.speakerId) || segment.speakerId;
          chunkElements.push(
            <span key={`speaker-${i}`} className="font-semibold text-primary">
              {speakerName}:{" "}
            </span>,
          );
          lastSpeakerId = segment.speakerId;

          // Add leading [...] after speaker name if this is the start and we're truncated
          if (!addedLeadingEllipsis && isStartTruncated && i === chunk.start) {
            chunkElements.push(
              <span
                key="leading-ellipsis"
                className="text-muted-foreground italic"
              >
                [...]
              </span>,
              " ",
            );
            addedLeadingEllipsis = true;
          }
        } else if (
          !addedLeadingEllipsis &&
          isStartTruncated &&
          i === chunk.start &&
          segment.text !== "\n"
        ) {
          // Add leading [...] if starting mid-sentence without a speaker change
          chunkElements.push(
            <span
              key="leading-ellipsis"
              className="text-muted-foreground italic"
            >
              [...]
            </span>,
            " ",
          );
          addedLeadingEllipsis = true;
        }

        // Handle line breaks
        if (segment.text === "\n") {
          chunkElements.push(<br key={key} />);
          lastSpeakerId = undefined; // Reset speaker on new line
          continue;
        }

        // Render segment based on diff type
        if (diffType === "add") {
          chunkElements.push(
            <span
              key={key}
              className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-0.5 rounded"
            >
              {segment.text}
            </span>,
          );
        } else if (diffType === "remove") {
          chunkElements.push(
            <span
              key={key}
              className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 line-through px-0.5 rounded"
            >
              {segment.text}
            </span>,
          );
        } else {
          chunkElements.push(
            <span key={key} className="text-muted-foreground/70">
              {segment.text}
            </span>,
          );
        }
      }

      // Add trailing [...] if we're ending mid-sentence
      const lastSegment =
        unifiedSegments[Math.min(chunk.end, unifiedSegments.length - 1)]
          ?.segment;
      const isEndTruncated = chunk.end < unifiedSegments.length - 1;
      if (isEndTruncated && lastSegment && lastSegment.text !== "\n") {
        chunkElements.push(
          <span
            key="trailing-ellipsis"
            className="text-muted-foreground italic"
          >
            {" "}
            [...]
          </span>,
        );
      }

      elements.push(
        <div
          key={`chunk-${chunkIdx}`}
          className="leading-relaxed whitespace-pre-wrap"
        >
          {chunkElements}
        </div>,
      );
    });

    // Add final ellipsis if needed
    if (
      chunks.length > 0 &&
      chunks[chunks.length - 1].end < unifiedSegments.length - 1
    ) {
      const skippedLines = countLinesBetween(
        chunks[chunks.length - 1].end + 1,
        unifiedSegments.length,
      );
      elements.push(
        <div
          key="ellipsis-end"
          className="text-muted-foreground italic text-xs py-2"
        >
          [{skippedLines} {skippedLines === 1 ? "line" : "lines"}]
        </div>,
      );
    }

    return <div className="text-sm space-y-1">{elements}</div>;
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
