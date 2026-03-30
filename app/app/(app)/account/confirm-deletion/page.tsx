"use client";

import { PageLayout } from "@/components/page-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function ConfirmDeletionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmDeletion = async () => {
    if (!token) {
      setError("No deletion token provided");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch("/api/user/confirm-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      setIsDeleted(true);
      toast.success("Your account has been deleted");

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = "/api/auth/logout";
      }, 3000);
    } catch (error) {
      console.error("Deletion error:", error);
      setError(
        error instanceof Error ? error.message : "Failed to delete account",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!token) {
    return (
      <PageLayout
        title="Invalid Request"
        description="Account deletion confirmation"
      >
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircleIcon className="w-5 h-5" />
              Invalid Deletion Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This deletion link is invalid or has expired. If you want to
              delete your account, please request a new deletion link from your
              account settings.
            </p>
            <Button onClick={() => router.push("/app/account")}>
              Go to Account Settings
            </Button>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  if (isDeleted) {
    return (
      <PageLayout
        title="Account Deleted"
        description="Your account has been permanently deleted"
      >
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircleIcon className="w-5 h-5" />
              Account Deleted Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Your account and all associated data have been permanently
              deleted. You will be redirected to the login page shortly.
            </p>
            <p className="text-sm text-muted-foreground">
              Thank you for using our service. If you change your mind, you can
              always create a new account.
            </p>
          </CardContent>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Confirm Account Deletion"
      description="This action cannot be undone"
    >
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangleIcon className="w-5 h-5" />
            Permanently Delete Your Account
          </CardTitle>
          <CardDescription>
            Are you absolutely sure you want to delete your account?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="font-semibold mb-2">
              This action will permanently delete:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>All your transcriptions</li>
              <li>All audio files</li>
              <li>Your account settings</li>
              <li>All project data</li>
              <li>Your encryption keys</li>
            </ul>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => router.push("/app/account")}
              disabled={isDeleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeletion}
              disabled={isDeleting}
              className="flex-1"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            This action cannot be undone. Please be certain before proceeding.
          </p>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
