"use client";

import {
  useEnableEncryption,
  useEncryptionStatus,
  useToggleDeviceTrust,
} from "@/hooks/use-encryption";
import { CheckCircleIcon, KeyIcon } from "lucide-react";
import { useEffect, useState } from "react";
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

interface SecurityStepProps {
  onContinue: () => void;
  onSkip: () => void;
  userName?: string;
}

export function SecurityStep({ onContinue, onSkip }: SecurityStepProps) {
  const [certificateDownloaded, setCertificateDownloaded] = useState(false);
  const [showTrustDialog, setShowTrustDialog] = useState(false);
  const [checklist, setChecklist] = useState({
    saved: false,
    emailed: false,
    understood: false,
  });

  const toggleDeviceTrust = useToggleDeviceTrust();
  const enableEncryption = useEnableEncryption();
  const status = useEncryptionStatus();

  useEffect(() => {
    if (status?.data?.publicKey) {
      onContinue();
    }
  }, [status]);

  const allChecked =
    checklist.saved && checklist.emailed && checklist.understood;
  const canContinue = certificateDownloaded && allChecked;

  async function handleEnableEncryption() {
    try {
      await enableEncryption.mutateAsync({ trustDevice: false });
      setCertificateDownloaded(true);
      toast.success(
        "Encryption enabled! Your certificate has been downloaded. Please save it securely.",
      );
    } catch (error) {
      console.error("Failed to enable encryption:", error);
      toast.error("Failed to enable encryption. Please try again.");
    }
  }

  async function handleContinue() {
    // Show dialog to ask about device trust
    setShowTrustDialog(true);
  }

  async function handleDeviceTrustDecision(trustDevice: boolean) {
    try {
      if (status.data?.encryptionStatus?.trustedDeviceSecret) {
        await toggleDeviceTrust.mutateAsync({
          trust: trustDevice,
          deviceSecret: status.data.encryptionStatus.trustedDeviceSecret,
        });
      }
      setShowTrustDialog(false);
      onContinue();
    } catch (error) {
      console.error("Failed to set device trust:", error);
      toast.error("Failed to save device trust preference. Please try again.");
    }
  }

  function toggleChecklistItem(key: keyof typeof checklist) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
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
                  onClick={handleEnableEncryption}
                  disabled={enableEncryption.isPending}
                  className="w-full"
                  size="lg"
                >
                  <KeyIcon className="w-4 h-4 mr-2" />
                  {enableEncryption.isPending
                    ? "Generating Certificate..."
                    : "Enable Encryption & Download Certificate"}
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
          {!certificateDownloaded && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-6 space-y-3">
              <h3 className="font-semibold">Skip Encryption</h3>
              <p className="text-sm text-muted-foreground">
                You can set up encryption later in your account settings. Your
                data will be stored on our servers without end-to-end
                encryption.
              </p>
              <Button
                variant="outline"
                onClick={onSkip}
                disabled={enableEncryption.isPending}
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
              onClick={() => handleEnableEncryption()}
              disabled={enableEncryption.isPending}
              className="flex-1"
            >
              Download Again
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!canContinue || enableEncryption.isPending}
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
              upload it again when you log in.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
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
              disabled={toggleDeviceTrust.isPending}
            >
              Don&apos;t Trust
            </Button>
            <Button
              onClick={() => handleDeviceTrustDecision(true)}
              disabled={toggleDeviceTrust.isPending}
            >
              Trust This Computer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
