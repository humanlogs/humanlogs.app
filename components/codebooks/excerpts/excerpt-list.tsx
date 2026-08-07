"use client";

import * as React from "react";
import { PlayIcon, TagIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { CodeCheckItems } from "@/components/codebooks/code-picker";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { usePhraseRows } from "@/hooks/use-local-index";
import type { CodeRef, DecryptedCodebook } from "@/lib/codebooks/codebook";
import { codeColorVar } from "@/lib/codebooks/coding";
import { formatTimecode } from "@/lib/codebooks/excerpt-export";
import { codingIdsOf, type PhraseRow } from "@/lib/local/phrase-index";
import {
  takeRefs,
  type PhraseRef,
  type StreamedGroup,
} from "@/lib/local/phrase-stream";
import type { HydratedPhrases } from "@/lib/local/query-store.browser";
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
  const seekAudio = panel.seekAudio;
  const playable = panel.audioDocumentId;
  const onPlay = React.useCallback(
    (documentId: string, seconds: number) => {
      if (documentId !== playable) return;
      seekAudio(seconds);
    },
    [playable, seekAudio],
  );

  const behind = plan.total - plan.shown;

  return (
    <div className="p-2" ref={rootRef}>
      {plan.groups.map((group) => (
        <ExcerptGroupSection
          key={group.key}
          group={group}
          hydrated={hydrated}
          labels={labels}
          focused={focused}
          provenance={provenance}
          onSelect={panel.focus}
          coding={coding}
          onPlay={playable ? onPlay : undefined}
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

type Provenance = { document: boolean; speaker: boolean };

function ExcerptGroupSection({
  group,
  hydrated,
  labels,
  focused,
  provenance,
  onSelect,
  onPlay,
  coding,
}: {
  group: StreamedGroup;
  hydrated: HydratedPhrases | undefined;
  labels: ExcerptLabels;
  focused: PhraseFocus | null;
  provenance: Provenance;
  onSelect: (focus: PhraseFocus) => void;
  onPlay?: (documentId: string, seconds: number) => void;
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
    <section className="mb-2">
      {header && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50"
        >
          <span className="min-w-0 flex-1">{header}</span>
          {/* The group's whole size, not the part of it that is mounted. */}
          <span className="tabular-nums">{group.count}</span>
        </button>
      )}
      {!collapsed &&
        (group.refs.length === 0 ? (
          <p className="px-3 py-1.5 text-xs text-muted-foreground/60">
            {t("groupEmpty")}
          </p>
        ) : (
          group.refs.map((ref) => (
            <ExcerptRow
              key={`${group.key}:${ref.id}`}
              phraseRef={ref}
              row={hydrated?.rows.get(ref.id)}
              // Two different sets on purpose. The CHIPS drop the code the group
              // heading already stands for; the picker must show every code the
              // passage carries, or the one it is filed under would read as
              // unticked and clicking it would retract it by accident.
              codes={chipsFor(chipsOf(hydrated, ref.id), grouping)}
              allCodes={chipsOf(hydrated, ref.id)}
              labels={labels}
              focused={focusMatchesPhrase(focused, asPhrase(ref))}
              provenance={provenance}
              onSelect={onSelect}
              onPlay={onPlay}
              coding={coding}
            />
          ))
        ))}
    </section>
  );
}

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

function ExcerptRow({
  phraseRef,
  row,
  codes,
  allCodes,
  labels,
  focused,
  provenance,
  onSelect,
  onPlay,
  coding,
}: {
  phraseRef: PhraseRef;
  /** Undefined until this page's text arrives — a frame or two after its names. */
  row: PhraseRow | undefined;
  /** What the row displays: minus the code its group already names. */
  codes: CodeRef[];
  /** What the picker ticks: everything the passage carries. */
  allCodes: CodeRef[];
  labels: ExcerptLabels;
  focused: boolean;
  provenance: Provenance;
  onSelect: (focus: PhraseFocus) => void;
  /** Present only while this row's interview is the one with a player. */
  onPlay?: (documentId: string, seconds: number) => void;
  /** Present only while this row's interview is the one open and writable. */
  coding?: ExcerptCoding;
}) {
  const t = useTranslations("codebook.excerpts");
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
            onClick={() => onPlay(phraseRef.documentId, startTime)}
            aria-label={t("play")}
            title={formatTimecode(startTime)}
            className="flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          >
            <PlayIcon className="size-3" />
          </button>
        )}
        {canCode && (
          <RowCodeMenu phraseRef={phraseRef} codes={allCodes} coding={coding} />
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
