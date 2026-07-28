/**
 * The speaker roster of a document, cached beside the transcript.
 *
 * The transcript content stays the source of truth — speakers live inside it,
 * with the words. But that content is one large blob, and end-to-end encrypted
 * for part of our users, so anything that only needs "who speaks in this
 * document" (the study coding board, a future filter, an overview) had to pull
 * and decrypt whole interviews to read a dozen names.
 *
 * `Transcription.speakers` is that roster, stored on its own: a plain array
 * when the document is not encrypted, and an `EncryptedDataEntity` — same
 * scheme, same accessors as the transcript itself — when it is. It is a
 * *cache*: it is rebuilt from the content on every write that can read the
 * content, and a client that finds it stale refreshes it. Nothing should ever
 * treat it as authoritative.
 *
 * This module holds no Prisma and no React, so the API routes, the browser
 * hooks and the tests all share one implementation.
 */

import {
  EncryptionUtils,
  type EncryptedDataEntity,
} from "@/lib/encryption/encryption-entities";

/** A speaker as the cache stores it: the id used by the transcript, and a name. */
export type SpeakerSummary = { id: string; name: string | null };

/** What the `speakers` column holds — readable, or encrypted like the content. */
export type SpeakerCache = SpeakerSummary[] | EncryptedDataEntity;

export function isEncryptedEntity(
  value: unknown,
): value is EncryptedDataEntity {
  return (
    !!value &&
    typeof value === "object" &&
    Array.isArray((value as EncryptedDataEntity).privateKeys) &&
    typeof (value as EncryptedDataEntity).payload === "string"
  );
}

/** Normalizes one speaker; an entry without a usable id is dropped. */
function toSummary(value: unknown): SpeakerSummary | null {
  if (!value || typeof value !== "object") return null;
  const { id, name } = value as { id?: unknown; name?: unknown };
  if (typeof id !== "string" || !id) return null;
  const trimmed = typeof name === "string" ? name.trim() : "";
  return { id, name: trimmed || null };
}

/** Reads a roster out of anything shaped like `{ speakers: [...] }`. */
export function parseSpeakers(value: unknown): SpeakerSummary[] | null {
  if (Array.isArray(value)) {
    return value
      .map(toSummary)
      .filter((speaker): speaker is SpeakerSummary => speaker !== null);
  }
  if (!value || typeof value !== "object") return null;
  const speakers = (value as { speakers?: unknown }).speakers;
  return Array.isArray(speakers) ? parseSpeakers(speakers) : null;
}

/**
 * The roster of a stored `speakers` column, or null when it is missing or
 * still encrypted — the caller decides whether to decrypt it or to do without.
 */
export function readSpeakerCache(value: unknown): SpeakerSummary[] | null {
  if (isEncryptedEntity(value)) return null;
  return parseSpeakers(value);
}

/**
 * Whether two rosters say the same thing. Order matters: it is the order the
 * transcript gives its speakers in, which is the one the UI shows.
 */
export function sameSpeakers(
  a: SpeakerSummary[] | null | undefined,
  b: SpeakerSummary[] | null | undefined,
): boolean {
  if (!a || !b) return !a && !b;
  return (
    a.length === b.length &&
    a.every(
      (speaker, index) =>
        speaker.id === b[index].id && speaker.name === b[index].name,
    )
  );
}

/**
 * The value to store, encrypted for exactly the accessors of `reference` (the
 * transcript entity) when that one is encrypted. Returns `undefined` when the
 * roster cannot be built safely — no readable content, or an encrypted document
 * with no crypto to hand — because writing plaintext names beside an encrypted
 * transcript would defeat the whole point.
 */
export async function encodeSpeakerCache(
  content: unknown,
  reference: unknown,
  utils: EncryptionUtils | null,
): Promise<SpeakerCache | undefined> {
  const speakers = parseSpeakers(content);
  if (!speakers) return undefined;
  if (!isEncryptedEntity(reference)) return speakers;
  if (!utils) return undefined;
  // The payload is `{ speakers }` rather than the bare array: the browser
  // decryption helper spreads what it returns, and an array would come back as
  // an object with numeric keys. `parseSpeakers` reads either shape.
  return (await utils.encrypt(reference, { speakers })) as EncryptedDataEntity;
}

/** One appearance of a person in the corpus: a speaker, inside a document. */
export type SpeakerOccurrence = {
  documentId: string;
  documentTitle: string;
  speakerId: string;
  /** Position in that document's roster — what names an unnamed speaker. */
  index: number;
};

/**
 * A person across the study. `named` groups gather every speaker sharing a
 * name; an unnamed speaker is a group of its own, since nothing identifies it
 * beyond the document it sits in.
 */
export type SpeakerGroup = {
  key: string;
  /** The spelling to show — the first one encountered, casing included. */
  name: string | null;
  named: boolean;
  occurrences: SpeakerOccurrence[];
};

/**
 * The matching key for a name: same person whatever the casing, the accents or
 * the spacing. Deliberately loose — a researcher typing "marie" in one document
 * and "Marie" in the next means the same person, and the cost of being wrong is
 * a code to remove, not lost data.
 */
export function speakerNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

/**
 * Groups the speakers of a study by name: one row per person rather than per
 * document, so coding "Marie" once covers every interview she appears in.
 *
 * Documents keep their own rosters in the database — this is a view over them,
 * and applying a code to a group means writing it on each occurrence.
 */
export function groupSpeakersByName(
  documents: Array<{
    id: string;
    title: string;
    speakers?: SpeakerSummary[] | null;
  }>,
): SpeakerGroup[] {
  const groups = new Map<string, SpeakerGroup>();

  for (const document of documents) {
    const roster = document.speakers ?? [];
    roster.forEach((speaker, index) => {
      const occurrence: SpeakerOccurrence = {
        documentId: document.id,
        documentTitle: document.title,
        speakerId: speaker.id,
        index,
      };
      const named = !!speaker.name;
      const key = named
        ? `name:${speakerNameKey(speaker.name!)}`
        : `speaker:${document.id}:${speaker.id}`;

      const existing = groups.get(key);
      if (existing) {
        existing.occurrences.push(occurrence);
      } else {
        groups.set(key, {
          key,
          name: speaker.name,
          named,
          occurrences: [occurrence],
        });
      }
    });
  }

  // Named people first, alphabetically; the unnamed ones trail in the order
  // their documents brought them.
  return Array.from(groups.values()).sort((a, b) => {
    if (a.named !== b.named) return a.named ? -1 : 1;
    if (!a.named || !b.named) return 0;
    return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

/**
 * Guards the `speakers` field of a transcription update. The client sends it
 * already encrypted for E2E documents, so an entity is taken as-is: like the
 * transcript itself, the server cannot check what is inside it.
 */
export function validateSpeakerCache(
  value: unknown,
): { speakers: SpeakerCache | null } | { error: string } {
  if (value === null) return { speakers: null };
  if (isEncryptedEntity(value)) return { speakers: value };
  const speakers = parseSpeakers(value);
  if (!speakers) return { error: "speakers must be an array of { id, name }" };
  return { speakers };
}
