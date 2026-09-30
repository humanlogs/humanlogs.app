"use client";

import { useTranslations } from "@/components/locale-provider";
import type { AnalysisFacet } from "@/lib/analysis/analysis-facets";
import type { GroupAnalysis } from "@/hooks/use-analyses";
import { cn } from "@/lib/utils/utils";
import { MessageSquareIcon } from "lucide-react";
import * as React from "react";

/**
 * Writing an analysis, and reading the narrower ones already written.
 *
 * What the table can do for a researcher, a note cannot: an excerpt is evidence,
 * an analysis is what they make of a body of it. So this is attached to the GROUP
 * — a theme, a person, an interview — crossed with whatever filters are on, not
 * to any one passage. See `lib/analysis/analysis-facets.ts` for what that
 * combination is and why the same question always finds the same note.
 *
 * The narrower notes below the box are the point of the whole scheme. Having
 * written about the positive passages OF THE CADRES, a researcher who later looks
 * at every positive passage is shown that note rather than an empty box: the work
 * is not stranded in a filter combination they would have to remember.
 */

/** Everything the list needs to show and write one group's analysis. */
export type ExcerptAnalysis = {
  /** The note for a group, and the narrower ones under it. */
  of: (groupKey: string) => GroupAnalysis | undefined;
  /**
   * Write the reader's note on a slice. `existingId` is the note already there,
   * because a slice is a THREAD now: writing replaces your own note rather than
   * adding a second one beside it, and an empty body retracts it.
   */
  save: (
    facets: AnalysisFacet[],
    body: string,
    existingId: string | null,
  ) => void;
  /** One facet in words, for labelling a narrower note. */
  describe: (facet: AnalysisFacet) => string;
  /** The comment threads written inside this group's passages. */
  commentsOf: (groupKey: string) => CommentThread[];
  /** Go to a thread where it was written — the document, at that passage. */
  openThread: (thread: CommentThread) => void;
  /** True while a write is in flight — shown once, not per box. */
  saving: boolean;
};

/** One comment thread, as the analysis column reads it. */
export type CommentThread = {
  anchorId: string;
  documentId: string;
  /** The document's title, for a thread from another interview. */
  documentTitle: string;
  notes: Array<{
    id: string;
    text: string;
    author: string | null;
    createdAt: string;
  }>;
};

/** How long after the last keystroke the note is written. */
const SAVE_DEBOUNCE_MS = 900;

/** The separator `analysisKey` uses; a facet set round-trips through it. */
const SEPARATOR = "|";

