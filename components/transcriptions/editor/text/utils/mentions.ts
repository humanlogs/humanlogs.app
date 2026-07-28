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

/** A mention's two halves: who it points at, and the name shown for them. */
export interface MentionRef {
  userId: string;
  label: string;
}

/** Strip the delimiters so a name can never break the encoding. */
export function sanitizeMentionLabel(label: string): string {
  return label.replace(/[[\]()]/g, "").trim() || "user";
}

/** Serialize a mention for insertion into the raw note text. */
export function encodeMention(userId: string, label: string): string {
  return `@[${sanitizeMentionLabel(label)}](${userId})`;
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

/**
 * Raw note text → what the composer shows, plus the mentions it carries.
 *
 * The stored form (`@[Ada Lovelace](usr_123)`) is an implementation detail: it must
 * never reach the textarea, where it reads as broken markup. The composer edits the
 * display form and {@link encodeMentions} puts the tokens back.
 */
export function decodeMentions(text: string): {
  display: string;
  mentions: MentionRef[];
} {
  let display = "";
  const mentions: MentionRef[] = [];
  for (const part of parseMentions(text)) {
    if (part.type === "text") {
      display += part.text;
      continue;
    }
    display += `@${part.label}`;
    if (!mentions.some((m) => m.userId === part.userId && m.label === part.label)) {
      mentions.push({ userId: part.userId, label: part.label });
    }
  }
  return { display, mentions };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Composer text → raw note text: every `@Label` that matches a known mention becomes a
 * token again. Longest label first, so "@Ada Lovelace" is never truncated to "@Ada",
 * and only on a name boundary, so "@Adam" doesn't match a mention of "Ada".
 */
export function encodeMentions(display: string, mentions: MentionRef[]): string {
  if (mentions.length === 0) return display;
  const byLength = [...mentions].sort((a, b) => b.label.length - a.label.length);
  const pattern = new RegExp(
    `@(${byLength.map((m) => escapeRegExp(m.label)).join("|")})(?![\\p{L}\\p{N}_-])`,
    "gu",
  );
  return display.replace(pattern, (match, label: string) => {
    const ref = byLength.find((m) => m.label === label);
    return ref ? encodeMention(ref.userId, ref.label) : match;
  });
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
