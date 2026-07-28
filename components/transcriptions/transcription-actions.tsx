"use client";

import { DocumentCodesMenu } from "@/components/codebooks/document-codes-menu";
import { useTranslations } from "@/components/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { SharedUser, TranscriptionContent } from "@/hooks/use-transcriptions";
import { downloadAsMP3 } from "@/lib/audio/audio-conversion.browser";
import { downloadAndDecryptAudio } from "@/lib/audio/audio-decryption.browser";
import {
  exportAsCSV,
  exportAsJSON,
  exportAsMAXQDA,
  exportAsNVivo,
  exportAsPDF,
  exportAsSRT,
  exportAsTXTWithOptions,
  exportAsVTT,
  exportAsWord,
} from "@/lib/utils/export-utils";
import {
  BracesIcon,
  CaptionsIcon,
  DownloadIcon,
  FileAudio2Icon,
  FileIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  HistoryIcon,
  KeyboardIcon,
  KeyIcon,
  type LucideIcon,
  MicroscopeIcon,
  MoreVerticalIcon,
  PencilIcon,
  RotateCcwIcon,
  Settings2Icon,
  TableIcon,
  TrashIcon,
  UserCogIcon,
  Users2Icon,
  XCircleIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { usePauseConfigurationModal } from "./dialogs/pause-configuration-dialog";
import { useShortcutsModal } from "./dialogs/shortcuts-dialog";
import { useSpeakerOptionsModal } from "./dialogs/speaker-options-dialog";
import { useTranscriptionDeleteModal } from "./dialogs/transcription-delete-dialog";
import { useTranscriptionExportModal } from "./dialogs/transcription-export-dialog";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTranscriptionHistoryModal } from "./dialogs/transcription-history-sheet";
import { useTranscriptionRenameModal } from "./dialogs/transcription-rename-dialog";
import { useTranscriptionSetProjectModal } from "./dialogs/transcription-set-project-dialog";
import { useTranscriptionShareDialog } from "./dialogs/transcription-share-dialog";
import { SaveStatus } from "./editor/text/hooks/use-auto-save";
import { EditorAPI } from "./editor/text/api";

type ExportFormatId =
  | "word"
  | "pdf"
  | "txt"
  | "nvivo"
  | "maxqda"
  | "csv"
  | "srt"
  | "vtt"
  | "json";

type ExportFormat = {
  icon: LucideIcon;
  /** Suffix of the `exported*` / `failedExport*` toast keys in editor.json. */
  toast: string;
  run: (
    content: TranscriptionContent,
    fileName: string,
  ) => void | Promise<void>;
};

const EXPORT_FORMATS: Record<ExportFormatId, ExportFormat> = {
  word: { icon: FileIcon, toast: "Word", run: exportAsWord },
  pdf: { icon: FileIcon, toast: "PDF", run: exportAsPDF },
  txt: {
    icon: FileTextIcon,
    toast: "TXT",
    run: (content, fileName) =>
      exportAsTXTWithOptions(content, fileName, {
        speakerIds: content.speakers.map((s) => s.id),
        toLowerCase: false,
        removeAccents: false,
        removePunctuation: false,
        showSpeakerNames: true,
        keepLineBreaks: true,
      }),
  },
  nvivo: { icon: MicroscopeIcon, toast: "NVivo", run: exportAsNVivo },
  maxqda: { icon: MicroscopeIcon, toast: "MAXQDA", run: exportAsMAXQDA },
  csv: { icon: TableIcon, toast: "CSV", run: exportAsCSV },
  srt: { icon: CaptionsIcon, toast: "SRT", run: exportAsSRT },
  vtt: { icon: CaptionsIcon, toast: "VTT", run: exportAsVTT },
  json: { icon: FileJsonIcon, toast: "JSON", run: exportAsJSON },
};

/** Listed flat at the top of the menu: the formats most people actually want. */
const PRIMARY_FORMATS: ExportFormatId[] = ["word", "pdf", "txt"];

