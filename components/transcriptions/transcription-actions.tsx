"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { TranscriptionContent } from "@/hooks/use-api";
import {
  exportAsCSV,
  exportAsJSON,
  exportAsTXTWithOptions,
  exportAsWord,
} from "@/lib/export-utils";
import {
  DownloadIcon,
  FileAudio2Icon,
  FileIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  HistoryIcon,
  MoreVerticalIcon,
  PencilIcon,
  Settings2Icon,
  TrashIcon,
  UserCogIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSpeakerOptionsModal } from "./dialogs/speaker-options-dialog";
import { useTranscriptionDeleteModal } from "./dialogs/transcription-delete-dialog";
import { useTranscriptionExportModal } from "./dialogs/transcription-export-dialog";
import { useTranscriptionRenameModal } from "./dialogs/transcription-rename-dialog";
import { useTranscriptionSetProjectModal } from "./dialogs/transcription-set-project-dialog";
import { SaveStatus } from "./editor/hooks/use-auto-save";
import { useTranscriptionHistoryModal } from "./transcription-history-sheet";

type TranscriptionActionsProps = {
  transcriptionId: string;
  transcriptionName: string;
  projectId?: string;
  saveStatus?: SaveStatus;
  transcription?: TranscriptionContent;
};

export function TranscriptionActions({
  transcriptionId,
  transcriptionName,
  projectId,
  saveStatus = "idle",
  transcription,
}: TranscriptionActionsProps) {
  const { openRename } = useTranscriptionRenameModal();
  const { openSetProject } = useTranscriptionSetProjectModal();
  const { openDelete } = useTranscriptionDeleteModal();
  const { openExport } = useTranscriptionExportModal();
  const { openHistory } = useTranscriptionHistoryModal();
  const { openSpeakerOptions } = useSpeakerOptionsModal();

  const handleRename = () => {
    openRename(transcriptionId, transcriptionName);
  };

  const handleSetProject = () => {
    openSetProject(transcriptionId, projectId);
  };

  const handleDelete = () => {
    openDelete(transcriptionId, transcriptionName);
  };

  const handleOpenHistory = () => {
    openHistory(transcriptionId);
  };

  const handleExportCSV = () => {
    if (!transcription) {
      toast.error("No transcription data available");
      return;
    }
    try {
      exportAsCSV(transcription, transcriptionName);
      toast.success("Exported as CSV");
    } catch (error) {
      toast.error("Failed to export CSV");
      console.error("Export CSV error:", error);
    }
  };

  const handleExportTXT = () => {
    if (!transcription) {
      toast.error("No transcription data available");
      return;
    }
    try {
      // Use basic export with default options
      exportAsTXTWithOptions(transcription, transcriptionName, {
        speakerIds: transcription.speakers.map((s) => s.id),
        toLowerCase: false,
        removeAccents: false,
        removePunctuation: false,
        showSpeakerNames: true,
        keepLineBreaks: true,
      });
      toast.success("Exported as TXT");
    } catch (error) {
      toast.error("Failed to export TXT");
      console.error("Export TXT error:", error);
    }
  };

  const handleExportAdvanced = () => {
    if (!transcription) {
      toast.error("No transcription data available");
      return;
    }
    // Open the advanced export dialog
    openExport(transcription, transcriptionName);
  };

  const handleExportWord = async () => {
    if (!transcription) {
      toast.error("No transcription data available");
      return;
    }
    try {
      await exportAsWord(transcription, transcriptionName);
      toast.success("Exported as Word document");
    } catch (error) {
      toast.error("Failed to export Word document");
      console.error("Export Word error:", error);
    }
  };

  const handleExportJSON = () => {
    if (!transcription) {
      toast.error("No transcription data available");
      return;
    }
    try {
      exportAsJSON(transcription, transcriptionName);
      toast.success("Exported as JSON");
    } catch (error) {
      toast.error("Failed to export JSON");
      console.error("Export JSON error:", error);
    }
  };

  const handleDownloadAudio = () => {
    try {
      // Create a link to download the audio file
      const link = document.createElement("a");
      link.href = `/api/transcriptions/${transcriptionId}/audio`;
      link.download = transcriptionName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Downloading audio file");
    } catch (error) {
      toast.error("Failed to download audio file");
      console.error("Download audio error:", error);
    }
  };

  const handleSpeakerOptions = () => {
    if (!transcription) {
      toast.error("No transcription data available");
      return;
    }
    // Map TranscriptionContent speakers to Speaker type
    const speakers = transcription.speakers.map((s) => ({
      id: s.id,
      name: s.name,
    }));
    openSpeakerOptions(
      transcription,
      speakers,
      transcription.words,
      (options) => {
        // TODO: Implement speaker options application logic
        // This would need to call an API endpoint to update the transcription
        console.log("Speaker options to apply:", options);
        toast.info("Speaker options feature - implementation in progress");
      },
    );
  };

  const downloadMenu = (
    <>
      <DropdownMenuItem onClick={handleExportCSV}>
        <FileTextIcon className="h-4 w-4 mr-2" />
        CSV
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleExportTXT}>
        <FileTextIcon className="h-4 w-4 mr-2" />
        TXT
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleExportWord}>
        <FileIcon className="h-4 w-4 mr-2" />
        Word
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleExportJSON}>
        <FileJsonIcon className="h-4 w-4 mr-2" />
        JSON
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleExportAdvanced}>
        <Settings2Icon className="h-4 w-4 mr-2" />
        Advanced
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleDownloadAudio}>
        <FileAudio2Icon className="h-4 w-4 mr-2" />
        Download audio file
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      <div className="space-x-2 flex items-center">
        {/* Save status indicator */}
        {saveStatus !== "idle" && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-4">
            {saveStatus === "saving" && <>Saving...</>}
            {saveStatus === "saved" && <>Saved</>}
            {saveStatus === "error" && (
              <>
                {" "}
                <XCircleIcon className="h-3.5 w-3.5 text-destructive" />{" "}
                <span className="text-destructive">You are offline</span>
              </>
            )}
          </div>
        )}

        <DropdownMenu
          trigger={
            <Button variant={"ghost"} size="icon-sm">
              <DownloadIcon className="h-4 w-4" />
            </Button>
          }
          align="end"
        >
          {downloadMenu}
        </DropdownMenu>
        <Button variant={"ghost"} size="icon-sm" onClick={handleOpenHistory}>
          <HistoryIcon className="h-4 w-4" />
        </Button>
        <DropdownMenu
          trigger={
            <Button variant={"ghost"} size="icon-sm">
              <MoreVerticalIcon className="h-4 w-4" />
            </Button>
          }
          align="end"
        >
          <DropdownMenuItem onClick={handleRename}>
            <PencilIcon className="h-4 w-4 mr-2" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSetProject}>
            <FolderIcon className="h-4 w-4 mr-2" />
            Set Project
          </DropdownMenuItem>
          <DropdownMenuSub
            trigger={
              <>
                <DownloadIcon className="h-4 w-4 mr-2" />
                Download as...
              </>
            }
          >
            {downloadMenu}
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSpeakerOptions}>
            <UserCogIcon className="h-4 w-4 mr-2" />
            Speaker Options
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </>
  );
}
