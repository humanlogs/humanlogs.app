"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useModal } from "@/components/use-modal";
import { useVersionComparisonModal } from "./dialogs/version-comparison-modal";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ClockIcon, PlusIcon, MinusIcon, PencilIcon } from "lucide-react";
import * as React from "react";

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

export function TranscriptionHistorySheet() {
  const { isOpen, data, close } = useTranscriptionHistoryModal();
  const { openVersion } = useVersionComparisonModal();

  const { data: history, isLoading } = useQuery({
    queryKey: ["transcription-history", data?.transcriptionId],
    queryFn: async () => {
      if (!data?.transcriptionId) return [];
      const response = await fetch(
        `/api/transcriptions/${data.transcriptionId}/history`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }
      return response.json() as Promise<HistoryEntry[]>;
    },
    enabled: isOpen && !!data?.transcriptionId,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "Just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? "s" : ""} ago`;
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
        className="w-[400px] sm:w-[540px] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
          <SheetDescription>
            View all changes made to this transcription
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground px-6">
              Loading history...
            </div>
          )}

          {!isLoading && history && history.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground px-6">
              No history available
            </div>
          )}

          {!isLoading &&
            history &&
            history.map((entry, index) => (
              <div
                key={entry.id}
                className={cn(
                  "border-b px-6 py-4 hover:bg-accent/50 transition-colors cursor-pointer",
                  index === 0 && "border-t",
                )}
                onClick={() => {
                  if (data?.transcriptionId) {
                    openVersion(data.transcriptionId, entry.id, index);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ClockIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{formatDate(entry.updatedAt)}</span>
                    <span className="text-muted-foreground">
                      {formatTime(entry.updatedAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserAvatar user={entry.user} size="sm" />
                    <span className="truncate">
                      {entry.user.name || entry.user.email}
                    </span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  {(entry.additions > 0 ||
                    entry.removals > 0 ||
                    entry.changed > 0) && (
                    <div className="flex items-center gap-3 text-xs">
                      {entry.additions > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <PlusIcon className="h-3 w-3" />
                          {entry.additions} word
                          {entry.additions !== 1 ? "s" : ""}
                        </span>
                      )}
                      {entry.removals > 0 && (
                        <span className="flex items-center gap-1 text-red-600">
                          <MinusIcon className="h-3 w-3" />
                          {entry.removals} word
                          {entry.removals !== 1 ? "s" : ""}
                        </span>
                      )}
                      {entry.changed > 0 && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <PencilIcon className="h-3 w-3" />
                          {entry.changed} word
                          {entry.changed !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
