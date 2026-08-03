"use client";

import * as React from "react";
import { FilterIcon, SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import {
  CodeCheckItems,
  type CodeState,
} from "@/components/codebooks/code-picker";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  codebooksInScopeForProject,
  speakerCodebooks,
  type CodeRef,
  type DecryptedCodebook,
  type SpeakerCodeRef,
} from "@/lib/codebooks/codebook";
import { verbatimCodebooks } from "@/lib/codebooks/coding";
import { PHRASE_GROUP_BY, type PhraseGroupBy } from "@/lib/local/phrase-query";
import type { SpeakerSummary } from "@/lib/transcriptions/speakers";
import { cn } from "@/lib/utils/utils";
import { useExcerptPanel } from "./excerpt-panel-context";

/** The document list, reduced to what the panel filters on. */
export type ExcerptDocument = {
  id: string;
  title: string;
  projectId: string | null;
  codes: CodeRef[];
  speakerCodes: SpeakerCodeRef[];
  speakers: SpeakerSummary[];
  speakerCount: number;
};

/**
 * How the table is formatted: what it keeps, and how it is grouped.
 *
 * The two kinds of codebook appear as two SEPARATE controls, because they answer
 * different halves of the question. Speaker codes ("hôpital", "cadre") say WHICH
 * material to look at — they are resolved against the document list, and narrow the
 * corpus to a set of documents and people. Verbatim codes ("violence") say WHAT to
 * look for inside it. Merging them into one code picker would put two different
 * kinds of filter behind one control and make the AND between them invisible.
 */
export function ExcerptFilters({
  documents,
  codebooks,
}: {
  documents: ExcerptDocument[];
  codebooks: DecryptedCodebook[];
}) {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const { filter, setFilter, groupBy, setGroupBy, context } = panel;

  const inScope = codebooksInScopeForProject(codebooks, context.projectId);
  const verbatim = verbatimCodebooks(inScope);
  const speaker = speakerCodebooks(inScope);

  const toggle =
    (key: "codes" | "contextCodes") => (codebookId: string, codeId: string) =>
      setFilter((current) => {
        const has = current[key].some(
          (ref) => ref.codebookId === codebookId && ref.codeId === codeId,
        );
        return {
          ...current,
          [key]: has
            ? current[key].filter(
                (ref) =>
                  !(ref.codebookId === codebookId && ref.codeId === codeId),
              )
            : [...current[key], { codebookId, codeId }],
        };
      });

  const stateOf =
    (key: "codes" | "contextCodes") =>
    (codebookId: string, codeId: string): CodeState =>
      filter[key].some(
        (ref) => ref.codebookId === codebookId && ref.codeId === codeId,
      )
        ? "all"
        : "none";

  const active =
    filter.codes.length +
    filter.contextCodes.length +
    (filter.authors === "mine" ? 1 : 0) +
    (filter.scope === "document" ? 1 : 0);

  return (
    <div className="shrink-0 space-y-2 border-b px-3 py-2">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter.search}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                search: event.target.value,
              }))
            }
            placeholder={t("search")}
            className="h-8 pl-7 text-sm"
          />
        </div>
        {active > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t("reset")}
            onClick={() =>
              setFilter((current) => ({
                ...current,
                codes: [],
                contextCodes: [],
                authors: "everyone",
                scope: context.documentId ? current.scope : "study",
              }))
            }
          >
            <XIcon className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {context.documentId && (
          <Segmented
            value={filter.scope}
            onChange={(scope) =>
              setFilter((current) => ({
                ...current,
                scope: scope as typeof current.scope,
              }))
            }
            options={[
              { value: "document", label: t("scope.document") },
              { value: "study", label: t("scope.study") },
            ]}
          />
        )}

        {verbatim.length > 0 && (
          <FilterMenu
            label={t("filter.codes")}
            count={filter.codes.length}
            codebooks={verbatim}
            stateOf={stateOf("codes")}
            onToggle={toggle("codes")}
          />
        )}

        {speaker.length > 0 && (
          <FilterMenu
            label={t("filter.context")}
            count={filter.contextCodes.length}
            codebooks={speaker}
            stateOf={stateOf("contextCodes")}
            onToggle={toggle("contextCodes")}
          />
        )}

        <Segmented
          value={filter.authors}
          onChange={(authors) =>
            setFilter((current) => ({
              ...current,
              authors: authors as typeof current.authors,
            }))
          }
          options={[
            { value: "everyone", label: t("authors.everyone") },
            { value: "mine", label: t("authors.mine") },
          ]}
        />

        <DropdownMenu
          align="end"
          trigger={
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
            >
              {t(`groupBy.${groupBy}`)}
            </Button>
          }
        >
          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
            {t("groupBy.label")}
          </div>
          {PHRASE_GROUP_BY.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setGroupBy(option as PhraseGroupBy)}
              className={cn(
                "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                option === groupBy && "font-medium",
              )}
            >
              {t(`groupBy.${option}`)}
            </button>
          ))}
        </DropdownMenu>
      </div>

      {/* What the "which material" half currently resolves to. Coding is a lot of
          set arithmetic done in the head; saying how many documents survive it is
          the difference between trusting the table and re-counting it by hand. */}
      {filter.contextCodes.length > 0 && filter.scope === "study" && (
        <p className="text-[11px] text-muted-foreground">
          {t("narrowed", {
            count: countMatching(
              documents,
              context.projectId,
              filter.contextCodes,
            ),
          })}
        </p>
      )}
    </div>
  );
}

function countMatching(
  documents: ExcerptDocument[],
  projectId: string | null,
  codes: CodeRef[],
): number {
  const wanted = new Set(codes.map((ref) => `${ref.codebookId}:${ref.codeId}`));
  return documents.filter(
    (doc) =>
      doc.projectId === projectId &&
      [...doc.codes, ...doc.speakerCodes].some((ref) =>
        wanted.has(`${ref.codebookId}:${ref.codeId}`),
      ),
  ).length;
}

function FilterMenu({
  label,
  count,
  codebooks,
  stateOf,
  onToggle,
}: {
  label: string;
  count: number;
  codebooks: DecryptedCodebook[];
  stateOf: (codebookId: string, codeId: string) => CodeState;
  onToggle: (codebookId: string, codeId: string) => void;
}) {
  return (
    <DropdownMenu
      align="start"
      trigger={
        <Button
          variant={count > 0 ? "secondary" : "outline"}
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
        >
          <FilterIcon className="size-3" />
          {label}
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </Button>
      }
    >
      <CodeCheckItems
        codebooks={codebooks}
        stateOf={stateOf}
        onToggle={onToggle}
      />
    </DropdownMenu>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="inline-flex h-7 items-center rounded-md border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-sm px-2 text-xs transition-colors",
            option.value === value
              ? "bg-accent font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
