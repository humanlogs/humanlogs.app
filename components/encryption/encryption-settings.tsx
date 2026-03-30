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
import { useTranslations } from "@/components/locale-provider";
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
  const t = useTranslations("account.encryption.settings");
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
        newTrustSetting ? t("deviceTrust.enabled") : t("deviceTrust.disabled"),
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
    return <div className="text-sm text-muted-foreground">{t("loading")}</div>;
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
                {t("activeStatus.title")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("activeStatus.description")}
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
              {t("activeStatus.button")}
            </Button>
          </div>

          {/* Device Trust Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <SmartphoneIcon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">
                    {t("deviceTrust.label")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {deviceTrusted
                      ? t("deviceTrust.enabled")
                      : t("deviceTrust.disabled")}
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
              {t("deviceTrust.removeButton")}
            </Button>
          </div>

          {/* Disable Encryption */}
          <Button
            variant="destructive"
            onClick={() => setShowDisableDialog(true)}
            className="w-full"
            size="sm"
          >
            {t("dangerZone.button")}
          </Button>
        </div>

        {/* Disable Confirmation Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("disableDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("disableDialog.description")}
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
                {t("disableDialog.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisableEncryption}
                disabled={disableEncryption.isPending}
              >
                {t("disableDialog.confirm")}
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
                {t("activeStatus.title")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("activeStatus.description")}
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
            {t("activeStatus.button")}
          </Button>
        </div>

        {/* Device Trust Card */}
        <div className="rounded-lg border p-6 space-y-4">
          <div className="flex items-center gap-2">
            <SmartphoneIcon className="w-5 h-5" />
            <h3 className="font-semibold">{t("deviceTrust.title")}</h3>
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              {t("deviceTrust.description")}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
              <div>
                <p className="font-medium">
                  {deviceTrusted
                    ? t("deviceTrust.enabled")
                    : t("deviceTrust.disabled")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deviceTrusted
                    ? t("deviceTrust.enabled")
                    : t("deviceTrust.disabled")}
                </p>
              </div>
              <Button
                onClick={handleToggleTrustDevice}
                disabled={toggleDeviceTrust.isPending}
                variant={deviceTrusted ? "outline" : "default"}
              >
                {deviceTrusted
                  ? t("deviceTrust.label")
                  : t("deviceTrust.label")}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => setShowRemoveKeyDialog(true)}
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              {t("deviceTrust.removeButton")}
            </Button>
          </div>
        </div>

        {/* Disable Encryption Section */}
        <div className="rounded-lg border border-destructive/20 p-6 space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-destructive">
              {t("dangerZone.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("dangerZone.description")}
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowDisableDialog(true)}
            className="w-full"
          >
            {t("dangerZone.button")}
          </Button>
        </div>
      </div>

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disableDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("disableDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 space-y-2">
              <p className="text-sm font-medium text-destructive flex items-center gap-2">
                <AlertCircleIcon className="w-4 h-4" />
                {t("disableDialog.warning.title")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("disableDialog.confirmation")}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">
                {t("disableDialog.warning.title")}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                <li>{t("disableDialog.warning.point1")}</li>
                <li>{t("disableDialog.warning.point2")}</li>
                <li>{t("disableDialog.warning.point3")}</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDisableDialog(false)}
            >
              {t("disableDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableEncryption}
              disabled={disableEncryption.isPending}
            >
              {t("disableDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Local Key Confirmation Dialog */}
      <Dialog open={showRemoveKeyDialog} onOpenChange={setShowRemoveKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeKeyDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("removeKeyDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 px-6">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <AlertCircleIcon className="w-4 h-4" />
                {t("removeKeyDialog.warning.title")}
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>{t("removeKeyDialog.warning.point1")}</li>
                <li>{t("removeKeyDialog.warning.point2")}</li>
                <li>{t("removeKeyDialog.warning.point3")}</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveKeyDialog(false)}
            >
              {t("removeKeyDialog.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveLocalKey}
              disabled={removeLocalKey.isPending}
            >
              {t("removeKeyDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
