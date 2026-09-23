"use client";

import * as React from "react";
import {
  ChevronRightIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import {
  CodeCheckItems,
  type CodeState,
} from "@/components/codebooks/code-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  codebooksInScopeForProject,
  speakerCodebooks,
  type CodeRef,
  type DecryptedCodebook,
  type SpeakerCodeRef,
} from "@/lib/codebooks/codebook";
import { verbatimCodebooks } from "@/lib/codebooks/coding";
import { ruleId, sameRule, type GroupRule } from "@/lib/local/group-rules";
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
 * How the table is formatted: how it is grouped, and what it keeps.
 *
 * **Grouping is one control, used repeatedly.** It used to be a menu of single
 * axes plus two separate code pickers, which asked the researcher to know in
 * advance which of three controls held the dimension they had in mind. There is
 * one now: add a rule, and it becomes a chip with the same "add" button after it.
 * "By person, then by the codes of this grille" is written the way it is said.
 *
 * **Filtering is the funnel beside it**, and it narrows the SAME dimensions,
 * whether or not they are also grouped. The two halves are still different
 * questions — speaker codes say WHICH material to look at, resolved against the
 * document list; verbatim codes say what to look for inside it — so the menu
 * keeps them apart under headings rather than merging them into one list where
 * the AND between them would be invisible.
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
  const { filter, setFilter, rules, setRules, context } = panel;

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

  /** Every rule that can still be added — a dimension is only useful once. */
  const available: GroupRule[] = [
    { kind: "speaker" } as GroupRule,
    { kind: "document" } as GroupRule,
    ...verbatim.map((book) => ({
      kind: "code" as const,
      codebookId: book.id,
    })),
    ...speaker.map((book) => ({
      kind: "context" as const,
      codebookId: book.id,
    })),
  ].filter((rule) => !rules.some((existing) => sameRule(existing, rule)));

  const ruleLabel = (rule: GroupRule): string => {
    switch (rule.kind) {
      case "speaker":
        return t("groupBy.speaker");
      case "document":
        return t("groupBy.document");
      case "code":
        return (
          codebooks.find((book) => book.id === rule.codebookId)?.name ??
          t("groupBy.code")
        );
      case "context":
        return (
          codebooks.find((book) => book.id === rule.codebookId)?.name ??
          t("groupBy.context")
        );
    }
  };

  return (
    <div className="shrink-0 space-y-2 border-b px-3 py-2">
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
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

        {/* One funnel for everything that narrows, grouped or not. */}
        <DropdownMenu
          align="end"
          trigger={
            <Button
              variant={active > 0 ? "secondary" : "outline"}
              size="icon"
              className="size-8 shrink-0"
              aria-label={t("filter.label")}
              title={t("filter.label")}
            >
              <FilterIcon className="size-4" />
              {active > 0 && (
                <span className="ml-0.5 text-[10px] tabular-nums">
                  {active}
                </span>
              )}
            </Button>
          }
        >
          {context.documentId && (
            <>
              <MenuLabel>{t("scope.label")}</MenuLabel>
              <MenuChoice
                selected={filter.scope === "document"}
                label={t("scope.document")}
                onClick={() =>
                  setFilter((current) => ({ ...current, scope: "document" }))
                }
              />
              <MenuChoice
                selected={filter.scope === "study"}
                label={t("scope.study")}
                onClick={() =>
                  setFilter((current) => ({ ...current, scope: "study" }))
                }
              />
              <DropdownMenuSeparator />
            </>
          )}

          <MenuLabel>{t("authors.label")}</MenuLabel>
          <MenuChoice
            selected={filter.authors === "everyone"}
            label={t("authors.everyone")}
            onClick={() =>
              setFilter((current) => ({ ...current, authors: "everyone" }))
            }
          />
          <MenuChoice
            selected={filter.authors === "mine"}
            label={t("authors.mine")}
            onClick={() =>
              setFilter((current) => ({ ...current, authors: "mine" }))
            }
          />

          {verbatim.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <MenuLabel>{t("filter.codes")}</MenuLabel>
              <CodeCheckItems
                codebooks={verbatim}
                stateOf={stateOf("codes")}
                onToggle={toggle("codes")}
              />
            </>
          )}

          {speaker.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {/* Kept under its own heading: these narrow WHOSE passages count,
                  which is a different question from which passages do, and the
                  AND between the two halves has to stay visible. */}
              <MenuLabel>{t("filter.context")}</MenuLabel>
              <CodeCheckItems
                codebooks={speaker}
                stateOf={stateOf("contextCodes")}
                onToggle={toggle("contextCodes")}
              />
            </>
          )}
        </DropdownMenu>

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

      {/* The chain, left to right, with the same "add" button after the last
          chip — which is what makes it read as a sentence being continued rather
          than as a set of independent switches. */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-muted-foreground">
          {t("groupBy.label")}
        </span>
        {rules.map((rule, index) => (
          <React.Fragment key={ruleId(rule)}>
            {index > 0 && (
              <ChevronRightIcon
                aria-hidden
                className="size-3 text-muted-foreground/60"
              />
            )}
            <span className="inline-flex h-6 items-center gap-1 rounded-full border bg-muted/50 pr-1 pl-2 text-xs">
              {rule.kind === "speaker" && <UserIcon className="size-3" />}
              <span className="max-w-[10rem] truncate">{ruleLabel(rule)}</span>
              <button
                type="button"
                aria-label={t("groupBy.remove")}
                onClick={() => setRules(rules.filter((_, i) => i !== index))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            </span>
          </React.Fragment>
        ))}

        {available.length > 0 && (
          <DropdownMenu
            align="start"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
              >
                <PlusIcon className="size-3" />
                {rules.length === 0 ? t("groupBy.add") : null}
              </Button>
            }
          >
            {available.map((rule) => (
              <button
                key={ruleId(rule)}
                type="button"
                onClick={() => setRules([...rules, rule])}
                className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {ruleLabel(rule)}
                {rule.kind === "context" && (
                  <span className="ml-auto pl-2 text-[10px] text-muted-foreground">
                    {t("groupBy.onPeople")}
                  </span>
                )}
              </button>
            ))}
          </DropdownMenu>
        )}
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

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </div>
  );
}

function MenuChoice({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
        selected && "font-medium",
      )}
    >
      {label}
    </button>
  );
}
