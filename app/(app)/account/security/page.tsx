"use client";

import { useTranslations } from "@/components/locale-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheckIcon,
  KeyIcon,
  UploadIcon,
  SmartphoneIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  LockIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  createCertificate,
  downloadCertificate,
  generateDeviceSecret,
  storePrivateKey,
  getPrivateKey,
  removePrivateKey,
  isDeviceTrusted,
  setDeviceTrust,
  parseCertificate,
} from "@/lib/encryption";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type EncryptionStatus = {
  hasEncryption: boolean;
  publicKey: string | null;
  trustedDeviceSecret: string | null;
};

export default function SecurityPage() {
  const t = useTranslations("account");
  const [encryptionStatus, setEncryptionStatus] =
    useState<EncryptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLocalKey, setHasLocalKey] = useState(false);
  const [deviceTrusted, setDeviceTrusted] = useState(false);
  const [generatingCertificate, setGeneratingCertificate] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  // Load encryption status
  useEffect(() => {
    loadEncryptionStatus();
  }, []);

  async function loadEncryptionStatus() {
    try {
      setLoading(true);
      const response = await fetch("/api/user/encryption");
      const data = await response.json();
      setEncryptionStatus(data);

      if (data.hasEncryption && data.trustedDeviceSecret) {
        // Check if private key is stored locally
        const privateKey = await getPrivateKey(data.trustedDeviceSecret);
        setHasLocalKey(!!privateKey);

        // Check if device is trusted
        const trusted = await isDeviceTrusted();
        setDeviceTrusted(trusted);
      }
    } catch (error) {
      console.error("Failed to load encryption status:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableEncryption() {
    try {
      setGeneratingCertificate(true);

      // Generate certificate
      const certificate = await createCertificate();

      // Generate device secret
      const deviceSecret = await generateDeviceSecret();

      // Store public key and device secret on server
      const response = await fetch("/api/user/encryption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: certificate.publicKey,
          trustedDeviceSecret: deviceSecret,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to enable encryption");
      }

      // Store private key locally (not trusted by default)
      await storePrivateKey(certificate.privateKey, deviceSecret, false);

      // Download certificate
      downloadCertificate(certificate);

      // Reload status
      await loadEncryptionStatus();

      alert(
        "Encryption enabled! Your certificate has been downloaded. Please store it securely - you can send it to yourself by email as a backup.",
      );
    } catch (error) {
      console.error("Failed to enable encryption:", error);
      alert("Failed to enable encryption. Please try again.");
    } finally {
      setGeneratingCertificate(false);
    }
  }

  async function handleUploadCertificate(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file || !encryptionStatus?.trustedDeviceSecret) return;

    try {
      setUploadingCertificate(true);
      const content = await file.text();
      const certificate = parseCertificate(content);

      // Store private key locally
      await storePrivateKey(
        certificate.privateKey,
        encryptionStatus.trustedDeviceSecret,
        false,
      );

      await loadEncryptionStatus();
      alert("Certificate loaded successfully!");
    } catch (error) {
      console.error("Failed to load certificate:", error);
      alert("Failed to load certificate. Please check the file and try again.");
    } finally {
      setUploadingCertificate(false);
      event.target.value = ""; // Reset input
    }
  }

  async function handleToggleTrustDevice() {
    if (!encryptionStatus?.trustedDeviceSecret) return;

    try {
      const newTrustSetting = !deviceTrusted;
      await setDeviceTrust(
        newTrustSetting,
        encryptionStatus.trustedDeviceSecret,
      );
      setDeviceTrusted(newTrustSetting);
    } catch (error) {
      console.error("Failed to update device trust:", error);
      alert("Failed to update device trust. Please try again.");
    }
  }

  async function handleRemoveLocalKey() {
    if (
      !confirm(
        "Are you sure you want to remove the encryption key from this device? You will need to upload your certificate again to access encrypted data.",
      )
    ) {
      return;
    }

    try {
      await removePrivateKey();
      await loadEncryptionStatus();
    } catch (error) {
      console.error("Failed to remove local key:", error);
      alert("Failed to remove local key. Please try again.");
    }
  }

  async function handleDisableEncryption() {
    if (
      !confirm(
        "Are you sure you want to disable end-to-end encryption? This will remove all encryption keys. This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/user/encryption", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disable encryption");
      }

      await removePrivateKey();
      await loadEncryptionStatus();
    } catch (error) {
      console.error("Failed to disable encryption:", error);
      alert("Failed to disable encryption. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheckIcon className="w-8 h-8" />
          {t("security.title")}
        </h1>
        <p className="text-muted-foreground mt-2">
          {t("security.description")}
        </p>
      </div>

      {/* Encryption Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <LockIcon className="w-5 h-5" />
              {t("security.encryption_status")}
            </span>
            {encryptionStatus?.hasEncryption ? (
              <Badge variant="default" className="gap-1">
                <CheckCircleIcon className="w-3 h-3" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertCircleIcon className="w-3 h-3" />
                Disabled
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!encryptionStatus?.hasEncryption ? (
            <>
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm font-medium">
                  {t("security.encryption_disabled_title")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("security.encryption_disabled_description")}
                </p>
              </div>
              <Button
                onClick={handleEnableEncryption}
                disabled={generatingCertificate}
                className="w-full"
              >
                <KeyIcon className="w-4 h-4 mr-2" />
                {generatingCertificate
                  ? t("security.generating")
                  : t("security.enable_encryption")}
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  {t("security.encryption_enabled_title")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("security.encryption_enabled_description")}
                </p>
              </div>

              {/* Local Key Status */}
              {hasLocalKey ? (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    {t("security.key_loaded")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("security.key_loaded_description")}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <AlertCircleIcon className="w-4 h-4 text-orange-600" />
                      {t("security.key_required")}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("security.key_required_description")}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="certificate-upload" className="sr-only">
                      Upload Certificate
                    </Label>
                    <div className="flex gap-2">
                      <label
                        htmlFor="certificate-upload"
                        className="flex-1 cursor-pointer"
                      >
                        <div className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                          <UploadIcon className="w-4 h-4" />
                          {uploadingCertificate
                            ? t("security.uploading")
                            : t("security.upload_certificate")}
                        </div>
                      </label>
                      <Input
                        id="certificate-upload"
                        type="file"
                        accept=".json"
                        onChange={handleUploadCertificate}
                        disabled={uploadingCertificate}
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDisableEncryption}
                >
                  {t("security.disable_encryption")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Device Trust */}
      {encryptionStatus?.hasEncryption && hasLocalKey && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SmartphoneIcon className="w-5 h-5" />
              {t("security.device_trust")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">
                {deviceTrusted
                  ? t("security.device_trusted_description")
                  : t("security.device_not_trusted_description")}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {deviceTrusted
                    ? t("security.trusted")
                    : t("security.not_trusted")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {deviceTrusted
                    ? t("security.key_persists")
                    : t("security.key_removed_on_logout")}
                </p>
              </div>
              <Button onClick={handleToggleTrustDevice}>
                {deviceTrusted
                  ? t("security.untrust_device")
                  : t("security.trust_device")}
              </Button>
            </div>
            {hasLocalKey && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleRemoveLocalKey}
                  className="w-full"
                >
                  {t("security.remove_key_from_device")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t("security.how_it_works")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">{t("security.step_1_title")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("security.step_1_description")}
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">{t("security.step_2_title")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("security.step_2_description")}
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">{t("security.step_3_title")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("security.step_3_description")}
            </p>
          </div>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 p-4">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertCircleIcon className="w-4 h-4" />
              {t("security.tip_title")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("security.tip_description")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
