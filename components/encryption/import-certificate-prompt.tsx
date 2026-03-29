"use client";

import {
  useEncryptionStatus,
  useToggleDeviceTrust,
  useUploadCertificate,
} from "@/hooks/use-encryption";
import { AlertCircleIcon, KeyIcon, UploadIcon } from "lucide-react";
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
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface ImportCertificatePromptProps {
  onSuccess?: () => void;
  compact?: boolean;
}

export function ImportCertificatePrompt({
  onSuccess,
  compact = false,
}: ImportCertificatePromptProps) {
  const { data: encryptionState } = useEncryptionStatus();
  const uploadCertificate = useUploadCertificate();
  const toggleDeviceTrust = useToggleDeviceTrust();
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showTrustDialog, setShowTrustDialog] = useState(false);

  async function handleUploadCertificate(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file || !encryptionState?.encryptionStatus?.trustedDeviceSecret)
      return;

    try {
      setUploadingFile(true);
      const content = await file.text();
      await uploadCertificate.mutateAsync({
        certificateContent: content,
        trustedDeviceSecret:
          encryptionState.encryptionStatus.trustedDeviceSecret,
        trustDevice: false,
      });
      toast.success("Certificate loaded successfully!");

      // Ask about device trust
      setShowTrustDialog(true);
    } catch (error) {
      console.error("Failed to load certificate:", error);
      toast.error(
        "Failed to load certificate. Please check the file and try again.",
      );
    } finally {
      setUploadingFile(false);
      event.target.value = ""; // Reset input
    }
  }

  async function handleDeviceTrustDecision(trustDevice: boolean) {
    try {
      if (encryptionState?.encryptionStatus?.trustedDeviceSecret) {
        await toggleDeviceTrust.mutateAsync({
          trust: trustDevice,
          deviceSecret: encryptionState.encryptionStatus.trustedDeviceSecret,
        });
      }
      setShowTrustDialog(false);
      onSuccess?.();
    } catch (error) {
      console.error("Failed to set device trust:", error);
      toast.error("Failed to save device trust preference.");
    }
  }

  if (compact) {
    return (
      <>
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertCircleIcon className="w-4 h-4 text-orange-600" />
              Encryption Certificate Required
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your certificate to access encrypted data on this device.
            </p>
          </div>
          <div>
            <Label htmlFor="certificate-upload-compact" className="sr-only">
              Upload Certificate
            </Label>
            <label
              htmlFor="certificate-upload-compact"
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <UploadIcon className="w-4 h-4" />
              {uploadingFile ? "Uploading..." : "Upload Certificate"}
            </label>
            <Input
              id="certificate-upload-compact"
              type="file"
              accept=".json"
              onChange={handleUploadCertificate}
              disabled={uploadingFile}
              className="hidden"
            />
          </div>
        </div>

        {/* Trust Device Dialog */}
        <Dialog open={showTrustDialog} onOpenChange={setShowTrustDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Do you trust this computer?</DialogTitle>
              <DialogDescription>
                Should we keep your encryption certificate stored on this
                device?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Trusted Device
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Your certificate will remain stored after logout. Only use
                  this on your personal devices.
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
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-blue-50 dark:bg-blue-950/20 p-4">
              <KeyIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Certificate Required</h2>
              <p className="text-sm text-muted-foreground">
                Your account is protected by end-to-end encryption
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              To access your encrypted transcriptions, please import your
              encryption certificate. This is the file you downloaded when you
              first enabled encryption.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-sm">
              How to find your certificate:
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1.5 ml-4 list-disc">
              <li>Check your Downloads folder</li>
              <li>Look for emails you sent to yourself as backup</li>
              <li>Check any secure storage locations you use</li>
            </ul>
          </div>

          <div>
            <Label htmlFor="certificate-upload" className="sr-only">
              Upload Certificate
            </Label>
            <label
              htmlFor="certificate-upload"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <UploadIcon className="w-5 h-5" />
              {uploadingFile ? "Uploading..." : "Import Certificate"}
            </label>
            <Input
              id="certificate-upload"
              type="file"
              accept=".json"
              onChange={handleUploadCertificate}
              disabled={uploadingFile}
              className="hidden"
            />
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertCircleIcon className="w-4 h-4" />
              Lost your certificate?
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              If you&apos;ve lost your encryption certificate, you won&apos;t be
              able to access previously encrypted data. You can disable and
              re-enable encryption to start fresh, but old data will be
              inaccessible.
            </p>
          </div>
        </div>
      </div>

      {/* Trust Device Dialog */}
      <Dialog open={showTrustDialog} onOpenChange={setShowTrustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Do you trust this computer?</DialogTitle>
            <DialogDescription>
              Should we keep your encryption certificate stored on this device?
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
    </>
  );
}
