"use client";

import * as React from "react";
import { ArrowUpRightIcon, PauseIcon, PlayIcon, TagIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { CodeCheckItems } from "@/components/codebooks/code-picker";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import type { CodeRef, DecryptedCodebook } from "@/lib/codebooks/codebook";
import { codeColorVar } from "@/lib/codebooks/coding";
import { formatTimecode } from "@/lib/codebooks/excerpt-export";
import { codingIdsOf } from "@/lib/local/phrase-index";
import type { PhraseRef } from "@/lib/local/phrase-stream";
import type { HydratedPhrases } from "@/lib/local/query-store.browser";
import { cn } from "@/lib/utils/utils";
import type { PhraseFocus } from "./excerpt-panel-context";
import type { ExcerptLabels } from "./use-excerpt-query";

/**
 * One excerpt: the passage, where it comes from, and what can be done to it here.
 *
 * Split from the list because the two answer different questions. The list is about
 * SCROLLING — what is mounted, when to fetch more, how far a pass reaches. This is
 * about a row: its text, its chips, and the three controls whose availability
 * depends on whether the interview it comes from is the one on screen.
 */

/** What a row is allowed to do, laid over it rather than nested inside it. */
export type Provenance = { document: boolean; speaker: boolean };

/**
 * What the table needs in order to change a passage's codes.
 *
 * Only ever present for the document currently open in an editor, because a coding
 * is a database row AND an anchor in that document's CRDT — see `registerCoding`.
 * A row of another interview shows no picker rather than one that would half-apply.
 */
export type ExcerptCoding = {
  documentId: string;
  /** The verbatim codebooks covering this study. */
  codebooks: DecryptedCodebook[];
  toggle: (
    phrase: { documentId: string; codingIds: string[] },
    codebookId: string,
    codeId: string,
  ) => void;
};

/**
 * Put a code on this passage, or take one off, without leaving the table.
 *
 * The codes already on it are ticked, so the menu reads as "what this passage is",
 * not as a list of things to add — which is what makes it usable for the actual job,
 * putting one excerpt under a second theme.
 *
 * One consequence worth knowing: a phrase's id IS its sorted anchors, so adding a
 * code gives the passage a NEW id, and the row is re-keyed and may land under a
 * different heading. That is the table being right rather than the row being lost.
 */
function RowCodeMenu({
  phraseRef,
  codes,
  coding,
}: {
  phraseRef: PhraseRef;
  codes: CodeRef[];
  coding: ExcerptCoding;
}) {
  const t = useTranslations("codebook.excerpts");
  const applied = new Set(
    codes.map((ref) => `${ref.codebookId}:${ref.codeId}`),
  );

  return (
    <DropdownMenu
      align="end"
      trigger={
        <button
          type="button"
          aria-label={t("recode")}
          className="flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
        >
          <TagIcon className="size-3" />
        </button>
      }
    >
      <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
        {t("recode")}
      </div>
      <CodeCheckItems
        codebooks={coding.codebooks}
        stateOf={(codebookId, codeId) =>
          applied.has(`${codebookId}:${codeId}`) ? "all" : "none"
        }
        onToggle={(codebookId, codeId) =>
          coding.toggle(
            {
              documentId: phraseRef.documentId,
              codingIds: codingIdsOf(phraseRef.id),
            },
            codebookId,
            codeId,
          )
        }
      />
      <p className="border-t px-2 pb-1 pt-1.5 text-[11px] leading-snug text-muted-foreground">
        {/* Said out loud, because the rule is not guessable: you can retract your
            own reading of a passage but not a colleague's. */}
        {t("recodeMine")}
      </p>
    </DropdownMenu>
  );
}

/** Stable identity, so a row with no codes is not re-rendered by a fresh `[]`. */
const EMPTY_CODES: CodeRef[] = [];

/**
 * A row's chips: the codes on it, deduplicated.
 *
 * The same code applied by two researchers is one chip, not two — the table shows
 * what a passage was read AS, and who read it that way is a filter, not a label.
 */
function chipsOf(
  hydrated: HydratedPhrases | undefined,
  phraseId: string,
): CodeRef[] {
  const links = hydrated?.codes.get(phraseId);
  if (!links || links.length === 0) return EMPTY_CODES;
  const seen = new Set<string>();
  const refs: CodeRef[] = [];
  for (const link of links) {
    const key = `${link.codebookId}:${link.codeId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ codebookId: link.codebookId, codeId: link.codeId });
  }
  return refs;
}

/** A row's chips, minus the code its group already stands for. */
function chipsFor(
  codes: CodeRef[],
  grouping: { codebookId: string; codeId: string } | null,
): CodeRef[] {
  if (codes.length === 0) return EMPTY_CODES;
  if (!grouping) return codes;
  const rest = codes.filter(
    (code) =>
      code.codebookId !== grouping.codebookId ||
      code.codeId !== grouping.codeId,
  );
  return rest.length === codes.length
    ? codes
    : rest.length
      ? rest
      : EMPTY_CODES;
}

export function ExcerptRow({
  phraseRef,
  hydrated,
  grouping,
  labels,
  focused,
  provenance,
  onSelect,
  onPlay,
  playing = false,
  onFollow,
  coding,
}: {
  phraseRef: PhraseRef;
  /** The fetched page. Undefined until its text arrives, a frame after its names. */
  hydrated: HydratedPhrases | undefined;
  /** The code this row's heading already stands for, if any. */
  grouping: { codebookId: string; codeId: string } | null;
  labels: ExcerptLabels;
  focused: boolean;
  provenance: Provenance;
  onSelect: (focus: PhraseFocus) => void;
  /** Present only while this row's interview is the one with a player. */
  onPlay?: (phrase: {
    documentId: string;
    phraseId: string;
    from: number;
    to?: number;
  }) => void;
  /** This passage is the one currently being replayed. */
  playing?: boolean;
  /** Open this row's interview, keeping the table as it is. */
  onFollow: (documentId: string, codingId?: string) => void;
  /** Present only while this row's interview is the one open and writable. */
  coding?: ExcerptCoding;
}) {
  const t = useTranslations("codebook.excerpts");
  const row = hydrated?.rows.get(phraseRef.id);
  // Two different sets on purpose. The CHIPS drop the code the heading already
  // stands for; the PICKER must show every code the passage carries, or the one it
  // is filed under would read as unticked and clicking it would retract it.
  const allCodes = chipsOf(hydrated, phraseRef.id);
  const codes = chipsFor(allCodes, grouping);
  const startTime = row?.startTime;
  const canPlay = onPlay && startTime !== undefined;
  const canCode = coding?.documentId === phraseRef.documentId;

  // The controls are SIBLINGS of the row, laid over it, not children: a button
  // inside a button is invalid HTML, and browsers resolve it by dropping one of
  // them — usually the one you wanted.
  //
  // Dimmed rather than hidden until hover. Hidden was the first version and it has
  // two faults: the code picker's menu outlives the hover that opened it, so its
  // own trigger faded out from under the reader while they were using it; and a
  // control nobody can see is a control nobody finds on a touchpad or by tab.
  return (
    <div className="group/excerpt relative">
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 opacity-50 transition-opacity focus-within:opacity-100 group-hover/excerpt:opacity-100">
        {canPlay && (
          <button
            type="button"
            onClick={() =>
              onPlay({
                documentId: phraseRef.documentId,
                phraseId: phraseRef.id,
                from: startTime,
                // The end, so the replay stops with the sentence instead of
                // running on into the rest of the interview.
                to: row?.endTime,
              })
            }
            aria-label={playing ? t("pause") : t("play")}
            title={formatTimecode(startTime)}
            className={cn(
              "flex size-6 items-center justify-center rounded-full border bg-background hover:text-foreground",
              playing ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {playing ? (
              <PauseIcon className="size-3" />
            ) : (
              <PlayIcon className="size-3" />
            )}
          </button>
        )}
        {canCode && (
          <RowCodeMenu phraseRef={phraseRef} codes={allCodes} coding={coding} />
        )}
        {/* Neither play nor recode is available on a row from another interview:
            both need that document open. Rather than show two dead controls, one
            arrow goes and gets it, and the table stays exactly as it is, filters
            and grouping included. */}
        {!canPlay && !canCode && (
          <button
            type="button"
            onClick={() =>
              onFollow(phraseRef.documentId, codingIdsOf(phraseRef.id)[0])
            }
            aria-label={t("open")}
            title={t("open")}
            className="flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          >
            <ArrowUpRightIcon className="size-3" />
          </button>
        )}
      </div>
      <button
        type="button"
        // Read by the scroll-sync above, which looks the row up rather than being
        // told about it — see {@link ExcerptList}.
        data-phrase-id={phraseRef.id}
        data-focused={focused || undefined}
        onClick={() =>
          onSelect({
            phraseId: phraseRef.id,
            documentId: phraseRef.documentId,
            codingIds: codingIdsOf(phraseRef.id),
            source: "table",
          })
        }
        className={cn(
          "mb-1 block w-full rounded-md border border-transparent px-2 py-2 text-left transition-colors",
          focused ? "border-border bg-accent" : "hover:bg-accent/50",
          // Room for the controls, so the first line of the verbatim never runs
          // underneath them. Only when there are any — an excerpt is narrow enough
          // already without a permanent empty gutter.
          canPlay && canCode
            ? "pr-16"
            : canPlay || canCode
              ? "pr-9"
              : undefined,
        )}
      >
        {row ? (
          <p className="line-clamp-3 text-sm leading-snug">{row.text}</p>
        ) : (
          // A placeholder of the right height, so arriving text does not shift the
          // list under a reader who is already scrolling through it.
          <span className="block h-5 w-3/4 animate-pulse rounded bg-muted" />
        )}
        {row && (provenance.speaker || provenance.document) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            {provenance.speaker && (
              <span className="truncate">
                {labels.speakerName(row.documentId, row.speakerId)}
              </span>
            )}
            {provenance.speaker && provenance.document && (
              <span aria-hidden>·</span>
            )}
            {provenance.document && (
              <span className="truncate">
                {labels.documentTitle(row.documentId)}
              </span>
            )}
          </div>
        )}
        {codes.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {codes.map((code) => {
              const { label, color } = labels.codeLabel(code);
              return (
                <span
                  key={`${code.codebookId}:${code.codeId}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: codeColorVar(color) }}
                  />
                  <span className="truncate">{label}</span>
                </span>
              );
            })}
          </div>
        )}
      </button>
    </div>
  );
}
