"use client";

import { HardDriveIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  useForgetLocalData,
  useLocalIndexStatus,
} from "@/hooks/use-local-index";

/**
 * What this device is holding, and the button that empties it.
 *
 * The app now keeps transcripts and coded passages in the browser, in clear, so
 * the excerpt panel can answer across a whole corpus and so a document opens
 * without a round trip. That is a real thing to have on a laptop, and it belongs
 * on the security page rather than buried in a menu: the researcher who encrypted
 * their corpus end-to-end is exactly the one entitled to know a copy of it is on
 * this machine, and to remove it in one click.
 *
 * Removing it costs nothing but the next sync — every row here is derived from the
 * server and rebuilt on demand.
 */
export function LocalDataCard() {
  const t = useTranslations("account.localData");
  const { available, documents } = useLocalIndexStatus();
  const forget = useForgetLocalData();

  if (!available) return null;

  const count = documents?.length ?? 0;
  const phrases =
    documents?.reduce((sum, row) => sum + row.phraseCount, 0) ?? 0;

  // The same bordered panel the encryption surfaces on this page draw, rather than
  // a shadcn Card: two card idioms stacked on one screen read as two systems.
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-6 sm:flex-row sm:items-center sm:gap-4">
      <HardDriveIcon className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">
          {count === 0 ? t("empty") : t("summary", { count, phrases })}
        </p>
      </div>
      <Button
        variant="outline"
        disabled={forget.isPending || count === 0}
        onClick={() => forget.mutate()}
        className="shrink-0"
      >
        {forget.isPending && <Loader2Icon className="size-4 animate-spin" />}
        {t("forget")}
      </Button>
    </div>
  );
}
