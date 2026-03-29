"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { TranscriptionContent } from "@/hooks/use-transcriptions";
import { useTranslations } from "@/components/locale-provider";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";
import { exportAsTXTWithOptions } from "@/lib/export-utils";

export type TranscriptionExportModalData = {
  transcription: TranscriptionContent;
  fileName: string;
};

export function useTranscriptionExportModal() {
  const modal = useModal<TranscriptionExportModalData>(
    "transcription-export-modal",
  );

  return {
    ...modal,
    openExport: (transcription: TranscriptionContent, fileName: string) => {
      modal.open({ transcription, fileName });
    },
  };
}

export function TranscriptionExportDialog() {
  const { isOpen, data, close } = useTranscriptionExportModal();
  const [textFormat, setTextFormat] = React.useState("original");
  const [showSpeakerNames, setShowSpeakerNames] = React.useState("show");
  const [lineBreaks, setLineBreaks] = React.useState("keep");
  const [selectedSpeaker, setSelectedSpeaker] = React.useState("all");
  const t = useTranslations("dialog.export");

  // Initialize when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTextFormat("original");
      setShowSpeakerNames("show");
      setLineBreaks("keep");
      setSelectedSpeaker("all");
    }
  }, [isOpen]);

  const handleExport = () => {
    if (!data) return;

    // Determine text transformations based on format
    const toLowerCase = textFormat !== "original";
    const removeAccents =
      textFormat === "lowercase-no-accents" ||
      textFormat === "lowercase-no-accents-no-punctuation";
    const removePunctuation =
      textFormat === "lowercase-no-accents-no-punctuation";

    // Determine speakers to include
    const speakerIds =
      selectedSpeaker === "all"
        ? data.transcription.speakers.map((s) => s.id)
        : [selectedSpeaker];

    try {
      exportAsTXTWithOptions(data.transcription, data.fileName, {
        speakerIds,
        toLowerCase,
        removeAccents,
        removePunctuation,
        showSpeakerNames: showSpeakerNames === "show",
        keepLineBreaks: lineBreaks === "keep",
      });
      toast.success(t("success"));
      close();
    } catch (error) {
      toast.error(t("error"));
      console.error("Export error:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">{t("speakers")}</div>
            {/* Speaker selection - full width */}
            <Select
              size="md"
              className="w-full"
              options={[
                { label: t("allSpeakers"), value: "all" },
                ...(data?.transcription.speakers.map((speaker) => ({
                  label: speaker.name || `Speaker ${speaker.id}`,
                  value: speaker.id,
                })) || []),
              ]}
              value={selectedSpeaker}
              onChange={setSelectedSpeaker}
              placeholder={t("selectSpeaker")}
              searchPlaceholder={t("searchSpeakers")}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("textFormat")}</div>
            {/* Compact row of options */}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                size="sm"
                className="w-max inline-flex"
                options={[
                  { label: t("original"), value: "original" },
                  { label: t("lowercase"), value: "lowercase" },
                  {
                    label: t("lowercaseNoAccents"),
                    value: "lowercase-no-accents",
                  },
                  {
                    label: t("lowercaseNoAccentsNoPunctuation"),
                    value: "lowercase-no-accents-no-punctuation",
                  },
                ]}
                value={textFormat}
                onChange={setTextFormat}
                placeholder={t("textFormat")}
              />
              <Select
                size="sm"
                className="w-max inline-flex"
                options={[
                  { label: t("showSpeakerNames"), value: "show" },
                  { label: t("hideSpeakerNames"), value: "hide" },
                ]}
                value={showSpeakerNames}
                onChange={setShowSpeakerNames}
                placeholder={t("showSpeakerNames")}
              />
              <Select
                size="sm"
                className="w-max inline-flex"
                options={[
                  { label: t("keepLinebreaks"), value: "keep" },
                  { label: t("removeLinebreaks"), value: "remove" },
                ]}
                value={lineBreaks}
                onChange={setLineBreaks}
                placeholder={t("keepLinebreaks")}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("cancel")}
          </Button>
          <Button onClick={handleExport}>{t("exportTxt")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
