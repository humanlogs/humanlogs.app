"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { CodeDot } from "@/components/codebooks/coding-menu";
import { GuideCallout } from "@/components/guidance/guide-callout";
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
import {
  codedLengthOf,
  coveragePercent,
} from "@/lib/codebooks/coding-coverage";
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
  textLength,
  onChoose,
}: {
  transcriptionId: string;
  projectId?: string | null;
  /** Characters of transcript — the denominator of the coverage figure. */
  textLength?: number | null;
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
        /* The same callout the study's coding workshop shows, from the same
           component, because it is the same dead end reached from two directions
           — and this is the better place to reach it from. Entering the coding
           phase on a study with no verbatim grille used to land on the coding
           bar, whose only word on the subject was "no codebook covers this study
           yet": a statement, in the one screen that exists to offer making one. */
        <GuideCallout
          icon={<BookMarkedIcon className="h-5 w-5" />}
          title={t("empty.title")}
          description={t("empty.description")}
          action={{
            label: t("create"),
            onClick: () => openCreate(projectId, "verbatim"),
            icon: <PlusIcon className="h-4 w-4" />,
          }}
        />
      ) : (
        <div className="space-y-2">
          {available.map((codebook) => (
            <CodebookCard
              key={codebook.id}
              codebook={codebook}
              codings={codings}
              textLength={textLength}
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
 * Two numbers, because they answer two questions a researcher actually asks.
 * **Coverage of the TEXT** — the characters this grille's codings span, over the
 * characters of transcript — is "how much of this interview have I read". It is
 * deliberately approximate: both lengths are snapshots the client took at write
 * time (the server cannot read an encrypted transcript), a passage moves under
 * its anchor afterwards, and two overlapping codings count twice. Hence the
 * clamp: the figure is a sense of progress, not an audit.
 *
 * **Coverage of the GRILLE** — how many of its codes have been used here — is
 * "how much of this grille have I found", which is the other half of the same
 * pass and the one that says a theme is going unused.
 */
function CodebookCard({
  codebook,
  codings,
  textLength,
  onChoose,
}: {
  codebook: DecryptedCodebook;
  codings: Array<{ codebookId: string; codeId: string; textLength: number }>;
  textLength?: number | null;
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

  const percent = coveragePercent(codedLengthOf(mine, codebook.id), textLength);

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
          aria-valuenow={percent ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-yellow-400 transition-[width]"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {/* Null while the document has no recorded length — saved before the
              column existed. The passage count still says something; a percentage
              of an unknown total would not. */}
          {percent === null
            ? t("passages", { count: mine.length })
            : t("codedShare", { percent, count: mine.length })}
        </span>
      </div>
    </button>
  );
}
