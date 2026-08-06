"use client";

import * as React from "react";
import { useTranslations } from "@/components/locale-provider";
import type { CodeRef } from "@/lib/codebooks/codebook";
import { codeColorVar } from "@/lib/codebooks/coding";
import type { PhraseRow } from "@/lib/local/phrase-index";
import { takeGroups, type PhraseGroup } from "@/lib/local/phrase-query";
import { cn } from "@/lib/utils/utils";
import {
  focusMatchesPhrase,
  useExcerptPanel,
  type PhraseFocus,
} from "./excerpt-panel-context";
import type { ExcerptLabels } from "./use-excerpt-query";

/**
 * The excerpts themselves: groups, rows, and the two-way scroll with the editor.
 *
 * **Nothing is virtualised, and nothing needs to be.** A study can hold tens of
 * thousands of coded passages, and mounting them would be as slow as it sounds — so
 * the list renders a page at a time and grows when the reader reaches the bottom.
 * That fits how the table is actually read (from the top, until you find what you
 * came for) and costs a sentinel and a counter rather than a windowing library and
 * the fixed row heights it would demand: an excerpt is one to four lines, and
 * clipping them all to one would be the wrong trade in a tool for reading verbatim.
 */

/** How many rows are added each time the reader reaches the end of the list. */
const PAGE = 60;

