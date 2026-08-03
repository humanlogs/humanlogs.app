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
  codesByPhrase,
}: {
  groups: PhraseGroup[];
  labels: ExcerptLabels;
  codesByPhrase: Map<string, CodeRef[]>;
}) {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const [visible, setVisible] = React.useState(PAGE);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // A new question deserves a fresh first page: after changing the filter the reader
  // is at the top again, and keeping the previous depth would mount rows nobody has
  // scrolled to.
  React.useEffect(() => {
    setVisible(PAGE);
  }, [groups]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible((current) => current + PAGE);
        }
      },
      // The scroll container is an ancestor rather than the viewport, and a margin
      // means the next page is mounted just before it is needed rather than after
      // the reader has already hit the bottom.
      {
        root: root.closest("[data-radix-scroll-area-viewport]"),
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

  const plan = React.useMemo(
    () => takeGroups(groups, visible),
    [groups, visible],
  );

  return (
    <div className="p-2" ref={rootRef}>
      {plan.groups.map((group) => (
        <ExcerptGroupSection
          key={group.key}
          group={group}
          labels={labels}
          codesByPhrase={codesByPhrase}
          focused={focused}
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

function ExcerptGroupSection({
  group,
  labels,
  codesByPhrase,
  focused,
  onSelect,
}: {
  group: PhraseGroup;
  labels: ExcerptLabels;
  codesByPhrase: Map<string, CodeRef[]>;
  focused: PhraseFocus | null;
  onSelect: (focus: PhraseFocus) => void;
}) {
  const t = useTranslations("codebook.excerpts");
  const [collapsed, setCollapsed] = React.useState(false);
  const header = groupHeader(group, labels);

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
              codes={codesByPhrase.get(phrase.id) ?? EMPTY_CODES}
              labels={labels}
              focused={focusMatchesPhrase(focused, phrase)}
              onSelect={onSelect}
            />
          ))
        ))}
    </section>
  );
}

/** Stable identity, so a row with no codes is not re-rendered by a fresh `[]`. */
const EMPTY_CODES: CodeRef[] = [];

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
  onSelect,
}: {
  phrase: PhraseRow;
  codes: CodeRef[];
  labels: ExcerptLabels;
  focused: boolean;
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
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          {labels.speakerName(phrase.documentId, phrase.speakerId)}
        </span>
        <span aria-hidden>·</span>
        <span className="truncate">
          {labels.documentTitle(phrase.documentId)}
        </span>
      </div>
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
