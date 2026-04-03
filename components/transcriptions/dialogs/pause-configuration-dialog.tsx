"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  TranscriptionContent,
  TranscriptionSegment,
} from "@/hooks/use-transcriptions";
import { InfoIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";

export type PauseConfigurationModalData = {
  transcription: TranscriptionContent;
  segments: TranscriptionSegment[];
  onApply: (options: PauseConfigurationData) => void;
};

export type PauseConfigurationData = {
  shortPauseMarker: string;
  longPauseMarker: string;
  addDoubleLineBreak: boolean;
};

const PRESET_MARKERS = [
  { label: "(pause)", value: "(pause)" },
  { label: "(silence)", value: "(silence)" },
  { label: "[pause]", value: "[pause]" },
  { label: "[silence]", value: "[silence]" },
  { label: "/", value: "/" },
  { label: "Custom...", value: "custom" },
];

const PRESET_LONG_MARKERS = [
  { label: "(long pause)", value: "(long pause)" },
  { label: "(silence)", value: "(silence)" },
  { label: "[long pause]", value: "[long pause]" },
  { label: "[silence]", value: "[silence]" },
  { label: "//", value: "//" },
  { label: "Custom...", value: "custom" },
];

export function usePauseConfigurationModal() {
  const modal = useModal<PauseConfigurationModalData>(
    "pause-configuration-modal",
  );

  return {
    ...modal,
    openPauseConfiguration: (
      transcription: TranscriptionContent,
      segments: TranscriptionSegment[],
      onApply: (options: PauseConfigurationData) => void,
    ) => {
      modal.open({
        transcription,
        segments,
        onApply,
      });
    },
  };
}

export function PauseConfigurationDialog() {
  const { isOpen, data, close } = usePauseConfigurationModal();
  const [shortPausePreset, setShortPausePreset] = React.useState("(pause)");
  const [shortPauseCustom, setShortPauseCustom] = React.useState("");
  const [longPausePreset, setLongPausePreset] = React.useState("(long pause)");
  const [longPauseCustom, setLongPauseCustom] = React.useState("");
  const [addDoubleLineBreak, setAddDoubleLineBreak] = React.useState(false);

  // Initialize when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setShortPausePreset("(pause)");
      setShortPauseCustom("");
      setLongPausePreset("(long pause)");
      setLongPauseCustom("");
      setAddDoubleLineBreak(false);
    }
  }, [isOpen]);

  // Count pauses by duration
  const pauseCounts = React.useMemo(() => {
    if (!data?.segments) {
      return { shortPauses: 0, longPauses: 0 };
    }

    let shortPauses = 0;
    let longPauses = 0;

    // Group segments by speaker to detect pauses within same speaker
    for (let i = 0; i < data.segments.length; i++) {
      const segment = data.segments[i];

      // Check if it's a spacing segment
      if (
        segment.type === "spacing" &&
        segment.start !== undefined &&
        segment.end !== undefined
      ) {
        const duration = segment.end - segment.start;

        // Check if this spacing is between words of the same speaker
        const prevSegment = i > 0 ? data.segments[i - 1] : null;
        const nextSegment =
          i < data.segments.length - 1 ? data.segments[i + 1] : null;

        if (
          prevSegment &&
          nextSegment &&
          prevSegment.speakerId === nextSegment.speakerId
        ) {
          if (duration >= 3) {
            longPauses++;
          } else if (duration >= 1) {
            shortPauses++;
          }
        }
      }
    }

    return { shortPauses, longPauses };
  }, [data?.segments]);

  const handleApply = () => {
    if (!data) return;

    const shortMarker =
      shortPausePreset === "custom" ? shortPauseCustom : shortPausePreset;
    const longMarker =
      longPausePreset === "custom" ? longPauseCustom : longPausePreset;

    if (!shortMarker || !longMarker) {
      toast.error("Please provide all pause markers");
      return;
    }

    const options: PauseConfigurationData = {
      shortPauseMarker: shortMarker,
      longPauseMarker: longMarker,
      addDoubleLineBreak,
    };

    data.onApply(options);
    toast.success("Pause configuration will be applied");
    close();
  };

  const handleCancel = () => {
    close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Configure Pause Markers</DialogTitle>
          <DialogDescription>
            Customize how pauses are displayed in your transcription
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6">
          {/* Info box showing pause counts */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-500 mt-0.5 shrink-0" />
            <div className="space-y-1 text-sm">
              <div className="font-medium text-blue-900 dark:text-blue-100">
                Detected Pauses
              </div>
              <div className="text-blue-800 dark:text-blue-200">
                <p>
                  <strong>{pauseCounts.shortPauses}</strong> pauses &gt;1s
                </p>
                <p>
                  <strong>{pauseCounts.longPauses}</strong> pauses &gt;3s
                </p>
              </div>
            </div>
          </div>

          {/* Short pause configuration (>1s) */}
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Pause Marker (&gt;1 second)
            </div>
            <Select
              size="md"
              className="w-full"
              options={PRESET_MARKERS}
              value={shortPausePreset}
              onChange={setShortPausePreset}
              placeholder="Select pause marker"
            />
            {shortPausePreset === "custom" && (
              <Input
                placeholder="Enter custom marker (e.g., ...)"
                value={shortPauseCustom}
                onChange={(e) => setShortPauseCustom(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Long pause configuration (>3s) */}
          <div className="space-y-2">
            <div className="text-sm font-medium">
              Pause Marker (&gt;3 seconds)
            </div>
            <Select
              size="md"
              className="w-full"
              options={PRESET_LONG_MARKERS}
              value={longPausePreset}
              onChange={setLongPausePreset}
              placeholder="Select pause marker"
            />
            {longPausePreset === "custom" && (
              <Input
                placeholder="Enter custom marker (e.g., ......)"
                value={longPauseCustom}
                onChange={(e) => setLongPauseCustom(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Double line break option */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="double-line-break"
              checked={addDoubleLineBreak}
              onCheckedChange={(checked) =>
                setAddDoubleLineBreak(checked === true)
              }
            />
            <label
              htmlFor="double-line-break"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Add double line break after long pauses (&gt;3s)
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
