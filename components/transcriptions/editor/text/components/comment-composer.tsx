"use client";

import { useTranslations } from "@/components/locale-provider";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { Participant } from "@/hooks/use-comments";
import { getUserColor } from "@/lib/utils/utils";
import { useEffect, useRef, useState } from "react";
import {
  activeMentionQuery,
  decodeMentions,
  encodeMentions,
  sanitizeMentionLabel,
} from "../utils/mentions";

interface CommentComposerProps {
  /** Raw note text, mentions included as tokens. */
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  participants: Participant[];
  placeholder: string;
  submitLabel: string;
  pending?: boolean;
  autoFocus?: boolean;
}

const displayName = (p: Participant) => p.name || p.email;

/**
 * Comment input: a borderless field that grows with the text and only reveals its
 * actions once there is something to send, so a card at rest stays quiet. Typing "@"
 * opens a picker of everyone with access; the choice is inserted as a mention token
 * (see utils/mentions.ts) which stays inside the encrypted body.
 *
 * The field edits the *display* form (`@Ada Lovelace`) and encodes back to tokens on
 * every change — the stored `@[Ada Lovelace](usr_123)` never shows up as you type.
 */
export function CommentComposer({
  value,
  onChange,
  onSubmit,
  onCancel,
  participants,
  placeholder,
  submitLabel,
  pending,
  autoFocus,
}: CommentComposerProps) {
  const t = useTranslations("editor");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [focused, setFocused] = useState(false);
  // Start offset of a mention the user dismissed with Escape, so it stays closed until
  // they begin a different one.
  const [dismissedFrom, setDismissedFrom] = useState<number | null>(null);

  // What the user sees and edits, and the mentions already committed to the note.
  const { display, mentions } = decodeMentions(value);
  const emit = (nextDisplay: string, refs = mentions) =>
    onChange(encodeMentions(nextDisplay, refs));

  const mention = activeMentionQuery(display, caret);
  const suggestions =
    mention && mention.from !== dismissedFrom
      ? participants
          .filter((p) =>
            displayName(p).toLowerCase().includes(mention.query.toLowerCase()),
          )
          .slice(0, 6)
      : [];
  const pickerOpen = suggestions.length > 0;

  // Grow the field to fit its content instead of scrolling inside a fixed box.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [display]);

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => textareaRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, [autoFocus]);

  const insertMention = (p: Participant) => {
    if (!mention) return;
    const label = sanitizeMentionLabel(displayName(p));
    const next = `${display.slice(0, mention.from)}@${label} ${display.slice(mention.to)}`;
    emit(next, [...mentions, { userId: p.id, label }]);
    const nextCaret = mention.from + label.length + 2; // "@" + label + trailing space
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
    setHighlighted(0);
  };

  const syncCaret = () => setCaret(textareaRef.current?.selectionStart ?? 0);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (pickerOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[Math.min(highlighted, suggestions.length - 1)]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDismissedFrom(mention?.from ?? null);
        return;
      }
    }

    // Send on Shift+Enter (and still on Cmd/Ctrl+Enter); plain Enter keeps making a
    // new line, which is what a multi-line note needs.
    if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === "Escape" && onCancel) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const showActions = focused || display.trim().length > 0;

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={display}
        rows={1}
        placeholder={placeholder}
        onChange={(e) => {
          emit(e.target.value);
          setCaret(e.target.selectionStart);
          setHighlighted(0);
        }}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        className="placeholder:text-muted-foreground w-full resize-none bg-transparent text-sm leading-normal outline-hidden"
      />

      {pickerOpen && (
        <div className="bg-popover absolute top-full right-0 z-10 mt-1 w-full overflow-hidden rounded-lg border p-1 shadow-md">
          {suggestions.map((p, i) => (
            <button
              key={p.id}
              type="button"
              // The field must keep focus, so act on mousedown and swallow the blur.
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(p);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm ${
                i === highlighted ? "bg-muted text-foreground" : ""
              }`}
            >
              <UserAvatar
                size="sm"
                user={{ name: p.name, email: p.email, picture: p.picture }}
              />
              <span className="min-w-0 flex-1 truncate">{displayName(p)}</span>
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: getUserColor(p.id) }}
              />
            </button>
          ))}
        </div>
      )}

      {showActions && (
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <span className="text-muted-foreground mr-auto text-[11px]">
            {t("comments.mentionHint")}
          </span>
          {onCancel && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onCancel}
            >
              {t("comments.cancel")}
            </button>
          )}
          <button
            type="button"
            disabled={!display.trim() || pending}
            title={t("comments.submitHint")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSubmit}
            className="text-xs font-medium text-yellow-700 disabled:opacity-40 dark:text-yellow-500"
          >
            {submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
