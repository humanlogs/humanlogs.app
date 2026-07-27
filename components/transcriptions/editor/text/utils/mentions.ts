/**
 * Mentions inside a comment body.
 *
 * A mention is stored inline in the note text as `@[Display Name](userId)`, so it
 * travels inside the AES-GCM payload like the rest of the note — the server never sees
 * who was mentioned. The trade-off is that server-side notifications are not possible
 * without leaking that metadata; mentions are rendered client-side only.
 */

export type MentionPart =
  | { type: "text"; text: string }
  | { type: "mention"; userId: string; label: string };

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g;

/** Serialize a mention for insertion into the raw note text. */
export function encodeMention(userId: string, label: string): string {
  // Strip the delimiters so a name can never break the encoding.
  const safe = label.replace(/[[\]()]/g, "").trim() || "user";
  return `@[${safe}](${userId})`;
}

/** Split raw note text into plain runs and mentions, for rendering. */
export function parseMentions(text: string): MentionPart[] {
  const parts: MentionPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION_RE)) {
    const index = m.index ?? 0;
    if (index > last) {
      parts.push({ type: "text", text: text.slice(last, index) });
    }
    parts.push({ type: "mention", label: m[1], userId: m[2] });
    last = index + m[0].length;
  }
  if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
  return parts;
}

/** User ids mentioned in a note. */
export function mentionedUserIds(text: string): string[] {
  return Array.from(new Set([...text.matchAll(MENTION_RE)].map((m) => m[2])));
}

/**
 * The active `@query` immediately before the caret, if the user is typing a mention.
 * Returns the query and the range to replace when a suggestion is picked.
 */
export function activeMentionQuery(
  text: string,
  caret: number,
): { query: string; from: number; to: number } | null {
  const before = text.slice(0, caret);
  // "@" must start the text or follow whitespace, and carry no whitespace after it.
  const match = /(^|\s)@([^\s@[\]()]*)$/.exec(before);
  if (!match) return null;
  const query = match[2];
  return { query, from: caret - query.length - 1, to: caret };
}
