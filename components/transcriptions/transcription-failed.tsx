"use client";

import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";

type TranscriptionFailedProps = {
  transcription: {
    audioFileName: string;
    errorMessage?: string | null;
    projectName?: string;
  };
};

export function TranscriptionFailed({
  transcription,
}: TranscriptionFailedProps) {
  return (
    <div className="space-y-6 h-[50vh] flex flex-col items-center justify-center">
      {/* Error Message */}
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-destructive mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive mb-2 text-lg">
              Transcription Failed
            </h3>
            <p className="text-sm text-destructive/90">
              {transcription.errorMessage ||
                "An unknown error occurred during transcription"}
            </p>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-3">What can I do?</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Check that your audio file is in a supported format</li>
          <li>• Ensure the audio file is not corrupted</li>
          <li>• Try uploading the file again</li>
          <li>• Contact support if the problem persists</li>
        </ul>
      </div>
    </div>
  );
}
