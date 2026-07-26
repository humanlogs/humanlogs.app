"use client";

import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useUserProfile } from "@/hooks/use-api";
import {
  DecryptedComment,
  useAddComment,
  useComments,
  useDeleteComment,
  useEditComment,
} from "@/hooks/use-comments";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CommentPopoverProps {
  transcriptionId: string;
  /** Open thread anchor id, or null when closed. */
  anchorId: string | null;
  /** Live viewport rect of the anchored text, for positioning. */
  getAnchorRect: () => DOMRect | null;
  canWrite: boolean;
  /** Called when the popover should close. */
  onClose: () => void;
  /** Called after the first note is saved into a (possibly new) thread. */
  onSaved: () => void;
  /** Called after a thread's last note is deleted (anchor should be dropped). */
  onEmptied: (anchorId: string) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Thread contents. Kept as a separate component keyed by `anchorId` in the parent, so
 * switching threads remounts it — resetting the draft/edit state cleanly without any
 * render-phase state juggling.
 */
function CommentThreadContent({
  transcriptionId,
  anchorId,
  canWrite,
  onClose,
  onSaved,
  onEmptied,
}: {
  transcriptionId: string;
  anchorId: string;
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
  onEmptied: (anchorId: string) => void;
}) {
  const t = useTranslations("editor");
  const { data: profile } = useUserProfile();
  const { data: allComments } = useComments(transcriptionId);
  const addComment = useAddComment(transcriptionId);
  const editComment = useEditComment(transcriptionId);
  const deleteComment = useDeleteComment(transcriptionId);

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const thread: DecryptedComment[] = (allComments ?? []).filter(
    (c) => c.anchorId === anchorId,
  );

  // Focus the input on mount (pure side effect, no state update).
  useEffect(() => {
    const id = setTimeout(() => textareaRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);

  const submitNew = async () => {
    const text = draft.trim();
    if (!text) return;
    await addComment.mutateAsync({ anchorId, text });
    setDraft("");
    onSaved();
    setTimeout(() => textareaRef.current?.focus(), 30);
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

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="font-heading font-medium">{t("comments.title")}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={onClose}
          aria-label={t("comments.cancel")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto">
        {thread.length === 0 && (
          <p className="text-muted-foreground text-xs">{t("comments.empty")}</p>
        )}
        {thread.map((c) => {
          const isMine = c.userId === profile?.id;
          const displayName = isMine
            ? t("comments.you")
            : c.author?.name || c.author?.email || "";
          return (
            <div key={c.id} className="flex gap-2">
              <UserAvatar
                size="sm"
                user={{
                  name: c.author?.name ?? null,
                  email: c.author?.email ?? null,
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-medium">
                    {displayName}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[10px]">
                    {formatTime(c.createdAt)}
                  </span>
                </div>
                {editingId === c.id ? (
                  <div className="mt-1 flex flex-col gap-1">
                    <Textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="min-h-[3rem] text-xs"
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        {t("comments.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={editComment.isPending}
                        onClick={() => submitEdit(c.id)}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        {t("comments.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-xs">
                    {c.text}
                  </p>
                )}
                {isMine && editingId !== c.id && (
                  <div className="mt-0.5 flex gap-2">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground text-[10px]"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditingText(c.text);
                      }}
                    >
                      <Pencil className="mr-0.5 inline h-2.5 w-2.5" />
                      {t("comments.edit")}
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive text-[10px]"
                      onClick={() => remove(c)}
                    >
                      <Trash2 className="mr-0.5 inline h-2.5 w-2.5" />
                      {t("comments.delete")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {canWrite && (
        <div className="flex flex-col gap-1.5 border-t border-foreground/10 pt-2">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void submitNew();
              }
            }}
            placeholder={t("comments.placeholder")}
            className="min-h-[3.5rem] text-xs"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={!draft.trim() || addComment.isPending}
              onClick={() => void submitNew()}
            >
              {t("comments.add")}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function CommentPopover({
  transcriptionId,
  anchorId,
  getAnchorRect,
  canWrite,
  onClose,
  onSaved,
  onEmptied,
}: CommentPopoverProps) {
  const open = anchorId !== null;
  const anchorFn = () => ({
    getBoundingClientRect: () => getAnchorRect() ?? new DOMRect(0, 0, 0, 0),
  });

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchorFn}
          side="right"
          align="start"
          sideOffset={10}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup className="z-50 flex max-h-[70vh] w-80 flex-col gap-2 overflow-hidden rounded-lg bg-popover p-3 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden">
            {anchorId && (
              <CommentThreadContent
                key={anchorId}
                transcriptionId={transcriptionId}
                anchorId={anchorId}
                canWrite={canWrite}
                onClose={onClose}
                onSaved={onSaved}
                onEmptied={onEmptied}
              />
            )}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
