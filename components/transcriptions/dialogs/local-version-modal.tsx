"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangleIcon,
  ClockIcon,
  HardDriveIcon,
  CloudIcon,
} from "lucide-react";
import { useTranslations } from "@/components/locale-provider";

type LocalVersionModalProps = {
  isOpen: boolean;
  onUseLocal: () => void;
  onUseServer: () => void;
  localUpdatedAt: number;
  serverUpdatedAt: string;
};

export function LocalVersionModal({
  isOpen,
  onUseLocal,
  onUseServer,
  localUpdatedAt,
  serverUpdatedAt,
}: LocalVersionModalProps) {
  const t = useTranslations("dialog.localVersion");

  const formatDate = (timestamp: number | string) => {
    const date =
      typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const localDate = formatDate(localUpdatedAt);
  const serverDate = formatDate(serverUpdatedAt);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
            <DialogTitle>{t("title")}</DialogTitle>
          </div>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <HardDriveIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{t("localVersion")}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {localDate}
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                {t("savedOnDevice")}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border">
            <CloudIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">{t("serverVersion")}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {serverDate}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {t("lastSynced")}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onUseServer}
            className="sm:mr-auto"
          >
            {t("useServer")}
          </Button>
          <Button onClick={onUseLocal}>{t("useLocal")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