export function AnalysisBox({
  groupKey,
  group,
  analysis,
}: {
  groupKey: string;
  group: GroupAnalysis;
  analysis: ExcerptAnalysis;
}) {
  const t = useTranslations("codebook.analysis");
  const stored = group.own?.body ?? "";
  const [draft, setDraft] = React.useState(stored);

  /**
   * Adopt the stored text when it changes UNDER the box — a different group
   * scrolled into this slot, or the study reloaded. Compared against what was last
   * seen rather than against the draft, or every keystroke would be undone by the
   * value it is diverging from.
   */
  const [seen, setSeen] = React.useState(stored);
  if (seen !== stored) {
    setSeen(stored);
    setDraft(stored);
  }

  // The facets as a string, because the array is rebuilt on every render and a
  // debounce keyed on its identity would restart forever and never fire.
  const facetKey = group.facets.join(SEPARATOR);
  const facetsOf = (key: string) => (key ? key.split(SEPARATOR) : []);

  /**
   * Held in a ref, refreshed after each render: `analysis` closes over a mutation
   * and so has a new identity every time, and depending on it below would restart
   * the debounce on every render of the page rather than on every keystroke.
   */
  const ownId = group.own?.id ?? null;
  const write = React.useRef(analysis.save);
  React.useEffect(() => {
    write.current = analysis.save;
  });

  React.useEffect(() => {
    if (draft === stored) return;
    const timer = setTimeout(
      () => write.current(facetsOf(facetKey), draft, ownId),
      SAVE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, stored, facetKey, ownId]);

  /**
   * Grow to the text.
   *
   * Measured rather than computed: line height, wrapping and the font are the
   * browser's business, and `scrollHeight` after a reset to `auto` is the only
   * thing that knows all three. Reset first, or the box can grow but never
   * shrink back when text is deleted.
   */
  const textarea = React.useRef<HTMLTextAreaElement | null>(null);
  React.useLayoutEffect(() => {
    const node = textarea.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [draft]);

  // Leaving the box writes now rather than in most of a second: a researcher who
  // clicks away and navigates would otherwise lose the last thing they typed.
  const flush = () => {
    if (draft === stored) return;
    analysis.save(facetsOf(facetKey), draft, ownId);
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={textarea}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={flush}
        placeholder={t("placeholder")}
        aria-label={t("title")}
        rows={2}
        // No frame and no scrollbar: this is a column of the table, not a form
        // field dropped into it, and an analysis is read at the same time as the
        // passages beside it — a box that scrolls its own middle third hides
        // exactly the sentence you are checking against them. It grows instead.
        className={cn(
          "w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-sm",
          "placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:outline-none",
        )}
      />

      {group.others.length > 0 && (
        <div className="space-y-2">
          {/* The other half of what folding analyses into comments bought: a slice
              is a thread, so two researchers reading the same question see each
              other instead of each writing into a box only they can see. */}
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("others")}
          </p>
          {group.others.map((note) => (
            <div key={note.id} className="rounded-md border p-2">
              {note.author && (
                <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                  {note.author}
                </p>
              )}
              <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                {note.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {group.narrower.length > 0 && (
        <div className="space-y-2">
          {/* Not editable here. Each of these belongs to a narrower question, and
              a box that silently rewrote it under a wider heading would move a
              researcher's own note somewhere they did not put it. */}
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {t("narrower")}
          </p>
          {group.narrower.map(({ analysis: note, extra }) => (
            <div
              key={note.id}
              className="rounded-md border border-dashed bg-muted/30 p-2"
            >
              <p className="mb-1 flex flex-wrap gap-1">
                {extra.map((facet) => (
                  <span
                    key={facet}
                    className="rounded-full border px-1.5 text-[10px] leading-4 text-muted-foreground"
                  >
                    {analysis.describe(facet)}
                  </span>
                ))}
              </p>
              <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                {note.body}
              </p>
            </div>
          ))}
        </div>
      )}

      <GroupComments groupKey={groupKey} analysis={analysis} />
    </div>
  );
}

/**
 * The comments written inside this group's passages.
 *
 * Most of the small readings in a study are made WHILE coding, in the margin of
 * the transcript, not afterwards in an analysis box — so a column that showed
 * only the notes written in it was showing the smaller half of the thinking.
 * These are the other half, gathered from the passages the group holds.
 *
 * Read-only, and beside the group's own note rather than merged into it: a
 * comment is attached to one passage and says something about that sentence,
 * while an analysis is about the slice. Folding the first into the second would
 * lose which passage a remark was about — which is usually the point of it. The
 * thread opens where it was written instead.
 */
function GroupComments({
  groupKey,
  analysis,
}: {
  groupKey: string;
  analysis: ExcerptAnalysis;
}) {
  const t = useTranslations("codebook.analysis");
  const threads = analysis.commentsOf(groupKey);
  if (threads.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        <MessageSquareIcon className="size-3" />
        {t("fromCoding", { count: threads.length })}
      </p>
      {threads.map((thread) => (
        <button
          key={thread.anchorId}
          type="button"
          onClick={() => analysis.openThread(thread)}
          className="w-full rounded-md border border-dashed p-2 text-left transition-colors hover:bg-accent/50"
        >
          {thread.notes.map((note) => (
            <p key={note.id} className="text-xs whitespace-pre-wrap">
              {note.author && (
                <span className="mr-1 font-medium text-muted-foreground">
                  {note.author}
                </span>
              )}
              <span className="text-muted-foreground">{note.text}</span>
            </p>
          ))}
          {/* Said only when it is not the obvious one: on a document-scoped
              table every thread comes from the same interview. */}
          {thread.documentTitle && (
            <p className="mt-1 truncate text-[10px] text-muted-foreground/70">
              {thread.documentTitle}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}
