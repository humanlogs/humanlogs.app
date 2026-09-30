"use client";

import * as React from "react";
import { useTranslations } from "@/components/locale-provider";
import { usePhraseRows } from "@/hooks/use-local-index";
import { codeColorVar } from "@/lib/codebooks/coding";
import { codingIdsOf } from "@/lib/local/phrase-index";
import {
  takeRefs,
  type PhraseRef,
  type StreamedGroup,
} from "@/lib/local/phrase-stream";
import type { HydratedPhrases } from "@/lib/local/query-store.browser";
import {
  focusMatchesPhrase,
  useExcerptPanel,
  type PhraseFocus,
} from "./excerpt-panel-context";
import { ExcerptRow, type ExcerptCoding, type Provenance } from "./excerpt-row";
import type { ExcerptLabels } from "./use-excerpt-query";

/**
 * The excerpts themselves: groups, rows, and the two-way scroll with the editor.
 *
 * **Nothing is virtualised, and nothing needs to be.** A study can hold hundreds of
 * thousands of coded passages, and mounting them would be as slow as it sounds — so
 * the list renders a page at a time and grows when the reader reaches the bottom.
 * That fits how the table is actually read (from the top, until you find what you
 * came for) and costs a sentinel and a counter rather than a windowing library and
 * the fixed row heights it would demand: an excerpt is one to four lines, and
 * clipping them all to one would be the wrong trade in a tool for reading verbatim.
 *
 * **The query hands over names, not rows.** It walks the study without holding it,
 * so what a group carries is references — id, document, position — plus a count. The
 * text and the chips of the page being drawn are fetched here, by id. That is the
 * whole reason a study of 200k passages opens in the time a screenful takes to read
 * rather than the time a corpus takes to load.
 */

/** How many rows are added each time the reader reaches the end of the list. */
const PAGE = 60;

export function ExcerptList({
  groups,
  labels,
  deepen,
  coding,
}: {
  groups: StreamedGroup[];
  labels: ExcerptLabels;
  deepen: () => void;
  /** Present only while an editor is lending the table its document. */
  coding?: ExcerptCoding;
}) {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const [visible, setVisible] = React.useState(PAGE);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const plan = React.useMemo(
    () => takeRefs(groups, visible),
    [groups, visible],
  );

  // Deduplicated: grouping by code is not a partition, so a passage read as two
  // things appears in two groups and must still be fetched once.
  const ids = React.useMemo(() => {
    const seen = new Set<string>();
    for (const group of plan.groups) {
      for (const ref of group.refs) seen.add(ref.id);
    }
    return Array.from(seen);
  }, [plan.groups]);
  const { data: hydrated } = usePhraseRows(ids);

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

  /**
   * Read by the observer, which is created once and must see the latest state.
   *
   * Two different ends, and confusing them is how a list grows forever towards rows
   * that do not exist: `room` is references the pass actually kept and has not
   * mounted yet, `unfetched` is passages it counted but did not keep. The first is
   * a bigger page, the second is a deeper pass.
   */
  const growth = React.useRef({ room: 0, unfetched: 0, deepen });
  React.useEffect(() => {
    growth.current = {
      room: plan.available - plan.shown,
      unfetched: plan.total - plan.available,
      deepen,
    };
  }, [plan.available, plan.shown, plan.total, deepen]);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const { room, unfetched, deepen: more } = growth.current;
        if (room > 0) {
          setVisible((current) => current + PAGE);
          return;
        }
        // Everything the pass kept is on screen and it counted more: ask for a
        // deeper one. Guarded by `room`, so this fires once per exhaustion rather
        // than on every observation.
        if (unfetched > 0) more();
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

  /**
   * Replaying a passage, when the interview it comes from is the one on screen.
   *
   * Null otherwise, and the button simply does not appear: the player belongs to
   * the editor, and a play control that silently does nothing on the other 999
   * interviews of a study would be worse than none.
   */
  const playPhrase = panel.playPhrase;
  const stopPhrase = panel.stopPhrase;
  const playingPhraseId = panel.playingPhraseId;
  const playable = panel.audioDocumentId;
  const followDocument = panel.followDocument;
  const onPlay = React.useCallback(
    (phrase: {
      documentId: string;
      phraseId: string;
      from: number;
      to?: number;
    }) => {
      if (phrase.documentId !== playable) return;
      // The same button both ways: a passage already playing is one click from
      // stopping, which is what a control that has turned into a pause promises.
      if (playingPhraseId === phrase.phraseId) stopPhrase();
      else playPhrase(phrase);
    },
    [playable, playingPhraseId, playPhrase, stopPhrase],
  );

  const behind = plan.total - plan.shown;

  return (
    <div className="py-2" ref={rootRef}>
      {plan.groups.map((group) => (
        <ExcerptGroupSection
          key={group.key}
          group={group}
          hydrated={hydrated}
          labels={labels}
          focused={focused}
          provenance={provenance}
          onSelect={panel.focus}
          onFollow={followDocument}
          coding={coding}
          onPlay={playable ? onPlay : undefined}
          playingPhraseId={playingPhraseId}
        />
      ))}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {behind > 0 && (
        <p className="px-2 py-3 text-center text-xs text-muted-foreground">
          {t("more", { count: behind })}
        </p>
      )}
    </div>
  );
}

