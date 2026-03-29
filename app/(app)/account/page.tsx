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
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const t = useTranslations("account");
  const router = useRouter();
  const { data: userProfile } = useUserProfile();
  const { data: transcriptions = [] } = useTranscriptions();

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
    try {
      const response = await fetch("/api/user/download-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeAudio }),
      });

      if (!response.ok) {
        throw new Error("Failed to download data");
      }

      // Get the blob from response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transcription-data-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Data downloaded successfully");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download data");
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
