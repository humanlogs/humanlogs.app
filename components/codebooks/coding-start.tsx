"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { CodeDot } from "@/components/codebooks/coding-menu";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCodebooks } from "@/hooks/use-codebooks";
import { useCodings } from "@/hooks/use-codings";
import {
  codebooksInScopeForProject,
  flattenCodes,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { verbatimCodebooks } from "@/lib/codebooks/coding";
import { cn } from "@/lib/utils/utils";
import { BookMarkedIcon, PlusIcon, SparklesIcon } from "lucide-react";
import * as React from "react";

/**
 * Where a coding pass starts: which grille, over this interview.
 *
 * The question the editor never asked. Coding through a codebook is a CHOICE of
 * reading — the letters, the colours and the answer to "is this coded?" all
 * depend on it — and it used to be made by a dropdown in the corner of a toolbar,
 * at the same visual weight as the playback speed. A researcher who had never
 * opened the codebooks page would not know the choice existed.
 *
 * So it is a screen, once per pass. Once per PASS and not once per document:
 * working through eleven interviews with the same grille must not ask eleven
 * times (`lib/documents/coding-session.ts` holds that thread).
 *
 * It is also the only place where the state of the pass is visible before
 * starting it — how much of each grille this interview has already been read
 * through — and where the things done TO a whole document rather than to a
 * passage belong. Automatic coding is the one that is coming; it is named here,
 * disabled, because a screen that hides what it will do is a screen people learn
 * twice.
 */
export function CodingStart({
  transcriptionId,
  projectId,
  onChoose,
}: {
  transcriptionId: string;
  projectId?: string | null;
  /** The grille chosen: start the pass. */
  onChoose: (codebookId: string) => void;
}) {
  const t = useTranslations("codebook.start");
  const { openCreate } = useCodebookModal();
  const { data: codebooks = [], isLoading } = useCodebooks();
  const { data: codings = [] } = useCodings(transcriptionId);

  const available = React.useMemo(
    () => verbatimCodebooks(codebooksInScopeForProject(codebooks, projectId)),
    [codebooks, projectId],
  );

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 p-6 py-12">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6 py-10">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      {available.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <BookMarkedIcon className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="mb-1 font-medium">{t("empty.title")}</p>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("empty.description")}
          </p>
          <Button onClick={() => openCreate(projectId, "verbatim")}>
            <PlusIcon className="size-4" />
            {t("create")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {available.map((codebook) => (
            <CodebookCard
              key={codebook.id}
              codebook={codebook}
              codings={codings}
              onChoose={() => onChoose(codebook.id)}
            />
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => openCreate(projectId, "verbatim")}
          >
            <PlusIcon className="size-4" />
            {t("create")}
          </Button>
        </div>
      )}

      {/* Named and disabled rather than absent: the shape of the screen is part
          of what it teaches, and a control that appears later moves everything
          the reader had already learned the position of. */}
      <section className="space-y-2">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("actions")}
        </h2>
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <SparklesIcon className="size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground/70">{t("auto.title")}</p>
            <p className="text-xs">{t("auto.description")}</p>
          </div>
          <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px]">
            {t("soon")}
          </span>
        </div>
      </section>
    </div>
  );
}

/**
 * One grille, and how far this interview has been read through it.
 *
 * The number is COVERAGE OF THE GRILLE — how many of its codes have been used
 * here — not "how much of the transcript is coded", which is not a thing the
 * database can answer: a coding is an anchor in the document, and the server
 * holds the row without knowing what it spans. Coverage is what a researcher
 * actually watches during a pass anyway ("I have not used half of this grille
 * yet"), and it is honest about what it counts.
 */
function CodebookCard({
  codebook,
  codings,
  onChoose,
}: {
  codebook: DecryptedCodebook;
  codings: Array<{ codebookId: string; codeId: string }>;
  onChoose: () => void;
}) {
  const t = useTranslations("codebook.start");
  const codes = React.useMemo(
    () => flattenCodes(codebook.codes),
    [codebook.codes],
  );
  const mine = codings.filter((row) => row.codebookId === codebook.id);
  const used = new Set(mine.map((row) => row.codeId));
  const covered = codes.filter((entry) => used.has(entry.code.id)).length;
  const percent =
    codes.length === 0 ? 0 : Math.round((covered / codes.length) * 100);

  return (
    <button
      type="button"
      onClick={onChoose}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
        "hover:border-foreground/20 hover:bg-accent/50",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">
          {codebook.name || t("untitled")}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {t("coverage", { covered, total: codes.length })}
        </span>
      </div>

      {/* The top-level codes, as the legend the bar will show. Seeing the grille
          before choosing it is most of what makes the choice possible. */}
      <div className="flex flex-wrap items-center gap-1">
        {(codebook.codes ?? []).slice(0, 8).map((code) => (
          <span
            key={code.id}
            className="inline-flex max-w-[12rem] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]"
          >
            <CodeDot color={code.color ?? null} />
            <span className="truncate">{code.label}</span>
          </span>
        ))}
        {(codebook.codes?.length ?? 0) > 8 && (
          <span className="text-[11px] text-muted-foreground">
            +{(codebook.codes?.length ?? 0) - 8}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-yellow-400 transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {t("passages", { count: mine.length })}
        </span>
      </div>
    </button>
  );
}
