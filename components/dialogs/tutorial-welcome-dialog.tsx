"use client";

import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/components/use-modal";
import { Volume2, FileText, Sparkles } from "lucide-react";
import { useEffect } from "react";
import confetti from "canvas-confetti";

export type TutorialWelcomeModalData = {
  transcriptionId: string;
};

export function useTutorialWelcomeModal() {
  return useModal<TutorialWelcomeModalData>("tutorial-welcome-modal");
}

export function TutorialWelcomeDialog() {
  const t = useTranslations("tutorialWelcome");
  const { isOpen, close, data } = useTutorialWelcomeModal();

  useEffect(() => {
    if (isOpen) {
      // Trigger confetti when the modal opens
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleGetStarted = () => {
    // Mark that the user has seen the tutorial welcome for this transcription
    if (data?.transcriptionId) {
      localStorage.setItem(
        `tutorial-welcome-seen-${data.transcriptionId}`,
        "true",
      );
    }
    close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <DialogTitle className="text-2xl">{t("title")}</DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 px-6">
          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-1">
              <Volume2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium mb-1">{t("audioSection.title")}</h4>
              <p className="text-sm text-muted-foreground">
                {t("audioSection.description")}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-shrink-0 mt-1">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium mb-1">
                {t("transcriptSection.title")}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t("transcriptSection.description")}
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 mt-4">
            <p className="text-sm">
              <strong className="text-primary">{t("tip.label")}</strong>{" "}
              {t("tip.message")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleGetStarted} className="w-full sm:w-auto">
            {t("getStarted")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
