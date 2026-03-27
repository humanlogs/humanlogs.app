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
import { TranscriptionContent, TranscriptionSegment } from "@/hooks/use-api";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";
import { getSpeakerLabel, Speaker } from "../editor/hooks/use-speaker-actions";
import { AlertCircle } from "lucide-react";

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
    toast.success("Speaker options applied");
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
    return getSpeakerLabel(selectedSpeaker, data.speakers, data.segments);
  }, [data, selectedSpeaker]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Speaker Options</DialogTitle>
          <DialogDescription>
            {showConfirm
              ? "Please confirm this action"
              : "Modify, merge, or remove speaker content"}
          </DialogDescription>
        </DialogHeader>

        {showConfirm ? (
          <div className="space-y-4 py-4 px-6">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <div className="font-medium text-sm text-amber-900 dark:text-amber-100">
                  Confirm your action
                </div>
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  {removeContent && (
                    <p>
                      You are about to remove approximately{" "}
                      <strong>{wordCount} words</strong> from{" "}
                      <strong>{selectedSpeakerLabel}</strong>.
                    </p>
                  )}
                  {mergeTo !== "no-merge" && !removeContent && (
                    <p>
                      You are about to merge{" "}
                      <strong>{selectedSpeakerLabel}</strong> into{" "}
                      <strong>
                        {getSpeakerLabel(
                          mergeTo,
                          data?.speakers || [],
                          data?.segments || [],
                        )}
                      </strong>
                      .
                    </p>
                  )}
                  {removeContent && mergeTo !== "no-merge" && (
                    <p className="mt-2">
                      And merge the remaining content into{" "}
                      <strong>
                        {getSpeakerLabel(
                          mergeTo,
                          data?.speakers || [],
                          data?.segments || [],
                        )}
                      </strong>
                      .
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4 px-6">
            <div className="space-y-2">
              <div className="text-sm font-medium">Select Speaker</div>
              <Select
                size="md"
                className="w-full"
                options={
                  data?.speakers.map((speaker) => ({
                    label: getSpeakerLabel(
                      speaker.id,
                      data.speakers,
                      data.segments,
                    ),
                    value: speaker.id,
                  })) || []
                }
                value={selectedSpeaker}
                onChange={setSelectedSpeaker}
                placeholder="Select speaker"
                searchPlaceholder="Search speakers..."
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Modifications to Apply</div>
              <Select
                size="md"
                className="w-full"
                options={[
                  { label: "No modifications", value: "none" },
                  { label: "Uppercase", value: "uppercase" },
                  { label: "Lowercase", value: "lowercase" },
                  { label: "Bold", value: "bold" },
                  { label: "Italic", value: "italic" },
                  { label: "Underline", value: "underline" },
                  { label: "Parenthesis", value: "parenthesis" },
                ]}
                value={modification}
                onChange={setModification}
                placeholder="Select modification"
              />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Merge Speaker</div>
              <Select
                size="md"
                className="w-full"
                options={[
                  { label: "Do not merge", value: "no-merge" },
                  ...availableMergeSpeakers.map((speaker) => ({
                    label: getSpeakerLabel(
                      speaker.id,
                      data?.speakers || [],
                      data?.segments || [],
                    ),
                    value: speaker.id,
                  })),
                ]}
                value={mergeTo}
                onChange={setMergeTo}
                placeholder="Select speaker to merge into"
                searchPlaceholder="Search speakers..."
              />
            </div>

            <div className="pt-4 border-t space-y-3">
              <div className="text-sm font-medium">Remove Content</div>
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
                  Remove all content from this speaker
                  {removeContent && wordCount > 0 && (
                    <span className="block mt-1 text-xs">
                      Approximately <strong>{wordCount} words</strong> will be
                      removed
                    </span>
                  )}
                </label>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {showConfirm ? "Back" : "Cancel"}
          </Button>
          <Button onClick={handleApply} disabled={!selectedSpeaker}>
            {showConfirm ? "Confirm & Apply" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
