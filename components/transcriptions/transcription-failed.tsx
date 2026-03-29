"use client";

import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";

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
  const t = useTranslations("editor");

  return (
    <div className="space-y-6 h-[50vh] flex flex-col items-center justify-center">
      {/* Error Message */}
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-destructive mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive mb-2 text-lg">
              {t("status.failed.title")}
            </h3>
            <p className="text-sm text-destructive/90">
              {transcription.errorMessage || t("status.failed.unknownError")}
            </p>
          </div>
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-card rounded-lg border p-6">
        <h3 className="font-semibold mb-3">{t("status.failed.whatCanIDo")}</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• {t("status.failed.checkFormat")}</li>
          <li>• {t("status.failed.checkCorrupted")}</li>
          <li>• {t("status.failed.tryAgain")}</li>
          <li>• {t("status.failed.contactSupport")}</li>
        </ul>
      </div>
    </div>
  );
}
