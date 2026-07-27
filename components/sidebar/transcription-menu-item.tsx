"use client";

import { ProjectBadge } from "@/components/projects/project-badge";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  AlertCircleIcon,
  FileAudio2Icon,
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
    mediaType?: "audio" | "text";
  };
  isActive: boolean;
  /**
   * The document's study, shown as a badge in front of the title. Passed only
   * when the list is not grouped by study — otherwise the group header already
   * says it. The name is not repeated on the row: the badge stands for it (and
   * is its tooltip), which keeps the little space there is for the title.
   */
  study?: {
    id: string;
    name: string;
    iconType?: "icon" | "emoji" | "image" | null;
    icon?: string | null;
    color?: string | null;
    hasImage?: boolean;
    updatedAt?: string;
  } | null;
};

export function TranscriptionMenuItem({
  transcription,
  isActive,
  study,
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
        // The study badge already occupies the icon slot; a second icon next to
        // it reads as noise rather than as information.
        if (study) return null;
        // Two states, two silhouettes: a written document, or a recording.
        return transcription.mediaType === "text" ? (
          <FileTextIcon className="h-4 w-4" />
        ) : (
          <FileAudio2Icon className="h-4 w-4" />
        );
    }
  };

  return (
    <SidebarMenuItem>
      <Link href={`/app/transcription/${transcription.id}`}>
        <SidebarMenuButton isActive={isActive}>
          {getStatusIcon()}
          <span className="flex min-w-0 flex-1 items-center gap-1">
            {study && (
              <ProjectBadge
                appearance={study}
                projectId={study.id}
                name={study.name}
                size="xs"
                imageVersion={study.updatedAt}
                title={study.name}
              />
            )}
            <span className="truncate">{transcription.title}</span>
          </span>
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
