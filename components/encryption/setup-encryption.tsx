"use client";

import {
  useEnableEncryption,
  useEncryptionStatus,
  useGenerateCertificate,
  useToggleDeviceTrust,
} from "@/hooks/use-encryption";
import { CheckCircleIcon, KeyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";

interface SetupEncryptionProps {
  onComplete: () => void;
  onSkip?: () => void;
  hideSkipOption?: boolean;
}

export function SetupEncryption({
  onComplete,
  onSkip,
  hideSkipOption = false,
}: SetupEncryptionProps) {
  const [certificateDownloaded, setCertificateDownloaded] = useState(false);
  const [showTrustDialog, setShowTrustDialog] = useState(false);
  const [certificateData, setCertificateData] = useState<{
    publicKey: string;
    privateKey: string;
    deviceSecret: string;
  } | null>(null);
  const [checklist, setChecklist] = useState({
    saved: false,
    emailed: false,
    understood: false,
  });

  const generateCertificate = useGenerateCertificate();
  const enableEncryption = useEnableEncryption();
  const status = useEncryptionStatus();
  const toggleDeviceTrust = useToggleDeviceTrust();

  const allChecked =
    checklist.saved && checklist.emailed && checklist.understood;
  const canContinue = certificateDownloaded && allChecked;

  async function handleGenerateCertificate() {
    try {
      const result = await generateCertificate.mutateAsync();
      setCertificateData({
        publicKey: result.certificate.publicKey,
        privateKey: result.certificate.privateKey,
        deviceSecret: result.deviceSecret,
      });
      setCertificateDownloaded(true);
      toast.success(
        "Certificate generated and downloaded! Please save it securely.",
      );
    } catch (error) {
      console.error("Failed to generate certificate:", error);
      toast.error("Failed to generate certificate. Please try again.");
    }
  }

  function toggleChecklistItem(key: keyof typeof checklist) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleContinue() {
    // Show dialog to ask about device trust
    setShowTrustDialog(true);
  }

  async function handleDeviceTrustDecision(trustDevice: boolean) {
    try {
      if (!certificateData) {
        throw new Error("No certificate data available");
      }

      // Upload public key to server and enable encryption
      await enableEncryption.mutateAsync({
        publicKey: certificateData.publicKey,
        privateKey: certificateData.privateKey,
        deviceSecret: certificateData.deviceSecret,
        trustDevice,
      });

      setShowTrustDialog(false);
      onComplete();
    } catch (error) {
      console.error("Failed to enable encryption:", error);
      toast.error("Failed to enable encryption. Please try again.");
    }
  }

  return (
    <>
      <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Protect Your Privacy
            </h1>
            <p className="text-muted-foreground mt-1">
              Choose how to secure your transcriptions
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Encryption Option (Recommended) */}
          <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  End-to-End Encryption{" "}
                  <span className="text-sm font-normal text-blue-600 dark:text-blue-400">
                    (Recommended)
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your data is encrypted on your device before being sent to our
                  servers. <strong>Only you can access it</strong> — not even we
                  can read your transcriptions.
                </p>
              </div>
              <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            </div>

            {!certificateDownloaded ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  We&apos;ll generate a unique encryption certificate for you.
                  You&apos;ll need this certificate to:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>Access your encrypted data from other devices</li>
                  <li>Recover your account if you lose access</li>
                </ul>
                <Button
                  onClick={handleGenerateCertificate}
                  disabled={generateCertificate.isPending}
                  className="w-full"
                  size="lg"
                >
                  <KeyIcon className="w-4 h-4 mr-2" />
                  {generateCertificate.isPending
                    ? "Generating Certificate..."
                    : "Generate & Download Certificate"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-white dark:bg-zinc-950 border border-green-200 dark:border-green-900 p-4">
                  <p className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircleIcon className="w-4 h-4" />
                    Certificate downloaded successfully!
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Before continuing, please confirm:
                  </Label>

                  <div className="space-y-2.5">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checklist.saved}
                        onChange={() => toggleChecklistItem("saved")}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm group-hover:text-foreground text-muted-foreground">
                        I have saved the certificate file to a secure location
                        on my device
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checklist.emailed}
                        onChange={() => toggleChecklistItem("emailed")}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm group-hover:text-foreground text-muted-foreground">
                        I have sent the certificate to myself by email as a
                        backup
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checklist.understood}
                        onChange={() => toggleChecklistItem("understood")}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm group-hover:text-foreground text-muted-foreground">
                        I understand that I&apos;ll need to upload this
                        certificate to access my data from other devices
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Skip Option */}
          {!certificateDownloaded && !hideSkipOption && onSkip && (
            <div className="rounded-lg border border-gray-200 dark:border-black p-6 space-y-3">
              <h3 className="font-semibold">Skip Encryption</h3>
              <p className="text-sm text-muted-foreground">
                You can set up encryption later in your account settings. Your
                data will be stored on our servers without end-to-end
                encryption.
              </p>
              <Button
                variant="outline"
                onClick={onSkip}
                disabled={generateCertificate.isPending}
                className="w-full"
              >
                Continue Without Encryption
              </Button>
            </div>
          )}
        </div>

        {certificateDownloaded && (
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => handleGenerateCertificate()}
              disabled={generateCertificate.isPending}
              className="flex-1"
            >
              Download Again
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!canContinue || generateCertificate.isPending}
              className="flex-1"
              size="lg"
            >
              Continue
            </Button>
          </div>
        )}
      </div>

      {/* Trust Device Dialog */}
      <Dialog open={showTrustDialog} onOpenChange={setShowTrustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Do you trust this computer?</DialogTitle>
            <DialogDescription>
              If you trust this computer, we&apos;ll store your encryption
              certificate securely in your browser. You won&apos;t need to
              upload it again when you log in (but this is not a reason not to
              keep a backup!).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 px-6">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Trusted Device
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Your certificate will remain stored after logout. Only use this
                on your personal devices.
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">Untrusted Device</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your certificate will be removed when you logout. Use this on
                shared or public computers.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDeviceTrustDecision(false)}
              disabled={enableEncryption.isPending}
            >
              Don&apos;t Trust
            </Button>
            <Button
              onClick={() => handleDeviceTrustDecision(true)}
              disabled={enableEncryption.isPending}
            >
              Trust This Computer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
