"use client";

import { AlertCircleIcon, KeyIcon, LockIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "../ui/button";

interface CannotAccessTranscriptionProps {
  reason: "no-certificate" | "certificate-mismatch";
  onImportCertificate?: () => void;
  transcriptionTitle?: string;
}

export function CannotAccessTranscription({
  reason,
  onImportCertificate,
  transcriptionTitle,
}: CannotAccessTranscriptionProps) {
  const t = useTranslations("account.encryption.cannotAccess");

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <LockIcon className="w-8 h-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{t("title")}</h2>
            {transcriptionTitle && (
              <p className="text-sm text-muted-foreground">
                &quot;{transcriptionTitle}&quot;
              </p>
            )}
          </div>
        </div>

        {reason === "no-certificate" ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 p-4">
              <div className="flex gap-3">
                <AlertCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                    {t("noCertificate.badge")}
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {t("noCertificate.description")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-sm">
                {t("noCertificate.steps.title")}
              </h3>
              <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                <li>{t("noCertificate.steps.step1")}</li>
                <li>{t("noCertificate.steps.step2")}</li>
                <li>{t("noCertificate.steps.step3")}</li>
              </ol>
            </div>

            {onImportCertificate && (
              <Button
                onClick={onImportCertificate}
                className="w-full"
                size="lg"
              >
                <KeyIcon className="w-4 h-4 mr-2" />
                {t("noCertificate.button")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex gap-3">
                <AlertCircleIcon className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    {t("certificateMismatch.badge")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("certificateMismatch.description")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-sm">
                {t("certificateMismatch.reasons.title")}
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                <li>{t("certificateMismatch.reasons.reason1")}</li>
                <li>{t("certificateMismatch.reasons.reason2")}</li>
                <li>{t("certificateMismatch.reasons.reason3")}</li>
              </ul>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> {t("certificateMismatch.note")}
              </p>
            </div>

            {onImportCertificate && (
              <Button
                onClick={onImportCertificate}
                variant="outline"
                className="w-full"
              >
                <KeyIcon className="w-4 h-4 mr-2" />
                {t("certificateMismatch.button")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
