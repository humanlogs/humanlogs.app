"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  SharedUser,
  useRemoveShare,
  useShareTranscription,
} from "@/hooks/use-transcriptions";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type UserInfo = {
  id: string;
  name: string | null;
  email: string;
};

type TranscriptionShareDropdownProps = {
  transcriptionId: string;
  shared?: SharedUser[];
  trigger: React.ReactNode;
  isOwner?: boolean;
};

const roleOptions = [
  { label: "Read", value: "read" },
  { label: "Read + Listen", value: "read+listen" },
  { label: "Write", value: "write" },
  { label: "Revoke access", value: "revoke" },
];

const addRoleOptions = [
  { label: "Read", value: "read" },
  { label: "Read + Listen", value: "read+listen" },
  { label: "Write", value: "write" },
];

export function TranscriptionShareDropdown({
  transcriptionId,
  shared = [],
  trigger,
  isOwner = true,
}: TranscriptionShareDropdownProps) {
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"read" | "read+listen" | "write">(
    "read",
  );
  const [userCache, setUserCache] = useState<Map<string, UserInfo>>(new Map());
  const [loadingUsers, setLoadingUsers] = useState<Set<string>>(new Set());

  const shareMutation = useShareTranscription(transcriptionId);
  const removeMutation = useRemoveShare(transcriptionId);

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
      toast.error("Please enter an email address");
      return;
    }

    try {
      const result = await shareMutation.mutateAsync({
        email: newEmail.trim(),
        role: newRole,
      });

      if (result.exists) {
        toast.success(`Shared with ${newEmail}`);
        setNewEmail("");
        setNewRole("read");
      }
    } catch (error: any) {
      if (error.message.includes("not found")) {
        toast.error("User not found on platform");
      } else {
        toast.error(error.message || "Failed to share transcription");
      }
    }
  };

  const handleUpdateRole = async (
    userId: string,
    email: string,
    role: "read" | "read+listen" | "write",
  ) => {
    try {
      await shareMutation.mutateAsync({ email, role });
      toast.success("Permission updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update permission");
    }
  };

  const handleRemoveShare = async (userId: string) => {
    try {
      await removeMutation.mutateAsync(userId);
      toast.success("Access revoked");
    } catch (error: any) {
      toast.error(error.message || "Failed to revoke access");
    }
  };

  return (
    <DropdownMenu trigger={trigger} align="end">
      <div className="w-[400px]">
        <div className="px-2 py-1.5 text-sm font-semibold">
          {isOwner ? "Share transcription" : "Shared with"}
        </div>
        <DropdownMenuSeparator />

        {/* Existing shares */}
        {shared && shared.length > 0 && (
          <div className="max-h-[200px] overflow-y-auto">
            {shared.map((share) => {
              const user = userCache.get(share.userId);
              const isLoading = loadingUsers.has(share.userId);

              return (
                <div
                  key={share.userId}
                  className="flex items-center gap-2 px-2 py-2 hover:bg-accent rounded-sm"
                >
                  <div className="flex-1 min-w-0">
                    {isLoading ? (
                      <div className="text-xs text-muted-foreground">
                        Loading...
                      </div>
                    ) : (
                      <>
                        <div className="text-sm truncate">
                          {user?.name || "Unknown User"}
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
                      options={roleOptions}
                      className="h-8 w-[140px]"
                      size="sm"
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                      {share.role === "read+listen"
                        ? "Read + Listen"
                        : share.role.charAt(0).toUpperCase() +
                          share.role.slice(1)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {shared && shared.length > 0 && isOwner && <DropdownMenuSeparator />}

        {/* Add new share */}
        {isOwner && (
          <div className="p-2 space-y-2">
            <Input
              placeholder="Email address"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddShare();
                }
              }}
              className="h-8"
            />
            <div className="flex items-center gap-2">
              <Select
                value={newRole}
                onChange={(value: string) =>
                  setNewRole(value as "read" | "read+listen" | "write")
                }
                options={addRoleOptions}
                className="flex-1"
                size="sm"
              />
              <Button
                size="sm"
                onClick={handleAddShare}
                disabled={shareMutation.isPending || !newEmail.trim()}
                className="h-8"
              >
                {shareMutation.isPending ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <PlusIcon className="h-4 w-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DropdownMenu>
  );
}
