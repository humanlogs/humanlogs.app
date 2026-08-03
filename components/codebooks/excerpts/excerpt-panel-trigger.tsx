"use client";

import { PanelRightIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { useExcerptPanel } from "./excerpt-panel-context";

/**
 * Opens and closes the excerpt panel from the app bar.
 *
 * Hidden below `md` for the same reason the panel is: a second column on a phone
 * would cover the text it is about.
 */
export function ExcerptPanelTrigger() {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={panel.toggle}
      aria-pressed={panel.open}
      aria-label={t("title")}
      title={t("title")}
      className={cn("hidden size-8 shrink-0 md:inline-flex", panel.open && "bg-accent")}
    >
      <PanelRightIcon className="size-4" />
    </Button>
  );
}