/**
 * Where the focused excerpt sits in the flattened list, or -1 when it is not in the
 * result at all — a passage coded with something the filter excludes, which is a
 * legitimate state and not a reason to grow the list.
 *
 * Runs on references alone: a phrase's anchors are recoverable from its id
 * ({@link codingIdsOf}), so recognising the editor's selection costs no fetch.
 */
function indexOfFocused(
  groups: readonly StreamedGroup[],
  focus: PhraseFocus,
): number {
  let index = 0;
  for (const group of groups) {
    for (const ref of group.refs) {
      if (focusMatchesPhrase(focus, asPhrase(ref))) return index;
      index++;
    }
  }
  return -1;
}

/** A reference in the shape the focus rules speak — see {@link codingIdsOf}. */
function asPhrase(ref: PhraseRef): {
  id: string;
  documentId: string;
  codingIds: string[];
} {
  return {
    id: ref.id,
    documentId: ref.documentId,
    codingIds: codingIdsOf(ref.id),
  };
}

function ExcerptGroupSection({
  group,
  hydrated,
  labels,
  focused,
  provenance,
  onSelect,
  onPlay,
  playingPhraseId,
  onFollow,
  coding,
}: {
  group: StreamedGroup;
  hydrated: HydratedPhrases | undefined;
  labels: ExcerptLabels;
  focused: PhraseFocus | null;
  provenance: Provenance;
  onSelect: (focus: PhraseFocus) => void;
  onPlay?: (phrase: {
    documentId: string;
    phraseId: string;
    from: number;
    to?: number;
  }) => void;
  playingPhraseId?: string | null;
  onFollow: (documentId: string, codingId?: string) => void;
  coding?: ExcerptCoding;
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
    // A rule above each group, and the heading STICKS to the top of the scroll area
    // while its rows go past. Excerpts are ragged blocks of prose, so without both
    // the eye cannot tell where one theme ends and the next begins, and thirty rows
    // into a long group there is nothing left on screen saying which theme you are
    // reading. `first:border-t-0` because the top of the list needs no rule.
    <section className="border-t border-border/60 pb-2 first:border-t-0">
      {header && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          // `z-10` over the rows, which carry their own background on hover and
          // would otherwise show through the heading as it passes behind them.
          className="sticky top-0 z-10 flex w-full items-center gap-2 border-b bg-background/95 px-2 py-1.5 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm hover:bg-accent/50"
        >
          <span className="min-w-0 flex-1">{header}</span>
          {/* The group's whole size, not the part of it that is mounted. */}
          <span className="tabular-nums">{group.count}</span>
        </button>
      )}
      {/* The rows keep their inset; only the rules and the sticky heading run the
          full width of the panel, which is what makes them read as separators
          rather than as the edges of a card. */}
      {!collapsed &&
        (group.refs.length === 0 ? (
          <p className="px-3 py-1.5 text-xs text-muted-foreground/60">
            {t("groupEmpty")}
          </p>
        ) : (
          <div className="px-2 pt-1">
            {group.refs.map((ref) => (
              <ExcerptRow
                key={`${group.key}:${ref.id}`}
                phraseRef={ref}
                hydrated={hydrated}
                grouping={grouping}
                labels={labels}
                focused={focusMatchesPhrase(focused, asPhrase(ref))}
                provenance={provenance}
                onSelect={onSelect}
                onPlay={onPlay}
                playing={playingPhraseId === ref.id}
                onFollow={onFollow}
                coding={coding}
              />
            ))}
          </div>
        ))}
    </section>
  );
}

function groupHeader(
  group: StreamedGroup,
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
