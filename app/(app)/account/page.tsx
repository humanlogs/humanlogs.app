"use client";

import { useTranslations } from "@/components/locale-provider";
import { PageLayout } from "@/components/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheckIcon,
  CreditCardIcon,
  DownloadIcon,
  TrashIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { useUserProfile } from "@/hooks/use-api";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import { useDecryptData } from "@/hooks/use-encryption";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { downloadAndDecryptAudio } from "@/lib/audio-decryption.browser";
import type { TranscriptionDetail } from "@/hooks/use-transcriptions";

export default function AccountPage() {
  const t = useTranslations("account");
  const router = useRouter();
  const { data: userProfile } = useUserProfile();
  const { data: transcriptions = [] } = useTranscriptions();
  const decrypt = useDecryptData();

  const [includeAudio, setIncludeAudio] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRequestingDelete, setIsRequestingDelete] = useState(false);

  const handleDownloadAllData = async () => {
    if (transcriptions.length === 0) {
      toast.error("No data to download");
      return;
    }

    setIsDownloading(true);
    const toastId = toast.loading("Preparing download...");

    try {
      const zip = new JSZip();

      // Helper function to convert transcription data to text
      const transcriptionToText = (data: any): string => {
        if (!data || !data.words) return "";

        let text = "";
        let currentSpeaker = "";

        for (const word of data.words) {
          const speaker = word.speaker || "Unknown";

          if (speaker !== currentSpeaker) {
            if (text) text += "\n\n";
            text += `[${speaker}]\n`;
            currentSpeaker = speaker;
          }

          text += word.text + (word.text.match(/[.!?]$/) ? " " : "");
        }

        return text;
      };

      let processedCount = 0;

      // Process each transcription
      for (const basicTranscription of transcriptions) {
        processedCount++;
        toast.loading(
          `Processing ${processedCount}/${transcriptions.length}...`,
          { id: toastId },
        );

        try {
          // Fetch full transcription details
          const response = await fetch(
            `/api/transcriptions/${basicTranscription.id}`,
          );
          if (!response.ok) {
            console.error(
              `Failed to fetch transcription ${basicTranscription.id}`,
            );
            continue;
          }

          const rawData = await response.json();
          // Decrypt the transcription data (handles encrypted content automatically)
          const transcription = await decrypt<TranscriptionDetail>(rawData);

          // Create a safe folder name
          const folderName = `${transcription.title.replace(/[/\\?%*:|"<>]/g, "-")}-${transcription.id.substring(0, 8)}`;

          // Prepare metadata
          const metadata: any = {
            id: transcription.id,
            title: transcription.title,
            language: transcription.language,
            vocabulary: transcription.vocabulary,
            speakerCount: transcription.speakerCount,
            state: transcription.state,
            projectName: transcription.projectName,
            createdAt: transcription.createdAt,
            updatedAt: transcription.updatedAt,
            completedAt: transcription.completedAt,
            audioFileName: transcription.audioFileName,
            audioFileSize: transcription.audioFileSize,
            transcription: transcription.transcription,
          };

          // Add metadata.json
          zip.file(
            `${folderName}/metadata.json`,
            JSON.stringify(metadata, null, 2),
          );

          // Add transcript.txt if available
          if (
            transcription.transcription &&
            transcription.state === "COMPLETED"
          ) {
            try {
              const textContent = transcriptionToText(
                transcription.transcription,
              );
              if (textContent) {
                zip.file(`${folderName}/transcript.txt`, textContent);
              }
            } catch (error) {
              console.error(
                `Failed to process transcript for ${transcription.id}:`,
                error,
              );
            }
          }

          // Add audio file if requested
          if (includeAudio && transcription.audioFileKey) {
            try {
              if (transcription.audioFileEncryption) {
                // Audio is encrypted - decrypt it
                const decryptedBlob = await downloadAndDecryptAudio(
                  transcription.id,
                  transcription.audioFileEncryption,
                );
                zip.file(
                  `${folderName}/${transcription.audioFileName}`,
                  decryptedBlob,
                );
              } else {
                // Audio is not encrypted - fetch directly
                const audioResponse = await fetch(
                  `/api/transcriptions/${transcription.id}/audio`,
                );
                if (audioResponse.ok) {
                  const audioBlob = await audioResponse.blob();
                  zip.file(
                    `${folderName}/${transcription.audioFileName}.ogg`,
                    audioBlob,
                  );
                } else {
                  console.error(
                    `Failed to fetch audio for ${transcription.id}`,
                  );
                  zip.file(
                    `${folderName}/audio-error.txt`,
                    `Failed to retrieve audio file: ${audioResponse.statusText}`,
                  );
                }
              }
            } catch (error) {
              console.error(
                `Failed to add audio for ${transcription.id}:`,
                error,
              );
              zip.file(
                `${folderName}/audio-error.txt`,
                `Failed to retrieve audio file: ${error instanceof Error ? error.message : "Unknown error"}`,
              );
            }
          }
        } catch (error) {
          console.error(
            `Error processing transcription ${basicTranscription.id}:`,
            error,
          );
          // Continue with next transcription
        }
      }

      // Add README
      const readme = `# Your Transcription Data Export

Exported on: ${new Date().toISOString()}
Total transcriptions: ${transcriptions.length}
User: ${userProfile?.email || "Unknown"}${userProfile?.name ? ` (${userProfile.name})` : ""}

## Contents

Each folder contains:
- **metadata.json**: Complete transcription metadata and raw data
- **transcript.txt**: Human-readable transcript (when available)
${includeAudio ? "- **audio file**: Original audio file (decrypted if it was encrypted)\n" : ""}
## Important Notes

**End-to-End Encryption**: If transcriptions were encrypted, they have been automatically decrypted using your local encryption keys before being included in this export.

## Additional Information

- Timestamps in metadata are in ISO 8601 format
- Each transcription is in its own folder for easy organization
- Encrypted content has been decrypted in your browser before export
`;

      zip.file("README.md", readme);

      // Generate the ZIP file
      toast.loading("Generating ZIP file...", { id: toastId });
      const blob = await zip.generateAsync({ type: "blob" });

      // Download the ZIP file
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transcription-data-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Data downloaded successfully", { id: toastId });
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download data", { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRequestAccountDeletion = async () => {
    setIsRequestingDelete(true);
    try {
      const response = await fetch("/api/user/request-deletion", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to request account deletion");
      }

      toast.success(
        "A confirmation email has been sent. Please check your inbox.",
      );
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Delete request error:", error);
      toast.error("Failed to request account deletion");
    } finally {
      setIsRequestingDelete(false);
    }
  };

  return (
    <PageLayout title={t("title")} description={t("description")}>
      <div className="space-y-6">
        {/* Encryption Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5" />
              Encryption
            </CardTitle>
            <CardDescription>
              Manage your end-to-end encryption settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/account/security")}
              variant="outline"
            >
              <ShieldCheckIcon className="w-4 h-4 mr-2" />
              Encryption Settings
            </Button>
          </CardContent>
        </Card>

        {/* Billing Section (if enabled) */}
        {userProfile?.isBillingEnabled && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="w-5 h-5" />
                Billing
              </CardTitle>
              <CardDescription>
                Manage your subscription and billing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push("/account/billing")}
                variant="outline"
              >
                <CreditCardIcon className="w-4 h-4 mr-2" />
                Billing Settings
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Your Data Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadIcon className="w-5 h-5" />
              Your Data
            </CardTitle>
            <CardDescription>
              Download all your transcriptions and data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-audio"
                checked={includeAudio}
                onCheckedChange={(checked: boolean) =>
                  setIncludeAudio(checked === true)
                }
              />
              <Label
                htmlFor="include-audio"
                className="text-sm font-normal cursor-pointer"
              >
                Include audio files
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Total transcriptions: {transcriptions.length}
            </p>
            <Button
              onClick={handleDownloadAllData}
              disabled={isDownloading || transcriptions.length === 0}
              variant="outline"
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              {isDownloading ? "Downloading..." : "Download All Data"}
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowDeleteDialog(true)}
              variant="destructive"
            >
              <TrashIcon className="w-4 h-4 mr-2" />
              Delete My Account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete Account?
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <p>
                This action cannot be undone. We will send you a confirmation
                email with a link to permanently delete your account and all
                associated data.
              </p>
              <p className="font-semibold">
                The confirmation link will be valid for 24 hours.
              </p>
              <p>This will delete:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>All your transcriptions</li>
                <li>All audio files</li>
                <li>Your account settings</li>
                <li>All project data</li>
                <li>Your encryption keys</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isRequestingDelete}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestAccountDeletion}
              disabled={isRequestingDelete}
            >
              {isRequestingDelete
                ? "Sending..."
                : "Send Deletion Confirmation Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
