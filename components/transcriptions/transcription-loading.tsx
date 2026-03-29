"use client";

import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { TranscriptionDetail } from "../../hooks/use-transcriptions";
import { useTranslations } from "@/components/locale-provider";

type TranscriptionLoadingProps = {
  transcription: TranscriptionDetail;
};

export function TranscriptionLoading({
  transcription,
}: TranscriptionLoadingProps) {
  const t = useTranslations("editor");

  const calculateTimeRemaining = () => {
    const now = new Date();
    const startTime = new Date(transcription.createdAt);
    const elapsedMs = now.getTime() - startTime.getTime();
    const elapsedMinutes = elapsedMs / (1000 * 60);

    // Estimate audio duration from file size
    // Rough estimate: ~1 MB per minute of audio (varies by quality)
    const fileSizeMB = transcription.audioFileSize / (1024 * 1024);
    const estimatedAudioMinutes = fileSizeMB;

    // Processing speed: 10 minutes to process 60 minutes of audio = 1/6 speed
    const estimatedProcessingMinutes = estimatedAudioMinutes / 6;

    // Calculate remaining time
    const remainingMinutes = Math.max(
      0,
      estimatedProcessingMinutes - elapsedMinutes,
    );

    if (remainingMinutes < 1) {
      return t("status.loading.lessThanMinute");
    } else if (remainingMinutes < 2) {
      return t("status.loading.aboutOneMinute");
    } else if (remainingMinutes < 60) {
      return t("status.loading.aboutMinutes", {
        minutes: Math.round(remainingMinutes),
      });
    } else {
      const hours = Math.floor(remainingMinutes / 60);
      const mins = Math.round(remainingMinutes % 60);
      return t("status.loading.aboutHours", { hours, minutes: mins });
    }
  };

  const [timeRemaining, setTimeRemaining] = useState<string>(
    calculateTimeRemaining(),
  );

  // Calculate estimated completion time
  useEffect(() => {
    // Update every 10 seconds
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 10000);

    return () => clearInterval(interval);
  }, [transcription.createdAt, transcription.audioFileSize]);

  return (
    <div className="space-y-6 h-[50vh] flex flex-col items-center justify-center">
      {/* Loading Status */}
      <div className="flex flex-col items-center justify-center space-y-4 max-w-md mx-auto">
        <div className="relative">
          <Loader
            className="h-16 w-16 animate-spin text-primary"
            style={{ animationDuration: "5s" }}
          />
        </div>
        <div className="space-y-2 text-center">
          <p className="text-xl font-medium">{t("status.loading.title")}</p>
          <p className="text-sm text-muted-foreground">
            {t("status.loading.description")}
          </p>
          {timeRemaining && (
            <div className="mt-4 p-3 bg-primary/10 rounded-lg">
              <p className="text-sm font-medium text-primary">
                {timeRemaining}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
