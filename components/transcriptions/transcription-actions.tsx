"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import {
  DownloadIcon,
  FileAudio2Icon,
  FileIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import { useTranscriptionDeleteModal } from "./dialogs/transcription-delete-dialog";
import { useTranscriptionRenameModal } from "./dialogs/transcription-rename-dialog";
import { useTranscriptionSetProjectModal } from "./dialogs/transcription-set-project-dialog";

type TranscriptionActionsProps = {
  transcriptionId: string;
  transcriptionName: string;
  projectId?: string;
};

export function TranscriptionActions({
  transcriptionId,
  transcriptionName,
  projectId,
}: TranscriptionActionsProps) {
  const { openRename } = useTranscriptionRenameModal();
  const { openSetProject } = useTranscriptionSetProjectModal();
  const { openDelete } = useTranscriptionDeleteModal();

  const handleRename = () => {
    openRename(transcriptionId, transcriptionName);
  };

  const handleSetProject = () => {
    openSetProject(transcriptionId, projectId);
  };

  const handleDelete = () => {
    openDelete(transcriptionId, transcriptionName);
  };

  const handleDuplicate = () => {
    // TODO: Implement duplicate
    console.log("Duplicate transcription:", transcriptionId);
  };

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log("Export as CSV:", transcriptionId);
  };

  const handleExportTXT = () => {
    // TODO: Implement TXT export
    console.log("Export as TXT:", transcriptionId);
  };

  const handleExportWord = () => {
    // TODO: Implement Word export
    console.log("Export as Word:", transcriptionId);
  };

  const handleExportJSON = () => {
    // TODO: Implement JSON export
    console.log("Export as JSON:", transcriptionId);
  };

  const handleDownloadAudio = () => {
    // TODO: Implement audio download
    console.log("Download audio:", transcriptionId);
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

      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleDownloadAudio}>
        <FileAudio2Icon className="h-4 w-4 mr-2" />
        Download audio file
      </DropdownMenuItem>
    </>
  );

  return (
    <>
      <div className="space-x-2 flex">
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
          <DropdownMenuSeparator />
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
          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </>
  );
}
