"use client";

import { PanelRightIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { useBetaFeatures } from "@/hooks/use-api";
import { cn } from "@/lib/utils/utils";
import {
  useExcerptPanel,
  useExcerptPanelOnPage,
} from "./excerpt-panel-context";

/**
 * Opens and closes the excerpt panel from the app bar.
 *
 * Hidden below `md` for the same reason the panel is: a second column on a phone
 * would cover the text it is about. Hidden entirely without the codebooks beta,
 * which is what the panel reads against, and off a document page, where the panel
 * itself no longer renders.
 */
export function ExcerptPanelTrigger() {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const betaFeatures = useBetaFeatures();
  const onPage = useExcerptPanelOnPage();

  // Codebooks are beta, and without one there is nothing to read against — the
  // same gate the study coding board applies. Off a document the panel does not
  // render, so a toggle here would be a button that visibly does nothing.
  if (!betaFeatures || !onPage) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={panel.toggle}
      aria-pressed={panel.open}
      aria-label={t("title")}
      title={t("title")}
      className={cn(
        "hidden size-8 shrink-0 md:inline-flex",
        panel.open && "bg-accent",
      )}
    >
      <PanelRightIcon className="size-4" />
    </Button>
  );
}
