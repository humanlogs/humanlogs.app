"use client";

import { AlertCircleIcon, KeyIcon, LockIcon } from "lucide-react";
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
  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-4">
            <LockIcon className="w-8 h-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Cannot Access Transcription</h2>
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
                    Encryption Certificate Required
                  </p>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    This transcription is encrypted. You need to import your
                    encryption certificate to access it.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-sm">What you need to do:</h3>
              <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                <li>
                  Locate your encryption certificate file (downloaded when you
                  enabled encryption)
                </li>
                <li>Click the button below to import it</li>
                <li>Your encrypted transcriptions will then be accessible</li>
              </ol>
            </div>

            {onImportCertificate && (
              <Button
                onClick={onImportCertificate}
                className="w-full"
                size="lg"
              >
                <KeyIcon className="w-4 h-4 mr-2" />
                Import Certificate
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
                    Certificate Mismatch
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This transcription was encrypted with a different
                    certificate. The certificate loaded on this device cannot
                    decrypt it.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-sm">Possible reasons:</h3>
              <ul className="text-sm text-muted-foreground space-y-2 ml-4 list-disc">
                <li>This transcription was created by a different user</li>
                <li>
                  You&apos;ve reset your encryption and this is an old
                  transcription
                </li>
                <li>You&apos;re using a different encryption certificate</li>
              </ul>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> If you have the original certificate that
                was used to encrypt this transcription, you can try importing
                it.
              </p>
            </div>

            {onImportCertificate && (
              <Button
                onClick={onImportCertificate}
                variant="outline"
                className="w-full"
              >
                <KeyIcon className="w-4 h-4 mr-2" />
                Try Different Certificate
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
