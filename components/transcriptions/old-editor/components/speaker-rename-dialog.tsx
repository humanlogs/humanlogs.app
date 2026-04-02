"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useModal } from "@/components/use-modal";
import { useTranslations } from "@/components/locale-provider";

type SpeakerRenameModalData = {
  speakerId: string;
  currentName: string;
  onRename: (name: string) => void;
};

const MODAL_ID = "speaker-rename-modal";

export function useSpeakerRenameModal() {
  const modal = useModal<SpeakerRenameModalData>(MODAL_ID);
  return {
    ...modal,
    openRename: (
      speakerId: string,
      currentName: string,
      onRename: (name: string) => void,
    ) => {
      modal.open({ speakerId, currentName, onRename });
    },
  };
}

function SpeakerRenameForm({
  currentName,
  onRename,
  onClose,
}: {
  currentName: string;
  onRename: (name: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("editor");
  // Initialised from prop at mount — Dialog returns null when closed so this
  // component remounts fresh on every open, no useEffect needed.
  const [name, setName] = useState(currentName);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onRename(trimmed);
    onClose();
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="px-6 space-y-2">
        <Label htmlFor="speaker-name">{t("speaker.nameLabel")}</Label>
        <Input
          id="speaker-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          onFocus={
            // Select all content
            (e) => {
              e.target.setSelectionRange(0, name.length);
            }
          }
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("speaker.cancel")}
        </Button>
        <Button type="submit" variant={"primary"}>
          {t("speaker.rename")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SpeakerRenameDialog() {
  const t = useTranslations("editor");
  const { isOpen, data, close } = useSpeakerRenameModal();

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("speaker.renameTitle")}</DialogTitle>
        </DialogHeader>
        {/* Mount a fresh form each open so state initialises from currentName without an effect */}
        {isOpen && data && (
          <SpeakerRenameForm
            key={data.speakerId}
            currentName={data.currentName}
            onRename={data.onRename}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
