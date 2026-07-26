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
import { Bell, BellOff, MessageSquare } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorAPI } from "../api";
import { useCommentPositions } from "../hooks/use-comment-positions";
import {
  excerptText,
  getCommentRanges,
  selectCommentRange,
} from "../utils/comment-actions";
import { formatRelativeDate } from "@/lib/utils/relative-date";
import { layoutRail } from "../utils/comment-rail-layout";
import { CommentComposer } from "./comment-composer";
import { CommentText } from "./comment-text";

const RAIL_WIDTH = 288;

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
    // Collapsed: one dot per commented line (several threads can share a line).
    const lines = new Map<number, { top: number; anchorIds: string[] }>();
    for (const pos of positions) {
      const line = Math.round(pos.top / 4) * 4;
      const entry = lines.get(line);
      if (entry) entry.anchorIds.push(pos.anchorId);
      else lines.set(line, { top: pos.top, anchorIds: [pos.anchorId] });
    }

    return (
      <div className="relative w-6 shrink-0">
        {Array.from(lines.values()).map((line) => (
          <button
            key={line.anchorIds[0]}
            type="button"
            data-comment-gutter=""
            title={t("comments.indicator")}
            aria-label={t("comments.indicator")}
            onClick={() => onOpenThread(line.anchorIds[0])}
            className="absolute left-0 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400/25 text-yellow-700 transition-colors hover:bg-yellow-400/40 dark:text-yellow-500"
            style={{ top: line.top }}
          >
            <MessageSquare className="h-3 w-3" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="relative shrink-0"
      style={{ width: RAIL_WIDTH }}
      data-comment-rail=""
    >
      {/* No header here on purpose: cards are positioned from the top of this column so
          they line up with the text, and anything in normal flow would sit under them.
          The rail is closed from the toolbar toggle or with Escape. */}
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
          />
        </div>
      ))}
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
      className={`bg-card cursor-default rounded-lg border p-2.5 transition-shadow ${
        active ? "border-yellow-400/70 shadow-sm" : "hover:border-foreground/20"
      }`}
    >
      <div className="mb-1.5 flex items-start gap-1">
        {quote && (
          <p className="text-muted-foreground min-w-0 flex-1 border-l-2 border-yellow-400/70 pl-2 text-[11px] leading-snug italic">
            {excerptText(quote, 52)}
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
              <Bell className="h-3 w-3" />
            ) : (
              <BellOff className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      {notes.map((c) => {
        const isMine = c.userId === profile?.id;
        return (
          <div key={c.id} className="mt-1.5 first:mt-0">
            <div className="flex items-center gap-1.5">
              <UserAvatar
                size="sm"
                user={{
                  name: c.author?.name ?? null,
                  email: c.author?.email ?? null,
                }}
              />
              <span className="truncate text-xs font-medium">
                {isMine
                  ? t("comments.you")
                  : c.author?.name || c.author?.email || ""}
              </span>
              <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
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
                  className="text-muted-foreground hover:text-foreground text-[10px]"
                  onClick={() => {
                    setEditingId(c.id);
                    setEditingText(c.text);
                  }}
                >
                  {t("comments.edit")}
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-destructive text-[10px]"
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