/** The rest, grouped by what the user intends to do with the file, not by extension. */
const FORMAT_GROUPS: {
  labelKey: string;
  icon: LucideIcon;
  formats: ExportFormatId[];
}[] = [
  {
    labelKey: "groupQualitative",
    icon: MicroscopeIcon,
    formats: ["nvivo", "maxqda", "csv"],
  },
  { labelKey: "groupSubtitles", icon: CaptionsIcon, formats: ["srt", "vtt"] },
  { labelKey: "groupData", icon: BracesIcon, formats: ["json"] },
];

const LAST_EXPORT_FORMAT_KEY = "transcription_export_format";

/**
 * localStorage read as an external store: it keeps the value out of React state
 * (no setState-in-effect) while still re-rendering the menu after an export.
 */
const lastFormatListeners = new Set<() => void>();

function subscribeLastFormat(onChange: () => void) {
  lastFormatListeners.add(onChange);
  return () => {
    lastFormatListeners.delete(onChange);
  };
}

function readLastFormat() {
  return localStorage.getItem(LAST_EXPORT_FORMAT_KEY);
}

function rememberLastFormat(id: ExportFormatId) {
  localStorage.setItem(LAST_EXPORT_FORMAT_KEY, id);
  lastFormatListeners.forEach((onChange) => onChange());
}

type TranscriptionActionsProps = {
  transcriptionId: string;
  transcriptionName: string;
  projectId?: string;
  saveStatus?: SaveStatus;
  transcription?: TranscriptionContent;
  audioFileEncryption?: string;
  shared?: SharedUser[];
  isOwner?: boolean;
  hasWriteAccess?: boolean;
  hasListenAccess?: boolean;
  editorAPI?: EditorAPI;
};

