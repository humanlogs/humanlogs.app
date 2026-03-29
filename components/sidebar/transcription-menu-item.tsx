"use client";

import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import {
  AlertCircleIcon,
  FileIcon,
  FileLock2Icon,
  FileLockIcon,
  FileTextIcon,
  LoaderIcon,
} from "lucide-react";
import Link from "next/link";
import { Tooltip } from "../ui/tooltip";

type TranscriptionState = "PENDING" | "COMPLETED" | "ERROR";

type TranscriptionMenuItemProps = {
  transcription: {
    id: string;
    title: string;
    state: TranscriptionState;
    errorMessage?: string | null;
    isEncrypted?: boolean;
  };
  isActive: boolean;
};

export function TranscriptionMenuItem({
  transcription,
  isActive,
}: TranscriptionMenuItemProps) {
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
        return transcription.isEncrypted ? (
          <FileLockIcon className="h-4 w-4" />
        ) : (
          <FileIcon className="h-4 w-4" />
        );
    }
  };

  return (
    <SidebarMenuItem>
      <Link href={`/transcription/${transcription.id}`}>
        <SidebarMenuButton isActive={isActive}>
          {getStatusIcon()}
          <span>{transcription.title}</span>
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
}
