"use client";

import {
  EncryptionSettings,
  ImportCertificatePrompt,
  SetupEncryption,
} from "@/components/encryption";
import { LocalDataCard } from "@/components/codebooks/excerpts/local-data-card";
import { useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
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
      {/* Each of these already draws its own panel — a card around them would be
          a border inside a border, and the third branch never had one anyway. */}
      {!encryptionStatus?.hasEncryption ? (
        <SetupEncryption
          embedded
          hideSkipOption
          onComplete={() => {
            // Encryption enabled, page will re-render with new state
          }}
        />
      ) : !hasLocalKey ? (
        <ImportCertificatePrompt compact />
      ) : (
        <EncryptionSettings />
      )}

      <LocalDataCard />
    </PageLayout>
  );
}
