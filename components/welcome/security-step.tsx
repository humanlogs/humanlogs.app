"use client";

import {
  useEmailRecoveryKey,
  useEnableEncryption,
  useEncryptionStatus,
} from "@/hooks/use-encryption";
import {
  createCertificate,
  downloadCertificate,
  generateDeviceSecret,
  parseCertificate,
} from "@/lib/encryption/encryption";
import { useTranslations } from "@/components/locale-provider";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  DownloadIcon,
  MailIcon,
  ShieldCheckIcon,
  UploadIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface SecurityStepProps {
  onContinue: () => void;
  onSkip: () => void;
  userName?: string;
}

/**
 * Simplified onboarding security step.
 *
 * The recovery key (E2E certificate) used to be a scary, multi-checkbox wall.
 * This flow reduces it to a single primary action: "Protect my account", which
 * creates the key, delivers it (by email by default), and turns on encryption.
 * Everything technical — emailing vs. saving it yourself, trusting the device,
 * importing an existing key, or skipping entirely — lives behind "Advanced".
 */
export function SecurityStep({ onContinue, onSkip }: SecurityStepProps) {
  const t = useTranslations("welcome.security");
  const status = useEncryptionStatus();
  const enableEncryption = useEnableEncryption();
  const emailRecoveryKey = useEmailRecoveryKey();

  const [advanced, setAdvanced] = useState(false);
  const [sendByEmail, setSendByEmail] = useState(true);
  const [trustDevice, setTrustDevice] = useState(true);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);
  // How the key was actually delivered (email may fall back to download when no
  // email provider is configured), used for the success message.
  const [deliveredVia, setDeliveredVia] = useState<"email" | "download">(
    "email",
  );

  // Already encrypted (e.g. returning to this step) — skip straight ahead.
  useEffect(() => {
    if (status?.data?.publicKey) {
      onContinue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.data?.publicKey]);

  async function handleProtect() {
    setWorking(true);
    try {
      const certificate = await createCertificate();
      const deviceSecret = await generateDeviceSecret();

      // Deliver the key: email (default) or download so the user keeps it.
      // If email isn't configured server-side, fall back to a download so the
      // user is never left without a copy of their recovery key.
      let via: "email" | "download" = sendByEmail ? "email" : "download";
      if (sendByEmail) {
        const res = await emailRecoveryKey.mutateAsync(certificate);
        if (!res.delivered) {
          downloadCertificate(certificate);
          via = "download";
        }
      } else {
        downloadCertificate(certificate);
      }

      // Turn encryption on (uploads the public key, stores the private key
      // locally under the device secret).
      await enableEncryption.mutateAsync({
        publicKey: certificate.publicKey,
        privateKey: certificate.privateKey,
        deviceSecret,
        trustDevice,
      });

      setDeliveredVia(via);
      setDone(true);
      toast.success(via === "email" ? t("emailedToast") : t("downloadedToast"));
      // Give the success state a beat to register, then advance.
      setTimeout(onContinue, 900);
    } catch (error) {
      console.error("Failed to set up encryption:", error);
      toast.error(t("error"));
    } finally {
      setWorking(false);
    }
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setWorking(true);
    try {
      const certificate = parseCertificate(await file.text());
      const deviceSecret = await generateDeviceSecret();
      await enableEncryption.mutateAsync({
        publicKey: certificate.publicKey,
        privateKey: certificate.privateKey,
        deviceSecret,
        trustDevice,
      });
      toast.success(t("importedToast"));
      onContinue();
    } catch (error) {
      console.error("Failed to import certificate:", error);
      toast.error(t("importError"));
    } finally {
      setWorking(false);
      event.target.value = "";
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="rounded-full bg-green-100 p-3 dark:bg-green-950">
          <CheckCircleIcon className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">{t("doneTitle")}</h1>
        <p className="text-muted-foreground text-sm">
          {deliveredVia === "email" ? t("doneEmail") : t("doneDownload")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-primary/10 p-3">
          <ShieldCheckIcon className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </div>
      </div>

      {/* What the recovery key is, in one reassuring line. */}
      <div className="rounded-xl border bg-muted/40 p-4">
        <div className="flex items-start gap-3">
          <MailIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            {sendByEmail ? t("explainerEmail") : t("explainerDownload")}
          </p>
        </div>
      </div>

      <Button
        onClick={handleProtect}
        disabled={working}
        size="lg"
        className="w-full"
      >
        <ShieldCheckIcon className="mr-2 h-4 w-4" />
        {working ? t("working") : t("protect")}
      </Button>

      {/* Advanced */}
      <div className="rounded-xl border">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex w-full items-center justify-between p-3 text-sm font-medium"
        >
          {t("advanced")}
          <ChevronDownIcon
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              advanced ? "rotate-180" : ""
            }`}
          />
        </button>

        {advanced && (
          <div className="animate-onboarding-step space-y-4 border-t p-4">
            {/* Delivery method */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                {t("deliveryLabel")}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSendByEmail(true)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                    sendByEmail
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <MailIcon className="h-4 w-4 shrink-0 text-primary" />
                  {t("deliveryEmail")}
                </button>
                <button
                  type="button"
                  onClick={() => setSendByEmail(false)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                    !sendByEmail
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <DownloadIcon className="h-4 w-4 shrink-0 text-primary" />
                  {t("deliveryDownload")}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {sendByEmail ? t("deliveryEmailHint") : t("deliveryDownloadHint")}
              </p>
            </div>

            {/* Trust device */}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary"
              />
              <span className="text-sm">
                <span className="font-medium">{t("trustLabel")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("trustHint")}
                </span>
              </span>
            </label>

            {/* Import existing */}
            <div>
              <Label htmlFor="security-import" className="sr-only">
                {t("importButton")}
              </Label>
              <label
                htmlFor="security-import"
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <UploadIcon className="h-4 w-4" />
                {t("importButton")}
              </label>
              <Input
                id="security-import"
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={working}
                className="hidden"
              />
            </div>

            {/* Skip entirely */}
            <button
              type="button"
              onClick={onSkip}
              disabled={working}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("skip")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
