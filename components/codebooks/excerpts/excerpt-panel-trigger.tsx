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
    <>
      {/* This toggle changes the SHAPE of the window; everything to its left acts
          on the document. A hairline says so, and stops the panel button reading
          as one more entry in the document's own row of actions. It rides with the
          trigger rather than sitting in the header, so it appears exactly when the
          trigger does — which is to say, in coding. */}
      <span
        aria-hidden
        className="mx-1 hidden h-5 w-px shrink-0 bg-border md:block"
      />
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
    </>
  );
}
