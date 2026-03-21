"use client";

import { Badge } from "@/components/ui/badge";
import { TranscriptionDetail } from "../../hooks/use-api";

type TranscriptionEditorProps = {
  transcription: TranscriptionDetail;
};

export function TranscriptionEditor({
  transcription,
}: TranscriptionEditorProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Transcription Content */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-4">Transcription</h3>
        {transcription.transcription ? (
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {JSON.stringify(transcription.transcription, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <p>No transcription content available</p>
          </div>
        )}
      </div>
    </div>
  );
}
