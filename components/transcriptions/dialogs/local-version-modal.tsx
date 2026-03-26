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
import * as React from "react";

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
            <DialogTitle>Local Changes Found</DialogTitle>
          </div>
          <DialogDescription>
            We found unsaved changes on your device that are newer than the
            version on the server. Which version would you like to use?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
            <HardDriveIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">Local Version</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {localDate}
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                Saved on this device (not yet synced)
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg border">
            <CloudIcon className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="font-medium">Server Version</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <ClockIcon className="h-3.5 w-3.5" />
                {serverDate}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Last synced to the cloud
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
            Use Server Version
          </Button>
          <Button onClick={onUseLocal}>Use Local Version</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
