"use client";

import * as React from "react";
import Link from "next/link";
import { SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { FileTextIcon, LoaderIcon, AlertCircleIcon } from "lucide-react";

type TranscriptionState = "PENDING" | "COMPLETED" | "ERROR";

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
    }
  };

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
