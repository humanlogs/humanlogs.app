"use client";

import {
  useDisableEncryption,
  useDownloadCertificate,
  useEncryptionStatus,
  useRemoveLocalKey,
  useToggleDeviceTrust,
} from "@/hooks/use-encryption";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  DownloadIcon,
  LockIcon,
  SmartphoneIcon,
  TrashIcon,
} from "lucide-react";
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

interface EncryptionSettingsProps {
  onDisabled?: () => void;
  compact?: boolean;
}

export function EncryptionSettings({
  onDisabled,
  compact = false,
}: EncryptionSettingsProps) {
  const { data: encryptionState, isLoading } = useEncryptionStatus();
  const toggleDeviceTrust = useToggleDeviceTrust();
  const disableEncryption = useDisableEncryption();
  const downloadCertificate = useDownloadCertificate();
  const removeLocalKey = useRemoveLocalKey();

  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showRemoveKeyDialog, setShowRemoveKeyDialog] = useState(false);

  const hasLocalKey = encryptionState?.hasLocalKey ?? false;
  const deviceTrusted = encryptionState?.deviceTrusted ?? false;

  async function handleToggleTrustDevice() {
    if (!encryptionState?.encryptionStatus?.trustedDeviceSecret) return;

    try {
      const newTrustSetting = !deviceTrusted;
      await toggleDeviceTrust.mutateAsync({
        trust: newTrustSetting,
        deviceSecret: encryptionState.encryptionStatus.trustedDeviceSecret,
      });
      toast.success(
        newTrustSetting
          ? "Device is now trusted"
          : "Device is no longer trusted",
      );
    } catch (error) {
      console.error("Failed to update device trust:", error);
      toast.error("Failed to update device trust. Please try again.");
    }
  }

  async function handleDisableEncryption() {
    try {
      await disableEncryption.mutateAsync();
      setShowDisableDialog(false);
      toast.success("Encryption has been disabled");
      onDisabled?.();
    } catch (error) {
      console.error("Failed to disable encryption:", error);
      toast.error("Failed to disable encryption. Please try again.");
    }
  }

  async function handleDownloadCertificate() {
    if (!encryptionState?.privateKey || !encryptionState?.publicKey) {
      toast.error("Certificate not available");
      return;
    }

    try {
      await downloadCertificate.mutateAsync({
        privateKey: encryptionState.privateKey,
        publicKey: encryptionState.publicKey,
      });
      toast.success("Certificate downloaded successfully");
    } catch (error) {
      console.error("Failed to download certificate:", error);
      toast.error("Failed to download certificate. Please try again.");
    }
  }

  async function handleRemoveLocalKey() {
    try {
      await removeLocalKey.mutateAsync();
      setShowRemoveKeyDialog(false);
      toast.success("Encryption key removed from this device");
    } catch (error) {
      console.error("Failed to remove local key:", error);
      toast.error("Failed to remove key. Please try again.");
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (!encryptionState?.encryptionStatus?.hasEncryption || !hasLocalKey) {
    return null;
  }

  if (compact) {
    return (
      <>
        <div className="space-y-4">
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircleIcon className="w-4 h-4" />
                End-to-End Encryption Active
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your transcriptions are protected with end-to-end encryption.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCertificate}
              disabled={downloadCertificate.isPending}
              className="w-full"
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              Download Certificate
            </Button>
          </div>

          {/* Device Trust Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <SmartphoneIcon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Trust This Device</p>
                  <p className="text-xs text-muted-foreground">
                    {deviceTrusted
                      ? "Certificate persists after logout"
                      : "Certificate removed on logout"}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant={deviceTrusted ? "default" : "outline"}
                onClick={handleToggleTrustDevice}
                disabled={toggleDeviceTrust.isPending}
              >
                {deviceTrusted ? "Trusted" : "Not Trusted"}
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRemoveKeyDialog(true)}
              className="w-full"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Remove Key from This Device
            </Button>
          </div>

          {/* Disable Encryption */}
          <Button
            variant="destructive"
            onClick={() => setShowDisableDialog(true)}
            className="w-full"
            size="sm"
          >
            Disable Encryption
          </Button>
        </div>

        {/* Disable Confirmation Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disable End-to-End Encryption?</DialogTitle>
              <DialogDescription>
                This action will remove all encryption keys and settings.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-2">
                <p className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertCircleIcon className="w-4 h-4" />
                  Warning: You will lose access to encrypted data
                </p>
                <p className="text-sm text-muted-foreground">
                  If you disable encryption, you will permanently lose access to
                  any transcriptions that were encrypted. This action cannot be
                  undone.
                </p>
              </div>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">What will happen:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                  <li>All encryption keys will be removed from your account</li>
                  <li>
                    Previously encrypted transcriptions will become inaccessible
                  </li>
                  <li>New transcriptions will not be encrypted</li>
                  <li>
                    You can re-enable encryption later, but with a new key
                  </li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDisableDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisableEncryption}
                disabled={disableEncryption.isPending}
              >
                {disableEncryption.isPending
                  ? "Disabling..."
                  : "Disable Encryption"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <LockIcon className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircleIcon className="w-4 h-4" />
                Your account is protected by end-to-end encryption
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your transcriptions are encrypted on your device before being
                sent to our servers. Only you can access them.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleDownloadCertificate}
            disabled={downloadCertificate.isPending}
            className="w-full"
          >
            <DownloadIcon className="w-4 h-4 mr-2" />
            Download Certificate
          </Button>
        </div>

        {/* Device Trust Card */}
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <SmartphoneIcon className="w-5 h-5" />
            <h3 className="font-semibold">Device Trust</h3>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              {deviceTrusted
                ? "This device is trusted. Your encryption key will remain stored even after logout."
                : "This device is not trusted. Your encryption key will be removed when you logout."}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
              <div>
                <p className="font-medium">
                  {deviceTrusted ? "Trusted Device" : "Untrusted Device"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deviceTrusted
                    ? "Key remains after logout"
                    : "Key removed on logout"}
                </p>
              </div>
              <Button
                onClick={handleToggleTrustDevice}
                disabled={toggleDeviceTrust.isPending}
                variant={deviceTrusted ? "outline" : "default"}
              >
                {deviceTrusted ? "Untrust Device" : "Trust Device"}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowRemoveKeyDialog(true)}
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Remove Key from This Device
            </Button>
          </div>
        </div>

        {/* Disable Encryption Section */}
        <div className="rounded-lg border border-destructive/20 p-6 space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-destructive">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">
              Disabling encryption will remove all encryption keys and you will
              lose access to previously encrypted data.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowDisableDialog(true)}
            className="w-full"
          >
            Disable End-to-End Encryption
          </Button>
        </div>
      </div>

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable End-to-End Encryption?</DialogTitle>
            <DialogDescription>
              This action will remove all encryption keys and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <AlertCircleIcon className="w-4 h-4" />
                Warning: You will lose access to encrypted data
              </p>
              <p className="text-sm text-muted-foreground">
                If you disable encryption, you will permanently lose access to
                any transcriptions that were encrypted with your current
                certificate. This action cannot be undone.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">What will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>All encryption keys will be removed from your account</li>
                <li>
                  Previously encrypted transcriptions will become inaccessible
                </li>
                <li>New transcriptions will not be encrypted</li>
                <li>
                  You can re-enable encryption later, but with a new key pair
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisableDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableEncryption}
              disabled={disableEncryption.isPending}
            >
              {disableEncryption.isPending
                ? "Disabling..."
                : "Yes, Disable Encryption"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Local Key Confirmation Dialog */}
      <Dialog open={showRemoveKeyDialog} onOpenChange={setShowRemoveKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove encryption key from this device?</DialogTitle>
            <DialogDescription>
              This will remove your encryption certificate from this device
              only.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <AlertCircleIcon className="w-4 h-4" />
                What will happen:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Your encryption key will be removed from this device</li>
                <li>
                  You&apos;ll need to re-upload your certificate to access
                  encrypted data
                </li>
                <li>
                  Your data remains encrypted on our servers and other devices
                </li>
                <li>
                  Make sure you have your certificate file saved before
                  continuing
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveKeyDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveLocalKey}
              disabled={removeLocalKey.isPending}
            >
              {removeLocalKey.isPending ? "Removing..." : "Remove Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
