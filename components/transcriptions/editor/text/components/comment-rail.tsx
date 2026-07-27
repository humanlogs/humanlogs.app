"use client";

import { useLocale, useTranslations } from "@/components/locale-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useUserProfile } from "@/hooks/use-api";
import {
  DecryptedComment,
  useAddComment,
  useComments,
  useDeleteComment,
  useEditComment,
  useThreadSubscriptions,
  useToggleThreadSubscription,
  useTranscriptionParticipants,
} from "@/hooks/use-comments";
import {
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  X,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EditorAPI } from "../api";
import { useCommentPositions } from "../hooks/use-comment-positions";
import {
  excerptText,
  getCommentRanges,
  selectCommentRange,
} from "../utils/comment-actions";
import { formatRelativeDate } from "@/lib/utils/relative-date";
import {
  computeRailJump,
  layoutRail,
  type RailMarker,
} from "../utils/comment-rail-layout";
import { CommentComposer } from "./comment-composer";
import { CommentText } from "./comment-text";

const RAIL_WIDTH = 320;

interface CommentRailProps {
  transcriptionId: string;
  editorAPI: EditorAPI;
  canWrite: boolean;
  /** Rail visible? When closed only the slim indicator column is shown. */
  open: boolean;
  activeAnchorId: string | null;
  onOpenThread: (anchorId: string) => void;
  /** Thread the pointer is over, so the transcript can emphasise its highlight. */
  onHoverThread: (anchorId: string | null) => void;
  onCloseRail: () => void;
  onSaved: () => void;
  onEmptied: (anchorId: string) => void;
  /** A new thread was abandoned with an empty composer — drop its anchor. */
  onCancelPending: () => void;
}


/**
 * The comment rail: one card per thread, each sitting level with the text it annotates.
 *
 * Cards are laid out by {@link layoutRail}, which pushes them apart so they never
 * overlap — as the document scrolls the whole rail moves with it (it is an ordinary
 * column in the editor row, like the speaker column), so cards visibly stack up against
 * each other. The rail takes real width, so unlike a floating panel it never covers the
 * transcript.
 *
 * Closed, it collapses to a slim column of dots — one per commented line — so the
 * default reading view stays quiet.
 */
export function CommentRail({
  transcriptionId,
  editorAPI,
  canWrite,
  open,
  activeAnchorId,
  onOpenThread,
  onHoverThread,
  onCloseRail,
  onSaved,
  onEmptied,
  onCancelPending,
}: CommentRailProps) {
  const t = useTranslations("editor");
  const { positions } = useCommentPositions(editorAPI);
  const { data: comments } = useComments(transcriptionId);

  // Measured card heights, needed to push cards apart.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  // Threads present in the document, in anchor order.
  const anchors = positions.map((p) => ({
    anchorId: p.anchorId,
    anchorTop: p.top,
  }));

  // Re-measure when the set of cards changes (and whenever a card resizes, e.g. a
  // composer opening). Keyed on the anchor list so the observer isn't rebuilt on every
  // render; `setHeights` no-ops when nothing moved, so this settles in one pass.
  const anchorKey = anchors.map((a) => a.anchorId).join("|");
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      setHeights((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [id, el] of cardRefs.current) {
          const h = el.offsetHeight;
          if (next[id] !== h) {
            next[id] = h;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of cardRefs.current.values()) ro.observe(el);
    return () => ro.disconnect();
  }, [open, anchorKey]);

  const tops = layoutRail(
    anchors.map((a) => ({ ...a, height: heights[a.anchorId] ?? 96 })),
    activeAnchorId,
  );

  // Where the cards actually land, so the jump arrows reason about what is drawn
  // rather than about the anchors they were pushed away from.
  const railRef = useRef<HTMLDivElement | null>(null);
  // Empty while collapsed: the column below isn't mounted, so there is nothing to
  // measure and no reason to hold scroll listeners (the gutter runs its own).
  const { pins, scrollTo } = useRailPins(
    railRef,
    open
      ? anchors.map((a) => ({
          top: tops.get(a.anchorId) ?? a.anchorTop,
          height: heights[a.anchorId] ?? 96,
        }))
      : [],
  );

  // Escape collapses the rail (the composer swallows it first when editing a note).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRail();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCloseRail]);

  if (!open) {
    return (
      <CommentGutter positions={positions} onOpenThread={onOpenThread} />
    );
  }

  return (
    <div
      ref={railRef}
      className="group/rail relative shrink-0"
      style={{ width: RAIL_WIDTH }}
      data-comment-rail=""
    >
      {/* Cards are positioned from the top of this column so they line up with the text,
          so anything in normal flow would sit under them — hence a floating close
          control rather than a header. It is `fixed` and not `absolute`: pinned to the
          top of the column it scrolled out of view with the document, leaving no
          visible way back. Dimmed at rest so it does not compete with the notes, full
          strength on hover. Escape closes the rail too. */}
      <RailPortal pins={pins}>
        <button
          type="button"
          onClick={onCloseRail}
          title={t("comments.hide")}
          aria-label={t("comments.hide")}
          className={`${PIN_CLASS} text-muted-foreground hover:text-foreground h-6 w-6 opacity-60 hover:opacity-100 focus-visible:opacity-100`}
          style={{ left: pins.right - PIN_SIZE, top: pins.top }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </RailPortal>

      <RailJumpArrows pins={pins} scrollTo={scrollTo} />

      {anchors.map((anchor) => (
        <div
          key={anchor.anchorId}
          ref={(el) => {
            if (el) cardRefs.current.set(anchor.anchorId, el);
            else cardRefs.current.delete(anchor.anchorId);
          }}
          className="absolute left-0 w-full transition-[top] duration-150 ease-out"
          style={{ top: tops.get(anchor.anchorId) ?? anchor.anchorTop }}
        >
          <CommentCard
            transcriptionId={transcriptionId}
            editorAPI={editorAPI}
            anchorId={anchor.anchorId}
            notes={(comments ?? [])
              .filter((c) => c.anchorId === anchor.anchorId)
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))}
            active={anchor.anchorId === activeAnchorId}
            canWrite={canWrite}
            onOpenThread={onOpenThread}
            onHover={onHoverThread}
            onSaved={onSaved}
            onEmptied={onEmptied}
            onCancelPending={onCancelPending}
          />
        </div>
      ))}
    </div>
  );
}

