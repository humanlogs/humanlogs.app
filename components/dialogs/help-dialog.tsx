"use client";

import { useTranslations } from "@/components/locale-provider";
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
import * as React from "react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useUserProfile } from "../../hooks/use-api";
import { languagesNames, locales } from "../../lib/i18n";

export type HelpModalData = Record<string, never>;

export function useHelpModal() {
  return useModal<HelpModalData>("help-modal");
}

export const useResetTutorial = () => {
  const t = useTranslations("help");
  const [isResettingTutorial, setIsResettingTutorial] = React.useState(false);

  const handleResetTutorial = async (language: string) => {
    setIsResettingTutorial(true);
    try {
      const response = await fetch("/api/user/tutorial", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: language,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reset tutorial");
      }

      toast.success(t("tutorial.resetSuccess"));

      const json = await response.json();

      // Reload the page to show the new tutorial transcription
      window.location.href = json?.transcription?.id
        ? "/transcription/" + json.transcription.id
        : "/new";
    } catch (error) {
      console.error("Error resetting tutorial:", error);
      toast.error(
        error instanceof Error ? error.message : t("tutorial.resetError"),
      );
    } finally {
      setIsResettingTutorial(false);
    }
  };

  return { isResettingTutorial, handleResetTutorial };
};

export function HelpDialog() {
  const t = useTranslations("help");
  const { isOpen, close } = useHelpModal();
  const [selectedLanguage, setSelectedLanguage] = React.useState<string>("en");
  const { isResettingTutorial, handleResetTutorial } = useResetTutorial();
  const { data: user } = useUserProfile();

  useEffect(() => {
    if (isOpen && user?.language) {
      setSelectedLanguage(user.language);
    }
  }, [isOpen, user?.language]);

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
                options={locales.map((locale) => ({
                  value: locale,
                  label: (languagesNames as any)[locale],
                }))}
                value={selectedLanguage}
                onChange={setSelectedLanguage}
                placeholder={t("languages.en")}
                className="flex-1 h-8"
              />
              <Button
                onClick={() => handleResetTutorial(selectedLanguage)}
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
