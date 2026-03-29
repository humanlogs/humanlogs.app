"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { TranscriptionContent } from "@/hooks/use-transcriptions";
import { downloadAndDecryptAudio } from "@/lib/audio-decryption.browser";
import { downloadAsMP3 } from "@/lib/audio-conversion.browser";
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
  KeyboardIcon,
  KeyIcon,
  MoreVerticalIcon,
  PencilIcon,
  Settings2Icon,
  TrashIcon,
  UserCogIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useShortcutsModal } from "./dialogs/shortcuts-dialog";
import { useSpeakerOptionsModal } from "./dialogs/speaker-options-dialog";
import { useTranscriptionDeleteModal } from "./dialogs/transcription-delete-dialog";
import { useTranscriptionExportModal } from "./dialogs/transcription-export-dialog";
import { useTranscriptionRenameModal } from "./dialogs/transcription-rename-dialog";
import { useTranscriptionSetProjectModal } from "./dialogs/transcription-set-project-dialog";
import { SaveStatus } from "./editor/hooks/use-auto-save";
import { useTranscriptionHistoryModal } from "./transcription-history-sheet";
import { useOptionalEditorState } from "./editor/editor-state-context";

type TranscriptionActionsProps = {
  transcriptionId: string;
  transcriptionName: string;
  projectId?: string;
  saveStatus?: SaveStatus;
  transcription?: TranscriptionContent;
  audioFileEncryption?: string;
};

export function TranscriptionActions({
  transcriptionId,
  transcriptionName,
  projectId,
  saveStatus = "idle",
  transcription,
  audioFileEncryption,
}: TranscriptionActionsProps) {
  const { openRename } = useTranscriptionRenameModal();
  const { openSetProject } = useTranscriptionSetProjectModal();
  const { openDelete } = useTranscriptionDeleteModal();
  const { openExport } = useTranscriptionExportModal();
  const { openHistory } = useTranscriptionHistoryModal();
  const { openSpeakerOptions } = useSpeakerOptionsModal();
  const { open: openShortcuts } = useShortcutsModal();

  // Get live editor state if available, otherwise use the original transcription
  const editorStateContext = useOptionalEditorState();

  /**
   * Get the current transcription content to export.
   * Prefers live editor state if available, falls back to original transcription.
   */
  const getTranscriptionContent = (): TranscriptionContent | undefined => {
    if (editorStateContext) {
      const state = editorStateContext.getState();
      if (state) {
        return {
          words: state.segments,
          speakers: state.speakers,
        };
      }
    }
    return transcription;
  };

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
    const content = getTranscriptionContent();
    if (!content) {
      toast.error("No transcription data available");
      return;
    }
    try {
      exportAsCSV(content, transcriptionName);
      toast.success("Exported as CSV");
    } catch (error) {
      toast.error("Failed to export CSV");
      console.error("Export CSV error:", error);
    }
  };

  const handleExportTXT = () => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error("No transcription data available");
      return;
    }
    try {
      // Use basic export with default options
      exportAsTXTWithOptions(content, transcriptionName, {
        speakerIds: content.speakers.map((s) => s.id),
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
    const content = getTranscriptionContent();
    if (!content) {
      toast.error("No transcription data available");
      return;
    }
    // Open the advanced export dialog
    openExport(content, transcriptionName);
  };

  const handleExportWord = async () => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error("No transcription data available");
      return;
    }
    try {
      await exportAsWord(content, transcriptionName);
      toast.success("Exported as Word document");
    } catch (error) {
      toast.error("Failed to export Word document");
      console.error("Export Word error:", error);
    }
  };

  const handleExportJSON = () => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error("No transcription data available");
      return;
    }
    try {
      exportAsJSON(content, transcriptionName);
      toast.success("Exported as JSON");
    } catch (error) {
      toast.error("Failed to export JSON");
      console.error("Export JSON error:", error);
    }
  };

  const handleDownloadAudio = async () => {
    try {
      if (!audioFileEncryption) {
        // No encryption, download directly
        const link = document.createElement("a");
        link.href = `/api/transcriptions/${transcriptionId}/audio`;
        link.download = transcriptionName + ".ogg";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Downloading audio file");
        return;
      }

      // Download and decrypt the audio file
      toast.info("Downloading and decrypting audio file...");
      const decryptedBlob = await downloadAndDecryptAudio(
        transcriptionId,
        audioFileEncryption,
      );

      // Create download link for decrypted audio
      const url = URL.createObjectURL(decryptedBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = transcriptionName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Audio file downloaded");
    } catch (error) {
      toast.error("Failed to download audio file");
      console.error("Download audio error:", error);
    }
  };

  const handleDownloadAudioAsMP3 = async () => {
    try {
      let audioBlob: Blob;

      if (!audioFileEncryption) {
        // No encryption, fetch directly
        toast.info("Downloading audio file...");
        const response = await fetch(
          `/api/transcriptions/${transcriptionId}/audio`,
        );
        if (!response.ok) {
          throw new Error("Failed to download audio file");
        }
        audioBlob = await response.blob();
      } else {
        // Download and decrypt the audio file
        toast.info("Downloading and decrypting audio file...");
        audioBlob = await downloadAndDecryptAudio(
          transcriptionId,
          audioFileEncryption,
        );
      }

      // Convert to MP3 and download (ffmpeg lazy loaded inside)
      await downloadAsMP3(audioBlob, transcriptionName, "opus");
    } catch (error) {
      toast.error("Failed to convert and download MP3");
      console.error("Download MP3 error:", error);
    }
  };

  const handleSpeakerOptions = () => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error("No transcription data available");
      return;
    }
    // Map TranscriptionContent speakers to Speaker type
    const speakers = content.speakers.map((s) => ({
      id: s.id,
      name: s.name,
    }));
    openSpeakerOptions(content, speakers, content.words, (options) => {
      // TODO: Implement speaker options application logic
      // This would need to call an API endpoint to update the transcription
      console.log("Speaker options to apply:", options);
      toast.info("Speaker options feature - implementation in progress");
    });
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
        Download original audio
      </DropdownMenuItem>
      <DropdownMenuItem onClick={handleDownloadAudioAsMP3}>
        <FileAudio2Icon className="h-4 w-4 mr-2" />
        Download as MP3
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

        {!!audioFileEncryption && (
          <DropdownMenu
            trigger={
              <Button variant={"ghost"} size="icon-sm">
                <KeyIcon className="h-4 w-4 text-blue-500" />
              </Button>
            }
            align="end"
          >
            <DropdownMenuItem>
              This transcription is end-to-end encrypted.
            </DropdownMenuItem>
          </DropdownMenu>
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
          <DropdownMenuItem onClick={openShortcuts}>
            <KeyboardIcon className="h-4 w-4 mr-2" />
            Keyboard Shortcuts
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
