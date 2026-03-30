"use client";

import {
  useEnableEncryption,
  useEncryptionStatus,
  useGenerateCertificate,
  useToggleDeviceTrust,
} from "@/hooks/use-encryption";
import { CheckCircleIcon, KeyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("encryption.setup");
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
      toast.success(t("success.generate"));
    } catch (error) {
      console.error("Failed to generate certificate:", error);
      toast.error(t("errors.generate"));
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
      toast.error(t("errors.enable"));
    }
  }

  return (
    <>
      <div className="w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-zinc-950">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Encryption Option (Recommended) */}
          <div className="rounded-lg border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {t("enabled.title")}{" "}
                  <span className="text-sm font-normal text-blue-600 dark:text-blue-400">
                    ({t("enabled.badge")})
                  </span>
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("enabled.description")}
                </p>
              </div>
              <KeyIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            </div>

            {!certificateDownloaded ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("enabled.generate.intro")}
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                  <li>{t("enabled.generate.point1")}</li>
                  <li>{t("enabled.generate.point2")}</li>
                  <li>{t("enabled.generate.point3")}</li>
                </ul>
                <Button
                  onClick={handleGenerateCertificate}
                  disabled={generateCertificate.isPending}
                  className="w-full"
                  size="lg"
                >
                  <KeyIcon className="w-4 h-4 mr-2" />
                  {generateCertificate.isPending
                    ? t("enabled.generate.generating")
                    : t("enabled.generate.button")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-white dark:bg-zinc-950 border border-green-200 dark:border-green-900 p-4">
                  <p className="text-sm font-medium flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircleIcon className="w-4 h-4" />
                    {t("enabled.downloaded.success")}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    {t("enabled.checklist.title")}
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
                        {t("enabled.checklist.saved")}
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
                        {t("enabled.checklist.emailed")}
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
                        {t("enabled.checklist.understood")}
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
              <h3 className="font-semibold">{t("skip.title")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("skip.description")}
              </p>
              <Button
                variant="outline"
                onClick={onSkip}
                disabled={generateCertificate.isPending}
                className="w-full"
              >
                {t("skip.button")}
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
              {t("actions.downloadAgain")}
            </Button>
            <Button
              onClick={handleContinue}
              disabled={!canContinue || generateCertificate.isPending}
              className="flex-1"
              size="lg"
            >
              {t("actions.continue")}
            </Button>
          </div>
        )}
      </div>

      {/* Trust Device Dialog */}
      <Dialog open={showTrustDialog} onOpenChange={setShowTrustDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("trustDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("trustDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4 px-6">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                {t("trustDialog.trusted.title")}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {t("trustDialog.trusted.description")}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm font-medium">
                {t("trustDialog.untrusted.title")}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("trustDialog.untrusted.description")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDeviceTrustDecision(false)}
              disabled={enableEncryption.isPending}
            >
              {t("trustDialog.dontTrust")}
            </Button>
            <Button
              onClick={() => handleDeviceTrustDecision(true)}
              disabled={enableEncryption.isPending}
            >
              {t("trustDialog.trust")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
