/**
 * Who is the same person, across the interviews of a study.
 *
 * A transcript's speaker id is a POSITION, not an identity: `speaker_1` of one
 * interview has nothing to do with `speaker_1` of the next, which is why every
 * speaker-shaped thing in the index is keyed on the (document, speaker) pair. That
 * is correct and it is also not what a researcher means. If Renée is interviewed
 * twice, "the passages of the people coded «cadre»" has to find both.
 *
 * The link is the NAME. Within one study a researcher never gives two different
 * people the same name — that is the working assumption this rests on, and it is
 * the researcher's own naming discipline rather than something the tool can check.
 * So two named speakers with the same normalized name are one person, and an
 * UNNAMED speaker is nobody but themselves: `speaker_2` of an unnamed roster cannot
 * be linked to anything, and guessing would silently merge strangers.
 *
 * Resolved out of the document list at query time rather than stored on the index
 * rows, for the same reason labels are: renaming a speaker in one interview should
 * re-link them everywhere on the next render, not after a reindex of the study.
 */

import type { CodeRef, SpeakerCodeRef } from "@/lib/codebooks/codebook";
import { codeRefKey, speakerKey } from "./phrase-query";

/**
 * The form two spellings of a name have to share to be one person.
 *
 * Case, surrounding punctuation, runs of whitespace and accents are all folded:
 * «Renée», «renee » and «RENÉE:» are one person, because they are one person and
 * the difference is typing. Returns null for anything that is not a name, which is
 * what keeps unnamed speakers separate.
 */
export function normalizeSpeakerName(
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  const folded = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return folded || null;
}

/** The document list, reduced to what identity needs. */
export type SpeakerRoster = {
  id: string;
  speakers: ReadonlyArray<{ id: string; name: string | null }>;
  /** Codes on the document as a whole. */
  codes?: CodeRef[] | null;
  /** Codes on the people in it. */
  speakerCodes?: SpeakerCodeRef[] | null;
};

export type SpeakerIdentity = {
  /** The person a (document, speaker) belongs to, as a stable key. */
  personOf: (documentId: string, speakerId: string | null) => string;
  /** Every (document, speaker) pair key that person speaks under. */
  pairsOf: (person: string) => readonly string[];
  /** How many interviews a person appears in — 1 for most, and for everyone unnamed. */
  documentCount: (person: string) => number;
};

/** A person key that cannot collide with a pair key, and reads in a debugger. */
function personKeyOf(normalized: string): string {
  return `name:${normalized}`;
}

export function buildSpeakerIdentity(
  documents: readonly SpeakerRoster[],
): SpeakerIdentity {
  const person = new Map<string, string>();
  const pairs = new Map<string, string[]>();
  const documentsOf = new Map<string, Set<string>>();

  for (const document of documents) {
    for (const speaker of document.speakers) {
      const pair = speakerKey(document.id, speaker.id);
      const normalized = normalizeSpeakerName(speaker.name);
      // An unnamed speaker is their own person: the pair key IS the identity.
      const key = normalized ? personKeyOf(normalized) : pair;
      person.set(pair, key);

      const bucket = pairs.get(key);
      if (bucket) bucket.push(pair);
      else pairs.set(key, [pair]);

      const seen = documentsOf.get(key);
      if (seen) seen.add(document.id);
      else documentsOf.set(key, new Set([document.id]));
    }
  }

  const NONE: readonly string[] = [];
  return {
    // A pair the roster does not know — a speaker who appears in the transcript
    // but not in the cached roster — falls back to being their own person, which
    // is what the index did before anyone was linked to anyone.
    personOf: (documentId, speakerId) => {
      const pair = speakerKey(documentId, speakerId);
      return person.get(pair) ?? pair;
    },
    pairsOf: (key) => pairs.get(key) ?? NONE,
    documentCount: (key) => documentsOf.get(key)?.size ?? 0,
  };
}

/**
 * Pair keys → person keys, as plain data.
 *
 * The grouping runs inside the streaming query, which must stay serializable so it
 * can be handed to a worker; a lookup object crosses that boundary and a closure
 * does not.
 */
export function speakerPersonMap(
  documents: readonly SpeakerRoster[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const document of documents) {
    for (const speaker of document.speakers) {
      const pair = speakerKey(document.id, speaker.id);
      const normalized = normalizeSpeakerName(speaker.name);
      if (normalized) map[pair] = personKeyOf(normalized);
    }
  }
  return map;
}

/**
 * The (document, speaker) pairs carrying any of `codes`, PERSON-WIDE.
 *
 * The difference with the per-document rule it replaces: a code put on Renée in the
 * interview where she was first read as «cadre» now selects her passages in every
 * interview of the study. That is what the researcher meant by coding a person —
 * the code is a claim about her, not about that one recording.
 *
 * A code put on the DOCUMENT still counts for every speaker in it, and does NOT
 * travel: it says something about that interview, not about the people in it
 * elsewhere.
 */
export function speakersMatchingCodesByPerson(
  documents: readonly SpeakerRoster[],
  codes: readonly CodeRef[],
  identity: SpeakerIdentity,
  speakerIdsOf: (documentId: string) => readonly string[],
): string[] {
  const keys = new Set<string>();
  const everySpeaker = (documentId: string) => {
    for (const speakerId of speakerIdsOf(documentId)) {
      keys.add(speakerKey(documentId, speakerId));
    }
  };

  if (codes.length === 0) {
    for (const document of documents) everySpeaker(document.id);
    return [...keys];
  }

  const wanted = new Set(codes.map(codeRefKey));
  for (const document of documents) {
    // A code on the interview counts for everyone speaking in it — and stops
    // there. "This interview is about the hospital" says nothing about where else
    // those people speak, so unlike a code on a person it does not travel.
    if ((document.codes ?? []).some((ref) => wanted.has(codeRefKey(ref)))) {
      everySpeaker(document.id);
    }
    for (const ref of document.speakerCodes ?? []) {
      if (!wanted.has(codeRefKey(ref))) continue;
      // Every pair this person speaks under, across the study.
      const person = identity.personOf(document.id, ref.speakerId);
      const pairs = identity.pairsOf(person);
      if (pairs.length > 0) for (const pair of pairs) keys.add(pair);
      else keys.add(speakerKey(document.id, ref.speakerId));
    }
  }
  return [...keys];
}