export function ExcerptList({
  groups,
  labels,
  codesOf,
}: {
  groups: PhraseGroup[];
  labels: ExcerptLabels;
  codesOf: (phraseId: string) => CodeRef[];
}) {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const [visible, setVisible] = React.useState(PAGE);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const plan = React.useMemo(
    () => takeGroups(groups, visible),
    [groups, visible],
  );

  /**
   * A new question deserves a fresh first page: after changing the filter the
   * reader is at the top again, and keeping the previous depth would mount rows
   * nobody has scrolled to.
   *
   * Keyed on what the RESEARCHER changed, not on the identity of `groups`. The
   * query rebuilds that array whenever anything upstream re-renders — a code
   * arriving from a colleague, the open document reindexing itself — and resetting
   * on that would silently undo the reader's scroll, and with it every page the
   * observer had just added.
   */
  const question = panel.filter;
  const grouping = panel.groupBy;
  const scope = panel.context;
  React.useEffect(() => {
    setVisible(PAGE);
  }, [question, grouping, scope]);

  /** Read by the observer, which is created once and must see the latest count. */
  const remainingRef = React.useRef(0);
  React.useEffect(() => {
    remainingRef.current = plan.remaining;
  }, [plan.remaining]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          // Only grow towards rows that exist. A short result leaves the sentinel
          // permanently in view, and an unguarded counter would then climb forever
          // — one re-render per observation, for a list of three excerpts.
          if (remainingRef.current <= 0) return;
          setVisible((current) => current + PAGE);
        }
      },
      // The scroll container is an ancestor rather than the browser viewport, and
      // a margin means the next page is mounted just before it is needed rather
      // than after the reader has already hit the bottom. Falling back to null
      // (the viewport) still grows the list, just later — worth having, since a
      // renamed attribute in the ScrollArea primitive would otherwise silently
      // change when the next page arrives.
      {
        root: root.closest('[data-slot="scroll-area-viewport"]'),
        rootMargin: "400px",
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const focused = panel.focused;

  /**
   * The editor focused a passage that has not been scrolled to yet: mount enough
   * pages to reach it.
   *
   * Without this the two-way sync would only work for the first page — which is
   * most of the time, since the panel opens scoped to the document being coded, and
   * exactly not the time it matters (a long interview, deep in a pass).
   */
  const reach = React.useMemo(
    () => (focused?.source === "editor" ? indexOfFocused(groups, focused) : -1),
    [groups, focused],
  );
  React.useEffect(() => {
    if (reach < 0) return;
    setVisible((current) => (current > reach ? current : reach + PAGE));
  }, [reach]);

  /**
   * Bring the focused row into view.
   *
   * An effect rather than a handler on the focus event: `data-focused` is written by
   * the render that the event triggers, so reading the DOM from inside the event
   * itself would find the PREVIOUS row still marked. Only the EDITOR's focus moves
   * the list — reacting to our own would fight the click that produced it.
   */
  React.useEffect(() => {
    if (focused?.source !== "editor") return;
    const row = rootRef.current?.querySelector<HTMLElement>(
      `[data-phrase-id][data-focused="true"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focused, visible]);

  /**
   * What a row still has to say about where it comes from.
   *
   * Scoped to the open document, repeating its title under every excerpt says
   * nothing and crowds out the speaker, who is the part that varies; grouped by
   * document or by speaker, the header has already said it. The line disappears
   * entirely when it would carry neither.
   */
  const provenance = {
    document: panel.filter.scope !== "document" && panel.groupBy !== "document",
    speaker: panel.groupBy !== "speaker",
  };

  return (
    <div className="p-2" ref={rootRef}>
      {plan.groups.map((group) => (
        <ExcerptGroupSection
          key={group.key}
          group={group}
          labels={labels}
          codesOf={codesOf}
          focused={focused}
          provenance={provenance}
          onSelect={panel.focus}
        />
      ))}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {plan.remaining > 0 && (
        <p className="px-2 py-3 text-center text-xs text-muted-foreground">
          {t("more", { count: plan.remaining })}
        </p>
      )}
    </div>
  );
}

/**
 * Where the focused excerpt sits in the flattened list, or -1 when it is not in the
 * result at all — a passage coded with something the filter excludes, which is a
 * legitimate state and not a reason to grow the list.
 */
function indexOfFocused(
  groups: readonly PhraseGroup[],
  focus: PhraseFocus,
): number {
  let index = 0;
  for (const group of groups) {
    for (const phrase of group.phrases) {
      if (focusMatchesPhrase(focus, phrase)) return index;
      index++;
    }
  }
  return -1;
}

type Provenance = { document: boolean; speaker: boolean };

function ExcerptGroupSection({
  group,
  labels,
  codesOf,
  focused,
  provenance,
  onSelect,
}: {
  group: PhraseGroup;
  labels: ExcerptLabels;
  codesOf: (phraseId: string) => CodeRef[];
  focused: PhraseFocus | null;
  provenance: Provenance;
  onSelect: (focus: PhraseFocus) => void;
}) {
  const t = useTranslations("codebook.excerpts");
  const [collapsed, setCollapsed] = React.useState(false);
  const header = groupHeader(group, labels);
  // Under a code heading, repeating that code on every row says nothing. The
  // OTHER codes a passage carries are exactly what the reader wants to see there
  // — that a passage read as «violence» was also read as «institution» is the
  // finding — so only the grouping code is dropped.
  const grouping = group.label.type === "code" ? group.label : null;

  return (
    <section className="mb-2">
      {header && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50"
        >
          <span className="min-w-0 flex-1">{header}</span>
          <span className="tabular-nums">{group.phrases.length}</span>
        </button>
      )}
      {!collapsed &&
        (group.phrases.length === 0 ? (
          <p className="px-3 py-1.5 text-xs text-muted-foreground/60">
            {t("groupEmpty")}
          </p>
        ) : (
          group.phrases.map((phrase) => (
            <ExcerptRow
              key={`${group.key}:${phrase.id}`}
              phrase={phrase}
              codes={chipsFor(codesOf(phrase.id), grouping)}
              labels={labels}
              focused={focusMatchesPhrase(focused, phrase)}
              provenance={provenance}
              onSelect={onSelect}
            />
          ))
        ))}
    </section>
  );
}

/** Stable identity, so a row with no codes is not re-rendered by a fresh `[]`. */
const EMPTY_CODES: CodeRef[] = [];

/** A row's chips, minus the code its group already stands for. */
function chipsFor(
  codes: CodeRef[] | undefined,
  grouping: { codebookId: string; codeId: string } | null,
): CodeRef[] {
  if (!codes || codes.length === 0) return EMPTY_CODES;
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

function groupHeader(
  group: PhraseGroup,
  labels: ExcerptLabels,
): React.ReactNode | null {
  switch (group.label.type) {
    case "all":
      return null;
    case "code": {
      const { label, color } = labels.codeLabel(group.label);
      return (
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: codeColorVar(color) }}
          />
          <span className="truncate">{label}</span>
        </span>
      );
    }
    case "codebook":
      return (
        <span className="truncate">
          {labels.codebookName(group.label.codebookId)}
        </span>
      );
    case "document":
      return (
        <span className="truncate">
          {labels.documentTitle(group.label.documentId)}
        </span>
      );
    case "speaker":
      return (
        <span className="truncate">
          {labels.speakerName(group.label.documentId, group.label.speakerId)}
        </span>
      );
  }
}

function ExcerptRow({
  phrase,
  codes,
  labels,
  focused,
  provenance,
  onSelect,
}: {
  phrase: PhraseRow;
  codes: CodeRef[];
  labels: ExcerptLabels;
  focused: boolean;
  provenance: Provenance;
  onSelect: (focus: PhraseFocus) => void;
}) {
  return (
    <button
      type="button"
      // Read by the scroll-sync above, which looks the row up rather than being
      // told about it — see {@link ExcerptList}.
      data-phrase-id={phrase.id}
      data-focused={focused || undefined}
      onClick={() =>
        onSelect({
          phraseId: phrase.id,
          documentId: phrase.documentId,
          codingIds: phrase.codingIds,
          source: "table",
        })
      }
      className={cn(
        "mb-1 block w-full rounded-md border border-transparent px-2 py-2 text-left transition-colors",
        focused ? "border-border bg-accent" : "hover:bg-accent/50",
      )}
    >
      <p className="line-clamp-3 text-sm leading-snug">{phrase.text}</p>
      {(provenance.speaker || provenance.document) && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          {provenance.speaker && (
            <span className="truncate">
              {labels.speakerName(phrase.documentId, phrase.speakerId)}
            </span>
          )}
          {provenance.speaker && provenance.document && (
            <span aria-hidden>·</span>
          )}
          {provenance.document && (
            <span className="truncate">
              {labels.documentTitle(phrase.documentId)}
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
  );
}