export function TranscriptionActions({
  transcriptionId,
  transcriptionName,
  projectId,
  saveStatus = "idle",
  transcription,
  audioFileEncryption,
  shared,
  isOwner = true,
  hasWriteAccess = true,
  hasListenAccess = true,
  editorAPI,
}: TranscriptionActionsProps) {
  const t = useTranslations("editor");
  const { openRename } = useTranscriptionRenameModal();
  const { openSetProject } = useTranscriptionSetProjectModal();
  const { openDelete } = useTranscriptionDeleteModal();
  const { openExport } = useTranscriptionExportModal();
  const { openHistory } = useTranscriptionHistoryModal();
  const { openSpeakerOptions } = useSpeakerOptionsModal();
  const { openPauseConfiguration } = usePauseConfigurationModal();
  const { open: openShortcuts } = useShortcutsModal();
  const { openShare } = useTranscriptionShareDialog();

  // `null` on the server: localStorage only exists once mounted in the browser.
  const storedFormat = React.useSyncExternalStore(
    subscribeLastFormat,
    readLastFormat,
    () => null,
  );
  const lastFormat =
    storedFormat && storedFormat in EXPORT_FORMATS
      ? (storedFormat as ExportFormatId)
      : null;

  /**
   * Get the current transcription content to export.
   * Prefers live editor state if available, falls back to original transcription.
   */
  const getTranscriptionContent = (): TranscriptionContent | undefined => {
    if (editorAPI) {
      return {
        words: editorAPI.getSegments(),
        speakers: editorAPI.getSpeakers(),
      };
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

  const handleExport = async (id: ExportFormatId) => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error(t("actions.noDataAvailable"));
      return;
    }
    const format = EXPORT_FORMATS[id];
    try {
      await format.run(content, transcriptionName);
      toast.success(t(`actions.exported${format.toast}`));
      // Remembered so a heavy NVivo/MAXQDA user gets their format back at the
      // top of the menu instead of digging through a submenu every time.
      rememberLastFormat(id);
    } catch (error) {
      toast.error(t(`actions.failedExport${format.toast}`));
      console.error(`Export ${id} error:`, error);
    }
  };

  const handleExportAdvanced = () => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error(t("actions.noDataAvailable"));
      return;
    }
    // Open the advanced export dialog
    openExport(content, transcriptionName);
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
        toast.success(t("actions.downloadingAudio"));
        return;
      }

      // Download and decrypt the audio file
      toast.info(t("actions.downloadingDecryptingAudio"));
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

      toast.success(t("actions.audioDownloaded"));
    } catch (error) {
      toast.error(t("actions.failedDownloadAudio"));
      console.error("Download audio error:", error);
    }
  };

  const handleDownloadAudioAsMP3 = async () => {
    try {
      let audioBlob: Blob;

      if (!audioFileEncryption) {
        // No encryption, fetch directly
        toast.info(t("actions.downloadingAudio"));
        const response = await fetch(
          `/api/transcriptions/${transcriptionId}/audio`,
        );
        if (!response.ok) {
          throw new Error("Failed to download audio file");
        }
        audioBlob = await response.blob();
      } else {
        // Download and decrypt the audio file
        toast.info(t("actions.downloadingDecryptingAudio"));
        audioBlob = await downloadAndDecryptAudio(
          transcriptionId,
          audioFileEncryption,
        );
      }

      // Convert to MP3 and download (ffmpeg lazy loaded inside)
      await downloadAsMP3(audioBlob, transcriptionName, "opus");
    } catch (error) {
      toast.error(t("actions.failedConvertMP3"));
      console.error("Download MP3 error:", error);
    }
  };

  const handleSpeakerOptions = () => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error(t("actions.noDataAvailable"));
      return;
    }
    // Map TranscriptionContent speakers to Speaker type
    const speakers = content.speakers.map((s) => ({
      id: s.id,
      name: s.name,
    }));
    openSpeakerOptions(content, speakers, content.words, (options) => {
      // Apply speaker options via editor API if available
      if (editorAPI) {
        editorAPI.applySpeakerOptions(options);
        toast.success("Speaker options applied");
      } else {
        // Fallback: log for future API implementation
        console.log("Speaker options to apply:", options);
        toast.info(t("actions.speakerOptionsInProgress"));
      }
    });
  };

  const handlePauseConfiguration = () => {
    const content = getTranscriptionContent();
    if (!content) {
      toast.error(t("actions.noDataAvailable"));
      return;
    }
    openPauseConfiguration(content, content.words, (options) => {
      // Use the editor API to apply pause configuration
      if (editorAPI) {
        editorAPI.applyPauseConfiguration(options);
        toast.success("Pause configuration applied");
      } else {
        // Fallback: log for future API implementation
        console.log("Pause options to apply:", options);
        toast.info("Pause configuration will be applied (not yet implemented)");
      }
    });
  };

  const formatItem = (id: ExportFormatId) => {
    const Icon = EXPORT_FORMATS[id].icon;
    return (
      <DropdownMenuItem key={id} onClick={() => handleExport(id)}>
        <Icon className="h-4 w-4 mr-2" />
        {t(`actions.${id}`)}
      </DropdownMenuItem>
    );
  };

  // Only worth pinning when it is not already one of the primary formats.
  const pinnedFormat =
    lastFormat && !PRIMARY_FORMATS.includes(lastFormat) ? lastFormat : null;

  const downloadMenu = (
    <>
      {pinnedFormat && (
        <>
          <DropdownMenuItem onClick={() => handleExport(pinnedFormat)}>
            <RotateCcwIcon className="h-4 w-4 mr-2" />
            {t("actions.exportAgain", { format: t(`actions.${pinnedFormat}`) })}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      )}

      {PRIMARY_FORMATS.map(formatItem)}
      <DropdownMenuItem onClick={handleExportAdvanced}>
        <Settings2Icon className="h-4 w-4 mr-2" />
        {t("actions.txtOptions")}
      </DropdownMenuItem>

      <DropdownMenuSeparator />
      {FORMAT_GROUPS.map((group) => {
        const Icon = group.icon;
        return (
          <DropdownMenuSub
            key={group.labelKey}
            trigger={
              <>
                <Icon className="h-4 w-4 mr-2" />
                {t(`actions.${group.labelKey}`)}
              </>
            }
          >
            {group.formats.map(formatItem)}
          </DropdownMenuSub>
        );
      })}

      {hasListenAccess && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuSub
            trigger={
              <>
                <FileAudio2Icon className="h-4 w-4 mr-2" />
                {t("actions.groupAudio")}
              </>
            }
          >
            <DropdownMenuItem onClick={handleDownloadAudio}>
              <FileAudio2Icon className="h-4 w-4 mr-2" />
              {t("actions.downloadOriginalAudio")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadAudioAsMP3}>
              <FileAudio2Icon className="h-4 w-4 mr-2" />
              {t("actions.downloadAsMP3")}
            </DropdownMenuItem>
          </DropdownMenuSub>
        </>
      )}
    </>
  );

  return (
    <>
      <div className="space-x-2 flex items-center">
        {/* Save status indicator */}
        {saveStatus !== "idle" && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-4">
            {saveStatus === "saving" && <>{t("actions.saving")}</>}
            {saveStatus === "saved" && <>{t("actions.saved")}</>}
            {saveStatus === "error" && (
              <>
                {" "}
                <XCircleIcon className="h-3.5 w-3.5 text-destructive" />{" "}
                <span className="text-destructive">{t("actions.offline")}</span>
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
            <DropdownMenuItem>{t("actions.encrypted")}</DropdownMenuItem>
          </DropdownMenu>
        )}

        <Button
          variant={"ghost"}
          size="icon-sm"
          onClick={() => openShare(transcriptionId, shared, isOwner)}
          className="relative"
        >
          <Users2Icon className="h-4 w-4" />
          {shared && shared.length > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none"
            >
              {shared.length}
            </Badge>
          )}
        </Button>

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
        {/* Notifications sit where version history used to: it is the one action here
            you may need to react to, while history is a rarely-used menu entry. */}
        <NotificationBell />
        <DropdownMenu
          trigger={
            <Button variant={"ghost"} size="icon-sm">
              <MoreVerticalIcon className="h-4 w-4" />
            </Button>
          }
          align="end"
        >
          {hasWriteAccess && (
            <>
              <DropdownMenuItem onClick={handleOpenHistory}>
                <HistoryIcon className="h-4 w-4 mr-2" />
                {t("actions.history")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {isOwner && (
            <>
              <DropdownMenuItem onClick={handleRename}>
                <PencilIcon className="h-4 w-4 mr-2" />
                {t("actions.rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSetProject}>
                <FolderIcon className="h-4 w-4 mr-2" />
                {t("actions.setProject")}
              </DropdownMenuItem>
            </>
          )}

          {/* Codes of the document itself — the speakers have theirs on their
              badge, this is the same gesture one level up. */}
          {hasWriteAccess && (
            <DocumentCodesMenu
              transcriptionId={transcriptionId}
              projectId={projectId}
            />
          )}
          <DropdownMenuSub
            trigger={
              <>
                <DownloadIcon className="h-4 w-4 mr-2" />
                {t("actions.downloadAs")}
              </>
            }
          >
            {downloadMenu}
          </DropdownMenuSub>

          {hasWriteAccess && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSpeakerOptions}>
                <UserCogIcon className="h-4 w-4 mr-2" />
                {t("actions.speakerOptions")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePauseConfiguration}>
                <Settings2Icon className="h-4 w-4 mr-2" />
                Pauses
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openShortcuts}>
                <KeyboardIcon className="h-4 w-4 mr-2" />
                {t("actions.keyboardShortcuts")}
              </DropdownMenuItem>
            </>
          )}

          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                {t("actions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenu>
      </div>
    </>
  );
}
