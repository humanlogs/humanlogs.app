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
import {
  TranscriptionContent,
  TranscriptionSegment,
} from "@/hooks/use-transcriptions";
import { useTranslations } from "@/components/locale-provider";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";
import { AlertCircle } from "lucide-react";
import {
  getSpeakerLabel,
  Speaker,
} from "../editor/text/hooks/use-speaker-actions";

export type SpeakerOptionsModalData = {
  transcription: TranscriptionContent;
  speakers: Speaker[];
  segments: TranscriptionSegment[];
  onApply: (options: SpeakerOptionsData) => void;
  initialSpeakerId?: string;
};

export type SpeakerOptionsData = {
  speakerId: string;
  modification: string;
  mergeToSpeakerId: string | null;
  removeContent: boolean;
};

export function useSpeakerOptionsModal() {
  const modal = useModal<SpeakerOptionsModalData>("speaker-options-modal");

  return {
    ...modal,
    openSpeakerOptions: (
      transcription: TranscriptionContent,
      speakers: Speaker[],
      segments: TranscriptionSegment[],
      onApply: (options: SpeakerOptionsData) => void,
      initialSpeakerId?: string,
    ) => {
      modal.open({
        transcription,
        speakers,
        segments,
        onApply,
        initialSpeakerId,
      });
    },
  };
}

export function SpeakerOptionsDialog() {
  const { isOpen, data, close } = useSpeakerOptionsModal();
  const [selectedSpeaker, setSelectedSpeaker] = React.useState<string>("");
  const [modification, setModification] = React.useState("none");
  const [mergeTo, setMergeTo] = React.useState("no-merge");
  const [removeContent, setRemoveContent] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const t = useTranslations("dialog.speakerOptions");

  // Initialize when modal opens
  React.useEffect(() => {
    if (isOpen && data?.speakers.length) {
      setSelectedSpeaker(data.initialSpeakerId || data.speakers[0].id);
      setModification("none");
      setMergeTo("no-merge");
      setRemoveContent(false);
      setShowConfirm(false);
    }
  }, [isOpen, data]);

  // Calculate word count for selected speaker
  const wordCount = React.useMemo(() => {
    if (!data || !selectedSpeaker) return 0;

    const speakerSegments = data.segments.filter(
      (seg) => seg.speakerId === selectedSpeaker,
    );

    return speakerSegments.reduce((total, seg) => {
      const words = seg.text.trim().split(/\s+/).length;
      return total + words;
    }, 0);
  }, [data, selectedSpeaker]);

  const handleApply = () => {
    if (!data || !selectedSpeaker) return;

    // Check if any destructive action is being performed
    const isDestructive = removeContent || mergeTo !== "no-merge";

    if (isDestructive && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    const options: SpeakerOptionsData = {
      speakerId: selectedSpeaker,
      modification,
      mergeToSpeakerId: mergeTo === "no-merge" ? null : mergeTo,
      removeContent,
    };

    data.onApply(options);
    toast.success(t("success"));
    close();
  };

  const handleCancel = () => {
    if (showConfirm) {
      setShowConfirm(false);
    } else {
      close();
    }
  };

  // Get available speakers for merge (excluding selected speaker)
  const availableMergeSpeakers = React.useMemo(() => {
    if (!data || !selectedSpeaker) return [];
    return data.speakers.filter((s) => s.id !== selectedSpeaker);
  }, [data, selectedSpeaker]);

  // Get speaker label for selected speaker
  const selectedSpeakerLabel = React.useMemo(() => {
    if (!data || !selectedSpeaker) return "";
    return getSpeakerLabel(selectedSpeaker, data.speakers);
  }, [data, selectedSpeaker]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {showConfirm ? t("confirmTitle") : t("description")}
          </DialogDescription>
        </DialogHeader>

        {showConfirm ? (
          <div className="space-y-4 px-6">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="font-medium text-sm text-amber-900 dark:text-amber-100">
                  {t("confirmWarning")}
                </div>
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  {removeContent && (
                    <p>
                      {t("confirmRemove", {
                        speaker: selectedSpeakerLabel,
                      })}
                    </p>
                  )}
                  {mergeTo !== "no-merge" && !removeContent && (
                    <p>
                      {t("confirmMerge", {
                        from: selectedSpeakerLabel,
                        to: getSpeakerLabel(mergeTo, data?.speakers || []),
                      })}
                    </p>
                  )}
                  {removeContent && mergeTo !== "no-merge" && (
                    <p className="mt-2">
                      And merge the remaining content into{" "}
                      <strong>
                        {getSpeakerLabel(mergeTo, data?.speakers || [])}
                      </strong>
                      .
                    </p>
                  )}
                  <p className="mt-2">
                    {wordCount === 1
                      ? t("confirmAffected", { count: wordCount })
                      : t("confirmAffectedPlural", { count: wordCount })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">{t("selectSpeaker")}</div>
              <Select
                size="md"
                className="w-full"
                options={
                  data?.speakers.map((speaker) => ({
                    label: getSpeakerLabel(speaker.id, data.speakers),
                    value: speaker.id,
                  })) || []
                }
                value={selectedSpeaker}
                onChange={setSelectedSpeaker}
                placeholder={t("speaker")}
                searchPlaceholder={t("searchSpeakers")}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">{t("modification")}</div>
              <Select
                size="md"
                className="w-full"
                options={[
                  { label: t("modificationNone"), value: "none" },
                  { label: t("modificationUppercase"), value: "uppercase" },
                  { label: t("modificationLowercase"), value: "lowercase" },
                  { label: "Bold", value: "bold" },
                  { label: "Italic", value: "italic" },
                  { label: "Underline", value: "underline" },
                ]}
                value={modification}
                onChange={setModification}
                placeholder={t("modification")}
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">{t("mergeSpeaker")}</div>
              <Select
                size="md"
                className="w-full"
                options={[
                  { label: t("noMerge"), value: "no-merge" },
                  ...availableMergeSpeakers.map((speaker) => ({
                    label: getSpeakerLabel(speaker.id, data?.speakers || []),
                    value: speaker.id,
                  })),
                ]}
                value={mergeTo}
                onChange={setMergeTo}
                placeholder={t("mergeSpeaker")}
                searchPlaceholder={t("searchSpeakers")}
              />
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="text-sm font-medium">{t("removeContent")}</div>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="remove-content"
                  checked={removeContent}
                  onChange={(e) => setRemoveContent(e.target.checked)}
                  className="mt-1"
                />
                <label
                  htmlFor="remove-content"
                  className="text-sm text-muted-foreground cursor-pointer flex-1"
                >
                  {t("removeContentLabel")}
                  {removeContent && wordCount > 0 && (
                    <span className="block mt-1 text-xs">
                      Approximately{" "}
                      <strong>
                        {wordCount}{" "}
                        {wordCount === 1
                          ? t("wordCount")
                          : t("wordCountPlural")}
                      </strong>{" "}
                      will be removed
                    </span>
                  )}
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {showConfirm ? t("back") : t("cancel")}
          </Button>
          <Button onClick={handleApply} disabled={!selectedSpeaker}>
            {showConfirm ? t("confirm") : t("apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
