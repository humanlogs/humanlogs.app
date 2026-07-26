"use client";

import { parseMentions } from "../utils/mentions";

/**
 * A note's body, with `@[Name](userId)` tokens rendered as chips. The current user's
 * own mentions are emphasised so being addressed is noticeable at a glance.
 */
export function CommentText({
  text,
  currentUserId,
}: {
  text: string;
  currentUserId?: string;
}) {
  const parts = parseMentions(text);

  return (
    <p className="text-foreground/90 mt-0.5 text-xs leading-snug break-words whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.type === "text" ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span
            key={i}
            className={`rounded px-1 py-px font-medium ${
              part.userId === currentUserId
                ? "bg-yellow-300/60 text-foreground dark:bg-yellow-500/40"
                : "text-blue-600 dark:text-blue-400"
            }`}
          >
            @{part.label}
          </span>
        ),
      )}
    </p>
  );
}
