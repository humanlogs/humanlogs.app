"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useEncryptionStatus } from "@/hooks/use-encryption";
import {
  SharedUser,
  useRemoveShare,
  useShareTranscription,
  useTranscription,
} from "@/hooks/use-transcriptions";
import { EncryptionUtils } from "@/lib/encryption-entities";
import { browserCrypto } from "@/lib/encryption-entities.browser";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";
import { useTranslations } from "@/components/locale-provider";

type UserInfo = {
  id: string;
  name: string | null;
  email: string;
};

export type TranscriptionShareDialogData = {
  transcriptionId: string;
  shared?: SharedUser[];
  isOwner?: boolean;
};

export function useTranscriptionShareDialog() {
  const modal = useModal<TranscriptionShareDialogData>(
    "transcription-share-dialog",
  );

  return {
    ...modal,
    openShare: (
      transcriptionId: string,
      shared?: SharedUser[],
      isOwner = true,
    ) => {
      modal.open({ transcriptionId, shared, isOwner });
    },
  };
}

export function TranscriptionShareDialog() {
  const t = useTranslations("editor");
  const { isOpen, data, close } = useTranscriptionShareDialog();
  const transcriptionId = data?.transcriptionId || "";

  // Fetch live transcription data to get updated shared users
  const { data: transcription } = useTranscription(transcriptionId);
  const { data: encryptionState } = useEncryptionStatus();

  const shared = transcription?.shared || [];
  const isOwner = transcription?.isOwner ?? true;

  const roleOptions = [
    { label: t("share.roles.read"), value: "read" },
    { label: t("share.roles.readListen"), value: "read+listen" },
    { label: t("share.roles.write"), value: "write" },
    { label: t("share.roles.revokeAccess"), value: "revoke" },
  ];

  const addRoleOptions = [
    { label: t("share.roles.read"), value: "read" },
    { label: t("share.roles.readListen"), value: "read+listen" },
    { label: t("share.roles.write"), value: "write" },
  ];

  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"read" | "read+listen" | "write">(
    "read",
  );
  const [userCache, setUserCache] = useState<Map<string, UserInfo>>(new Map());
  const [loadingUsers, setLoadingUsers] = useState<Set<string>>(new Set());

  const shareMutation = useShareTranscription(transcriptionId);
  const removeMutation = useRemoveShare(transcriptionId);

  // Clear form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setNewEmail("");
      setNewRole("read");
    }
  }, [isOpen]);

  // Fetch user info for all shared users
  useEffect(() => {
    const fetchUserInfo = async (userId: string) => {
      if (userCache.has(userId) || loadingUsers.has(userId)) return;

      setLoadingUsers((prev) => new Set(prev).add(userId));

      try {
        const response = await fetch(`/api/user/${userId}`);
        if (response.ok) {
          const userData = await response.json();
          setUserCache((prev) => new Map(prev).set(userId, userData));
        }
      } catch (error) {
        console.error("Failed to fetch user info:", error);
      } finally {
        setLoadingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    };

    (shared || []).forEach((s) => fetchUserInfo(s.userId));
  }, [shared, userCache, loadingUsers]);

  const handleAddShare = async () => {
    if (!newEmail.trim()) {
      toast.error(t("share.errors.enterEmail"));
      return;
    }

    try {
      // First, get the target user's public key
      const userResponse = await fetch(
        `/api/user/by-email?email=${encodeURIComponent(newEmail.trim())}`,
      );
      if (!userResponse.ok) {
        if (userResponse.status === 404) {
          toast.error(t("share.errors.userNotFound"));
        } else {
          toast.error(t("share.errors.failedFindUser"));
        }
        return;
      }

      const targetUser = await userResponse.json();

      const encryptionUtils = new EncryptionUtils(browserCrypto);

      // Check if transcription has encryption
      const hasEncryption = encryptionUtils.hasEncryption(
        transcription?._raw as any,
      );

      // If transcription is encrypted but target user doesn't have encryption enabled
      if (hasEncryption && !targetUser.publicKey) {
        toast.error(t("share.errors.noEncryption"));
        return;
      }

      // Prepare updated encrypted data if encryption is enabled
      let updatedEncryptedData: any = {};

      if (
        encryptionState?.hasLocalKey &&
        encryptionState?.privateKey &&
        encryptionState?.publicKey &&
        targetUser.publicKey &&
        transcription
      ) {
        // Create accessor for the new user
        const newAccessor = await encryptionUtils.createEncryptedAccessorEntity(
          targetUser.id,
          targetUser.publicKey,
          { sharedAt: new Date().toISOString() },
        );

        // Share audioFileEncryption if it exists
        if (transcription.audioFileEncryption) {
          updatedEncryptedData.audioFileEncryption =
            await encryptionUtils.share(
              (transcription._raw as any).audioFileEncryption as any,
              newAccessor,
              encryptionState.privateKey,
              encryptionState.publicKey,
            );
        }

        // Share transcription data if it exists
        if (transcription.transcription) {
          updatedEncryptedData.transcription = await encryptionUtils.share(
            (transcription._raw as any).transcription as any,
            newAccessor,
            encryptionState.privateKey,
            encryptionState.publicKey,
          );
        }
      }

      const result = await shareMutation.mutateAsync({
        email: newEmail.trim(),
        role: newRole,
        encryptedData:
          Object.keys(updatedEncryptedData).length > 0
            ? updatedEncryptedData
            : undefined,
      });

      if (result.exists) {
        toast.success(t("share.success.shared", { email: newEmail }));
        setNewEmail("");
        setNewRole("read");
      }
    } catch (error: any) {
      if (error.message.includes("not found")) {
        toast.error(t("share.errors.userNotFound"));
      } else {
        toast.error(error.message || t("share.errors.failedShare"));
      }
    }
  };

  const handleUpdateRole = async (
    userId: string,
    email: string,
    role: "read" | "read+listen" | "write",
  ) => {
    try {
      // When updating role, we don't need to change encryption, just the role
      await shareMutation.mutateAsync({ email, role });
      toast.success(t("share.success.permissionUpdated"));
    } catch (error: any) {
      toast.error(error.message || t("share.errors.failedUpdatePermission"));
    }
  };

  const handleRemoveShare = async (userId: string) => {
    try {
      await removeMutation.mutateAsync(userId);
      toast.success(t("share.success.accessRevoked"));
    } catch (error: any) {
      toast.error(error.message || t("share.errors.failedRevoke"));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isOwner ? t("share.title") : t("share.sharedWith")}
          </DialogTitle>
          {isOwner && (
            <DialogDescription>{t("share.description")}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 pt-2 pb-6 px-6">
          {/* Existing shares */}
          {shared && shared.length > 0 && (
            <div className="space-y-2">
              {shared.map((share) => {
                const user = userCache.get(share.userId);
                const isLoading = loadingUsers.has(share.userId);

                return (
                  <div
                    key={share.userId}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      {isLoading ? (
                        <div className="text-sm text-muted-foreground">
                          {t("share.loading")}
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium truncate">
                            {user?.name || t("share.unknownUser")}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {user?.email || share.userId}
                          </div>
                        </>
                      )}
                    </div>
                    {isOwner ? (
                      <Select
                        value={share.role}
                        onChange={(value: string) => {
                          if (value === "revoke") {
                            handleRemoveShare(share.userId);
                          } else {
                            handleUpdateRole(
                              share.userId,
                              user?.email || "",
                              value as "read" | "read+listen" | "write",
                            );
                          }
                        }}
                        disabled={shareMutation.isPending}
                        options={roleOptions}
                        className="h-9 w-[150px]"
                        size="sm"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground px-3 py-1.5 bg-muted rounded-md">
                        {share.role === "read+listen"
                          ? t("share.roles.readListen")
                          : share.role === "read"
                            ? t("share.roles.read")
                            : t("share.roles.write")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new share */}
          {isOwner && (
            <div className="flex gap-2 items-center">
              <Input
                placeholder={t("share.enterEmail")}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddShare();
                  }
                }}
                disabled={shareMutation.isPending}
                className="grow"
              />
              <Select
                value={newRole}
                onChange={(value: string) =>
                  setNewRole(value as "read" | "read+listen" | "write")
                }
                disabled={shareMutation.isPending}
                options={addRoleOptions}
                className="w-min"
                size="sm"
              />
              <Button
                size="default"
                onClick={handleAddShare}
                disabled={shareMutation.isPending || !newEmail.trim()}
              >
                {shareMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4" />
                    {t("share.add")}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
