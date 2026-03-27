"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useModal } from "@/components/use-modal";
import { useTranslations } from "@/components/locale-provider";
import { BookOpenIcon, MessageCircleIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

export type HelpModalData = Record<string, never>;

export function useHelpModal() {
  return useModal<HelpModalData>("help-modal");
}

export function HelpDialog() {
  const { isOpen, close } = useHelpModal();
  const t = useTranslations("help");
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>("en");
  const [isResettingTutorial, setIsResettingTutorial] = React.useState(false);

  const handleResetTutorial = async () => {
    setIsResettingTutorial(true);
    try {
      const response = await fetch("/api/user/tutorial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: selectedLanguage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset tutorial");
      }

      toast.success(t("tutorial.resetSuccess"));

      // Reload the page to show the new tutorial transcription
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error resetting tutorial:", error);
      toast.error(
        error instanceof Error ? error.message : t("tutorial.resetError"),
      );
    } finally {
      setIsResettingTutorial(false);
    }
  };

  const handleOpenDocumentation = () => {
    window.open("https://docs.example.com", "_blank");
  };

  const handleOpenForum = () => {
    window.open("https://forum.example.com", "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 pb-6">
          {/* Tutorial Reset Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t("tutorial.title")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("tutorial.description")}
            </p>
            <div className="flex gap-2">
              <Select
                options={[{ value: "en", label: t("languages.en") }]}
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                placeholder={t("languages.en")}
                className="flex-1 h-8"
              />
              <Button
                onClick={handleResetTutorial}
                disabled={isResettingTutorial}
                variant="outline"
              >
                {isResettingTutorial
                  ? t("tutorial.resetting")
                  : t("tutorial.reset")}
              </Button>
            </div>
          </div>

          {/* Documentation Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t("documentation.title")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("documentation.description")}
            </p>
            <Button
              onClick={handleOpenDocumentation}
              variant="outline"
              className="w-full"
            >
              {t("documentation.open")}
            </Button>
          </div>

          {/* Forum Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t("forum.title")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("forum.description")}
            </p>
            <Button
              onClick={handleOpenForum}
              variant="outline"
              className="w-full"
            >
              {t("forum.open")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
