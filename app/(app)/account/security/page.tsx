"use client";

import {
  EncryptionSettings,
  ImportCertificatePrompt,
  SetupEncryption,
} from "@/components/encryption";
import { useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useEncryptionStatus } from "@/hooks/use-encryption";

export default function SecurityPage() {
  const t = useTranslations("account");
  const { data: encryptionState, isLoading } = useEncryptionStatus();

  const encryptionStatus = encryptionState?.encryptionStatus ?? null;
  const hasLocalKey = encryptionState?.hasLocalKey ?? false;

  if (isLoading) {
    return (
      <PageLayout
        title={t("security.title")}
        description={t("security.description")}
      >
        <p className="text-center text-muted-foreground">Loading...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t("security.title")}
      description={t("security.description")}
    >
      {/* Encryption Setup/Management */}
      {!encryptionStatus?.hasEncryption ? (
        <Card>
          <CardContent className="pt-6">
            <SetupEncryption
              onComplete={() => {
                // Encryption enabled, page will re-render with new state
              }}
              onSkip={() => {
                // User chose to skip encryption setup
              }}
            />
          </CardContent>
        </Card>
      ) : !hasLocalKey ? (
        <Card>
          <CardContent className="pt-6">
            <ImportCertificatePrompt compact />
          </CardContent>
        </Card>
      ) : (
        <EncryptionSettings />
      )}
    </PageLayout>
  );
}
