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
      toast.success("Export réussi");
      close();
    } catch (error) {
      toast.error("Erreur lors de l'export");
      console.error("Export error:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Advanced Export</DialogTitle>
          <DialogDescription>
            Configure export options for your transcription
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Speakers</div>
            {/* Speaker selection - full width */}
            <Select
              size="md"
              className="w-full"
              options={[
                { label: "All speakers", value: "all" },
                ...(data?.transcription.speakers.map((speaker) => ({
                  label: speaker.name || `Speaker ${speaker.id}`,
                  value: speaker.id,
                })) || []),
              ]}
              value={selectedSpeaker}
              onChange={setSelectedSpeaker}
              placeholder="Select speaker"
              searchPlaceholder="Search speakers..."
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Text Format</div>
            {/* Compact row of options */}
            <div className="flex flex-wrap items-center gap-2">
              <Select
                size="sm"
                className="w-max inline-flex"
                options={[
                  { label: "Original text", value: "original" },
                  { label: "Lowercase", value: "lowercase" },
                  {
                    label: "Lowercase, no accents",
                    value: "lowercase-no-accents",
                  },
                  {
                    label: "Lowercase, no accents, no punctuation",
                    value: "lowercase-no-accents-no-punctuation",
                  },
                ]}
                value={textFormat}
                onChange={setTextFormat}
                placeholder="Text format"
              />
              <Select
                size="sm"
                className="w-max inline-flex"
                options={[
                  { label: "Show speaker names", value: "show" },
                  { label: "Hide speaker names", value: "hide" },
                ]}
                value={showSpeakerNames}
                onChange={setShowSpeakerNames}
                placeholder="Speaker names"
              />
              <Select
                size="sm"
                className="w-max inline-flex"
                options={[
                  { label: "Keep linebreaks", value: "keep" },
                  { label: "Remove linebreaks", value: "remove" },
                ]}
                value={lineBreaks}
                onChange={setLineBreaks}
                placeholder="Linebreaks"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleExport}>Export TXT</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
