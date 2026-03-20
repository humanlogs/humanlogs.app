"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { FileTextIcon, LoaderIcon, AlertCircleIcon } from "lucide-react";

type TranscriptionState = "PENDING" | "TRANSCRIBING" | "COMPLETED" | "ERROR";

type TranscriptionMenuItemProps = {
  transcription: {
    id: string;
    title: string;
    state: TranscriptionState;
    errorMessage?: string | null;
  };
  isActive: boolean;
};

export function TranscriptionMenuItem({
  transcription,
  isActive,
}: TranscriptionMenuItemProps) {
  const handleStatusClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (transcription.state === "ERROR") {
      // Show error message (you can customize this with a toast or modal)
      alert(
        transcription.errorMessage || "An error occurred during transcription",
      );
    } else if (transcription.state === "TRANSCRIBING") {
      // Optionally show progress info
      console.log("Transcription in progress:", transcription.id);
    }
  };

  const getStatusIcon = () => {
    switch (transcription.state) {
      case "TRANSCRIBING":
        return (
          <button
            type="button"
            onClick={handleStatusClick}
            className="flex items-center justify-center shrink-0"
            aria-label="Transcription in progress"
          >
            <LoaderIcon className="h-4 w-4 animate-spin text-blue-500" />
          </button>
        );
      case "ERROR":
        return (
          <button
            type="button"
            onClick={handleStatusClick}
            className="flex items-center justify-center shrink-0 hover:opacity-80 transition-opacity"
            aria-label="Transcription error - click for details"
          >
            <AlertCircleIcon className="h-4 w-4 text-red-500" />
          </button>
        );
      case "COMPLETED":
      case "PENDING":
      default:
        return <FileTextIcon className="h-4 w-4" />;
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