/** Clearance from the edges of the scroll viewport. */
const BAND_PADDING = 8;
/** Comment chip / jump arrow (h-5 w-5) and the close button (h-6 w-6). */
const CHIP_SIZE = 20;
const PIN_SIZE = 24;

/**
 * The comment chip: soft yellow disc, amber glyph. Shared by the gutter dots and the
 * jump arrows so the two always read as the same object and cannot drift apart.
 */
const CHIP_CLASS =
  "flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400/25 text-yellow-700 transition-colors hover:bg-yellow-400/40 dark:text-yellow-500";

/**
 * The element that actually scrolls the transcript.
 *
 * NOT the window: the app shell puts every page inside a ScrollArea viewport
 * (app/app/(app)/layout.tsx), so `window` never fires `scroll` and `window.scrollTo`
 * does nothing here. Found by walking up rather than by selector, so the rail keeps
 * working if the shell changes.
 */
function findScroller(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** The slice of the viewport where a rail item actually reads as "on screen". */
function visibleBand(scroller: HTMLElement | null): {
  top: number;
  bottom: number;
} {
  if (scroller) {
    const rect = scroller.getBoundingClientRect();
    return { top: rect.top + BAND_PADDING, bottom: rect.bottom - BAND_PADDING };
  }
  const headerHeight =
    document.querySelector("header")?.getBoundingClientRect().height ?? 0;
  return {
    top: headerHeight + BAND_PADDING,
    bottom: window.innerHeight - BAND_PADDING,
  };
}

interface RailPins {
  /** False until the column has been measured — nothing may be placed before that. */
  measured: boolean;
  /** Viewport x of the column's centre and right edge, for the pinned controls. */
  centre: number;
  right: number;
  /** Viewport y of the top and bottom of the scrolling area. */
  top: number;
  bottom: number;
  /** Scroll targets for the arrows, or null when nothing lies that way. */
  up: number | null;
  down: number | null;
}

const NO_PINS: RailPins = {
  measured: false,
  centre: 0,
  right: 0,
  top: 0,
  bottom: 0,
  up: null,
  down: null,
};
const samePins = (a: RailPins, b: RailPins) =>
  a.measured === b.measured &&
  a.centre === b.centre &&
  a.right === b.right &&
  a.top === b.top &&
  a.bottom === b.bottom &&
  a.up === b.up &&
  a.down === b.down;

/**
 * Viewport coordinates for the rail's pinned controls, plus a scroller-aware jump.
 *
 * The rail scrolls away with the document, so its controls have to leave the flow to
 * stay reachable. `sticky` is out (the rail's ancestors are `overflow-hidden`, which
 * would capture it into a container that never scrolls) and plain `fixed` is not enough
 * either: `.route-transition` declares `will-change: transform`, which makes it the
 * containing block for fixed descendants — they end up scrolling with the page just
 * like an absolute element. Hence measured coordinates plus a portal to `document.body`
 * at the call site.
 */
function useRailPins(
  columnRef: React.RefObject<HTMLDivElement | null>,
  markers: RailMarker[],
): { pins: RailPins; scrollTo: (y: number) => void } {
  const [pins, setPins] = useState<RailPins>(NO_PINS);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const markerKey = markers
    .map((m) => `${Math.round(m.top)}:${Math.round(m.height)}`)
    .join("|");

  useEffect(() => {
    let raf: number | null = null;
    let bound: HTMLElement | null = null;

    const measure = () => {
      raf = null;
      const el = columnRef.current;
      // Not mounted (the other rail state is showing) — nothing to place.
      if (!el) return;
      if (!scrollerRef.current) scrollerRef.current = findScroller(el);
      const scroller = scrollerRef.current;

      // Bind to the real scroller as soon as it is known; `window` never fires here.
      if (scroller && scroller !== bound) {
        bound?.removeEventListener("scroll", schedule);
        scroller.addEventListener("scroll", schedule, { passive: true });
        bound = scroller;
      }

      const rect = el.getBoundingClientRect();
      const band = visibleBand(scroller);
      const scrolled = scroller ? scroller.scrollTop : window.scrollY;
      // Measure even with no markers: the close button is placed from these
      // coordinates, and an empty rail still has to be closable.
      const { up, down } = markers.length
        ? computeRailJump(markers, rect.top, band, scrolled)
        : { up: null, down: null };

      const next: RailPins = {
        measured: true,
        centre: rect.left + rect.width / 2,
        right: rect.right,
        top: band.top,
        bottom: band.bottom,
        up,
        down,
      };
      setPins((prev) => (samePins(prev, next) ? prev : next));
    };

    const schedule = () => {
      if (raf === null) raf = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      bound?.removeEventListener("scroll", schedule);
      scrollerRef.current = null;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    // `markers` is rebuilt every render; its content is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markerKey, columnRef]);

  const scrollTo = (y: number) => {
    const top = Math.max(0, y);
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTo({ top, behavior: "smooth" });
    else window.scrollTo({ top, behavior: "smooth" });
  };

  return { pins, scrollTo };
}

const PIN_CLASS =
  "fixed z-30 flex items-center justify-center rounded-full border bg-background/90 shadow-sm backdrop-blur transition-colors";

/**
 * Pinned rail controls, rendered on `document.body`.
 *
 * The portal is load-bearing, not tidiness: `position: fixed` inside the editor is
 * captured by `.route-transition`'s `will-change: transform`, which would make these
 * scroll away with the content — the very thing they exist to avoid.
 */
function RailPortal({
  pins,
  children,
}: {
  pins: RailPins;
  children: React.ReactNode;
}) {
  if (!pins.measured || typeof document === "undefined") return null;
  return createPortal(<>{children}</>, document.body);
}

/**
 * Arrows to the nearest comment above and below.
 *
 * Each side shows whenever something is hidden that way — including while other
 * comments are on screen — so the rail always says whether there is more, and where.
 * Rail items sit level with the text they annotate, so without this the column simply
 * looks empty and the reader cannot tell an unannotated stretch from the end of the
 * thread list.
 */
function RailJumpArrows({
  pins,
  scrollTo,
}: {
  pins: RailPins;
  scrollTo: (y: number) => void;
}) {
  const t = useTranslations("editor");
  const left = pins.centre - CHIP_SIZE / 2;
  const arrow = `fixed z-30 ${CHIP_CLASS}`;

  return (
    <RailPortal pins={pins}>
      {pins.up !== null && (
        <button
          type="button"
          title={t("comments.jumpUp")}
          aria-label={t("comments.jumpUp")}
          onClick={() => scrollTo(pins.up as number)}
          className={arrow}
          style={{ left, top: pins.top }}
        >
          <ChevronUp className="h-3 w-3" />
        </button>
      )}
      {pins.down !== null && (
        <button
          type="button"
          title={t("comments.jumpDown")}
          aria-label={t("comments.jumpDown")}
          onClick={() => scrollTo(pins.down as number)}
          className={arrow}
          style={{ left, top: pins.bottom - CHIP_SIZE }}
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      )}
    </RailPortal>
  );
}

/** Collapsed rail: one dot per commented line, plus the off-screen jump arrows. */
function CommentGutter({
  positions,
  onOpenThread,
}: {
  positions: Array<{ anchorId: string; top: number }>;
  onOpenThread: (anchorId: string) => void;
}) {
  const t = useTranslations("editor");
  const columnRef = useRef<HTMLDivElement | null>(null);

  // One dot per line — several threads can be anchored on the same one.
  const lines = new Map<number, { top: number; anchorIds: string[] }>();
  for (const pos of positions) {
    const line = Math.round(pos.top / 4) * 4;
    const entry = lines.get(line);
    if (entry) entry.anchorIds.push(pos.anchorId);
    else lines.set(line, { top: pos.top, anchorIds: [pos.anchorId] });
  }
  const dots = Array.from(lines.values());
  const { pins, scrollTo } = useRailPins(
    columnRef,
    dots.map((d) => ({ top: d.top, height: 20 })),
  );

  return (
    <div ref={columnRef} className="relative w-6 shrink-0">
      {dots.map((line) => (
        <button
          key={line.anchorIds[0]}
          type="button"
          data-comment-gutter=""
          title={t("comments.indicator")}
          aria-label={t("comments.indicator")}
          onClick={() => onOpenThread(line.anchorIds[0])}
          className={`absolute left-0 ${CHIP_CLASS}`}
          style={{ top: line.top }}
        >
          <MessageSquare className="h-3 w-3" />
        </button>
      ))}
      <RailJumpArrows pins={pins} scrollTo={scrollTo} />
    </div>
  );
}

function CommentCard({
  transcriptionId,
  editorAPI,
  anchorId,
  notes,
  active,
  canWrite,
  onOpenThread,
  onHover,
  onSaved,
  onEmptied,
  onCancelPending,
}: {
  transcriptionId: string;
  editorAPI: EditorAPI;
  anchorId: string;
  notes: DecryptedComment[];
  active: boolean;
  canWrite: boolean;
  onOpenThread: (anchorId: string) => void;
  onHover: (anchorId: string | null) => void;
  onSaved: () => void;
  onEmptied: (anchorId: string) => void;
  onCancelPending: () => void;
}) {
  const t = useTranslations("editor");
  const { locale } = useLocale();
  const { data: profile } = useUserProfile();
  const { data: participants } = useTranscriptionParticipants(transcriptionId);
  const addComment = useAddComment(transcriptionId);
  const editComment = useEditComment(transcriptionId);
  const deleteComment = useDeleteComment(transcriptionId);
  const { data: subscriptions } = useThreadSubscriptions(transcriptionId);
  const toggleSubscription = useToggleThreadSubscription(transcriptionId);
  // Following is implicit once you take part: posting or being mentioned subscribes
  // you server-side. Until then the control reads as "not following".
  const subscribed = subscriptions?.[anchorId] ?? false;

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [quote, setQuote] = useState<string | null>(null);

  // The quoted phrase, refreshed as the document changes.
  useEffect(() => {
    const read = () => {
      const ed = editorAPI.getEditor();
      if (!ed) return;
      const range = getCommentRanges(ed).find((r) => r.anchorId === anchorId);
      setQuote(range ? range.text : null);
    };
    read();
    editorAPI.addListener("change", read);
    editorAPI.addListener("commentsChange", read);
    return () => {
      editorAPI.removeListener("change", read);
      editorAPI.removeListener("commentsChange", read);
    };
  }, [editorAPI, anchorId]);

  /**
   * A thread with no note yet has only ever been started, never written. If attention
   * moves anywhere outside the rail while its composer is still empty, it is abandoned
   * — otherwise the transcript keeps a highlight for a comment that does not exist.
   *
   * Gated on the draft being empty, so a half-typed note is never thrown away by a
   * stray click; the card stays and the text is still there to come back to.
   */
  const abandonable = notes.length === 0 && draft.trim().length === 0;
  useEffect(() => {
    if (!abandonable) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Anywhere inside the rail (this card, another card, the close button) is still
      // working on comments.
      if (target?.closest?.("[data-comment-rail]")) return;
      onCancelPending();
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [abandonable, onCancelPending]);

  const submitNew = async () => {
    const text = draft.trim();
    if (!text) return;
    await addComment.mutateAsync({ anchorId, text });
    setDraft("");
    onSaved();
  };

  const submitEdit = async (commentId: string) => {
    const text = editingText.trim();
    if (!text) return;
    await editComment.mutateAsync({ commentId, text });
    setEditingId(null);
  };

  const remove = async (c: DecryptedComment) => {
    const res = await deleteComment.mutateAsync({
      commentId: c.id,
      anchorId: c.anchorId,
    });
    if (res.threadEmpty) onEmptied(c.anchorId);
  };

  const focusThread = () => {
    onOpenThread(anchorId);
    const ed = editorAPI.getEditor();
    if (ed) selectCommentRange(ed, anchorId);
  };

  return (
    <div
      onClick={focusThread}
      // Cards drift below their anchor when comments are dense, so hovering one lights
      // up the text it belongs to — the link between the two without a connector line.
      onMouseEnter={() => onHover(anchorId)}
      onMouseLeave={() => onHover(null)}
      className={`bg-card cursor-default rounded-lg border p-3 transition-shadow ${
        active ? "border-yellow-400/70 shadow-sm" : "hover:border-foreground/20"
      }`}
    >
      <div className="mb-1.5 flex items-start gap-1">
        {quote && (
          <p className="text-muted-foreground min-w-0 flex-1 border-l-2 border-yellow-400/70 pl-2 text-xs leading-snug italic">
            {excerptText(quote, 60)}
          </p>
        )}
        {/* Follow/unfollow this thread. Only shown once the thread exists, since an
            unsaved one has nothing to follow yet. */}
        {notes.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSubscription.mutate({ anchorId, subscribed: !subscribed });
            }}
            title={
              subscribed ? t("comments.unsubscribe") : t("comments.subscribe")
            }
            aria-label={
              subscribed ? t("comments.unsubscribe") : t("comments.subscribe")
            }
            aria-pressed={subscribed}
            className={`shrink-0 rounded p-0.5 transition-colors ${
              subscribed
                ? "text-yellow-600 dark:text-yellow-500"
                : "text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            {subscribed ? (
              <Bell className="h-3.5 w-3.5" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {notes.map((c) => {
        const isMine = c.userId === profile?.id;
        return (
          <div key={c.id} className="mt-2.5 first:mt-0">
            <div className="flex items-center gap-1.5">
              <UserAvatar
                size="sm"
                user={{
                  name: c.author?.name ?? null,
                  email: c.author?.email ?? null,
                }}
              />
              <span className="truncate text-sm font-medium">
                {isMine
                  ? t("comments.you")
                  : c.author?.name || c.author?.email || ""}
              </span>
              <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
                {formatRelativeDate(c.createdAt, locale)}
              </span>
            </div>

            {editingId === c.id ? (
              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                <CommentComposer
                  value={editingText}
                  onChange={setEditingText}
                  onSubmit={() => submitEdit(c.id)}
                  onCancel={() => setEditingId(null)}
                  participants={participants ?? []}
                  placeholder={t("comments.placeholder")}
                  submitLabel={t("comments.save")}
                  pending={editComment.isPending}
                  autoFocus
                />
              </div>
            ) : (
              <CommentText text={c.text} currentUserId={profile?.id} />
            )}

            {isMine && editingId !== c.id && (
              <div className="mt-0.5 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditingText(c.text);
                  }}
                >
                  {t("comments.edit")}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive text-xs"
                  onClick={() => remove(c)}
                >
                  {t("comments.delete")}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {canWrite && (active || notes.length === 0) && (
        <div
          className="mt-2 border-t border-foreground/10 pt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <CommentComposer
            value={draft}
            onChange={setDraft}
            onSubmit={submitNew}
            participants={participants ?? []}
            placeholder={
              notes.length === 0
                ? t("comments.placeholder")
                : t("comments.replyPlaceholder")
            }
            submitLabel={t("comments.add")}
            pending={addComment.isPending}
            autoFocus={notes.length === 0}
          />
        </div>
      )}
    </div>
  );
}
