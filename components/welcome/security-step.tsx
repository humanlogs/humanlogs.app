"use client";

import {
  useEnableEncryption,
  useEncryptionStatus,
  useGenerateCertificate,
  useToggleDeviceTrust,
} from "@/hooks/use-encryption";
import { CheckCircleIcon, KeyIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
import { SetupEncryption } from "../encryption/setup-encryption";

interface SecurityStepProps {
  onContinue: () => void;
  onSkip: () => void;
  userName?: string;
}

export function SecurityStep({ onContinue, onSkip }: SecurityStepProps) {
  const status = useEncryptionStatus();

  useEffect(() => {
    if (status?.data?.publicKey) {
      onContinue();
    }
  }, [status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black p-4">
      <SetupEncryption
        onComplete={() => {
          onContinue();
        }}
        onSkip={() => {
          onContinue();
        }}
        hideSkipOption={false}
      />
    </div>
  );
}
