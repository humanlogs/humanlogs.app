"use client";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  AlertCircleIcon,
  FileIcon,
  FileLockIcon,
  FileTextIcon,
  LoaderIcon,
} from "lucide-react";
import { useNotificationCounts } from "@/hooks/use-notifications";
import Link from "next/link";

type TranscriptionState = "PENDING" | "COMPLETED" | "ERROR";

type TranscriptionMenuItemProps = {
  transcription: {
    id: string;
    title: string;
    state: TranscriptionState;
    errorMessage?: string | null;
    isEncrypted?: boolean;
    mediaType?: "audio" | "text";
  };
  isActive: boolean;
};

export function TranscriptionMenuItem({
  transcription,
  isActive,
}: TranscriptionMenuItemProps) {
  // Unread notifications about this document (a mention, or a reply in a thread the
  // user follows). Opening the document clears them.
  const { data: counts } = useNotificationCounts();
  const unread = counts?.byEntity[`transcription:${transcription.id}`] ?? 0;

  const getStatusIcon = () => {
    switch (transcription.state) {
      case "PENDING":
        return (
          <div className="flex items-center justify-center shrink-0">
            <LoaderIcon
              className="h-4 w-4 animate-spin"
              style={{ animationDuration: "5s" }}
            />
          </div>
        );
      case "ERROR":
        return (
          <div className="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity">
            <AlertCircleIcon className="h-4 w-4 text-red-500" />
          </div>
        );
      case "COMPLETED":
      default:
        if (transcription.mediaType === "text") {
          return <FileTextIcon className="h-4 w-4" />;
        }
        return transcription.isEncrypted ? (
          <FileLockIcon className="h-4 w-4" />
        ) : (
          <FileIcon className="h-4 w-4" />
        );
    }
  };

  return (
    <SidebarMenuItem>
      <Link href={`/app/transcription/${transcription.id}`}>
        <SidebarMenuButton isActive={isActive}>
          {getStatusIcon()}
          <span className="flex-1 truncate">{transcription.title}</span>
          {unread > 0 && (
            <span className="bg-primary text-primary-foreground flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
}
