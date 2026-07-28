/**
 * Codebooks: named sets of codes used to tag documents.
 *
 * A codebook is attached to specific studies or to all of them, and can be
 * nested under a parent codebook to build sub-themes. Only its `content`
 * (`{ name, codes }`) is end-to-end encrypted, the same way `Comment.body` is:
 * the structure around it stays readable so the server can scope, cascade and
 * filter. Code ids are therefore **random uuids with no meaning** — that is what
 * lets `Transcription.codes` reference them in clear without telling the server
 * what a code says.
 *
 * This module is deliberately free of React and of `node:crypto` so API routes,
 * client hooks and tests can all import it.
 */

import type { EncryptedDataEntity } from "@/lib/encryption/encryption-entities";
import { isValidColor } from "@/lib/projects/appearance";

/**
 * What a codebook codes. Two kinds, because that is how the material divides:
 *
 *  - `speaker` — *who* is in the corpus. Its codes go on a document and on its
 *    speakers alike (role, group, profile): the interview as a whole is the
 *    coarsest speaker unit, so one codebook serves both rather than forcing a
 *    duplicate per level.
 *  - `verbatim` — *what is said*. Its codes go on a passage of the transcript,
 *    whatever its length: a sentence, a clause, a word. The unit is the
 *    researcher's selection, not a grammar rule, which is why the three grains
 *    that used to exist were one distinction too many.
 */
export const CODEBOOK_TARGETS = ["speaker", "verbatim"] as const;

export type CodebookTarget = (typeof CODEBOOK_TARGETS)[number];

export const DEFAULT_CODEBOOK_TARGET: CodebookTarget = "speaker";

/**
 * The targets whose codes land on a document, hence the only ones that can
 * group the document list. A verbatim codebook codes passages, so it groups
 * nothing until passage coding exists — every document would land in
 * "uncoded".
 */
export const GROUPABLE_CODEBOOK_TARGETS: CodebookTarget[] = ["speaker"];

/**
 * Reads a target stored before the two-way split — `document` and
 * `participant` both coded people or whole documents, the three text grains
 * all coded passages. Kept beyond the migration that rewrote them because a
 * codebook created by an older client (or restored from a backup) must still
 * open rather than fall back silently to the default.
 */
export function normalizeCodebookTarget(value: unknown): CodebookTarget {
  if (isCodebookTarget(value)) return value;
  switch (value) {
    case "document":
    case "participant":
      return "speaker";
    case "sentence":
    case "subsentence":
    case "word":
      return "verbatim";
    default:
      return DEFAULT_CODEBOOK_TARGET;
  }
}

/**
 * A single code. `id` is an opaque uuid; `color` is a palette key from
 * `PROJECT_COLORS`. Sub-themes are children of the code itself — there is no
 * hierarchy of codebooks, so one editor manages the whole tree.
 */
export type Code = {
  id: string;
  label: string;
  color?: string;
  description?: string;
  children?: Code[];
};

/** The encrypted half of a codebook. */
export type CodebookContent = {
  name: string;
  codes: Code[];
};

/** A codebook as the API returns it — `content` still encrypted when applicable. */
export type CodebookDTO = {
  id: string;
  allStudies: boolean;
  target: CodebookTarget;
  preset: string | null;
  studyIds: string[];
  content: EncryptedDataEntity | CodebookContent;
  createdAt: string;
  updatedAt: string;
};

/** A codebook with its content decrypted, ready for display. */
export type DecryptedCodebook = Omit<CodebookDTO, "content"> & CodebookContent;

/** A code applied to a document. Both ids are opaque. */
export type CodeRef = {
  codebookId: string;
  codeId: string;
};

/**
 * A code applied to one speaker of a document. `speakerId` is the speaker id of
 * the transcript (`speaker_0`, or a uuid for a speaker added later) — a
 * position in the document, never a name: names live inside the encrypted
 * content, so this stays as meaningless to the server as the code ids
 * themselves.
 */
export type SpeakerCodeRef = CodeRef & {
  speakerId: string;
};

export function isCodebookTarget(value: unknown): value is CodebookTarget {
  return (
    typeof value === "string" &&
    (CODEBOOK_TARGETS as readonly string[]).includes(value)
  );
}

/**
 * The codebooks that apply to a given study: those marked "all studies", plus
 * those explicitly linked to it. Passing `null` (a document with no study) keeps
 * only the "all studies" ones.
 */
export function codebooksInScopeForProject<
  T extends { allStudies: boolean; studyIds: string[] },
>(codebooks: T[], projectId: string | null | undefined): T[] {
  return codebooks.filter(
    (c) => c.allStudies || (!!projectId && c.studyIds.includes(projectId)),
  );
}

/**
 * The codebooks offered as a grouping axis in the sidebar: those that apply to
 * every study (as agreed for the "group by" menu), and whose target is one the
 * document list can actually group on — a document's own codes, or the codes of
 * its speakers.
 */
export function groupableCodebooks<
  T extends { allStudies: boolean; target?: CodebookTarget },
>(codebooks: T[]): T[] {
  return codebooks.filter(
    (c) =>
      c.allStudies &&
      GROUPABLE_CODEBOOK_TARGETS.includes(c.target ?? DEFAULT_CODEBOOK_TARGET),
  );
}

/** The codebooks that code people (documents and speakers) rather than text. */
export function speakerCodebooks<T extends { target?: CodebookTarget }>(
  codebooks: T[],
): T[] {
  return codebooks.filter(
    (c) => (c.target ?? DEFAULT_CODEBOOK_TARGET) === "speaker",
  );
}

/** A code and the labels of its ancestors, outermost first. */
export type FlatCode = { code: Code; path: string[]; depth: number };

/**
 * Depth-first walk of a code tree: a parent is immediately followed by its
 * descendants. Everything that needs to look codes up — grouping, sanitizing,
 * pickers — goes through this rather than iterating the top level, which would
 * silently ignore sub-codes.
 */
export function flattenCodes(
  codes: Code[] | null | undefined,
  parentPath: string[] = [],
): FlatCode[] {
  if (!Array.isArray(codes)) return [];
  const flat: FlatCode[] = [];
  for (const code of codes) {
    const path = [...parentPath, code.label];
    flat.push({ code, path, depth: parentPath.length });
    flat.push(...flattenCodes(code.children, path));
  }
  return flat;
}

/**
 * Drop references to codebooks or codes that no longer exist. Deletions leave
 * stale refs on documents on purpose (cleaning every document on every delete
 * would be a large write); filtering here is what makes them invisible.
 */
export function sanitizeCodeRefs(
  refs: CodeRef[] | null | undefined,
  codebooks: Array<{ id: string; codes: Code[] }>,
): CodeRef[] {
  if (!Array.isArray(refs) || refs.length === 0) return [];
  const known = new Map(
    codebooks.map((c) => [
      c.id,
      new Set(flattenCodes(c.codes).map(({ code }) => code.id)),
    ]),
  );
  return refs.filter((ref) => known.get(ref.codebookId)?.has(ref.codeId));
}

/**
 * Same as `sanitizeCodeRefs`, for speaker codes. Refs to a speaker who no
 * longer exists are *kept*: a speaker can disappear from the transcript for
 * the length of an edit (a merge, a rename round-trip), and dropping the codes
 * would lose work that the researcher cannot get back. They simply group
 * nothing until the speaker comes back.
 */
export function sanitizeSpeakerCodeRefs(
  refs: SpeakerCodeRef[] | null | undefined,
  codebooks: Array<{ id: string; codes: Code[] }>,
): SpeakerCodeRef[] {
  if (!Array.isArray(refs) || refs.length === 0) return [];
  const known = new Map(
    codebooks.map((c) => [
      c.id,
      new Set(flattenCodes(c.codes).map(({ code }) => code.id)),
    ]),
  );
  return refs.filter((ref) => known.get(ref.codebookId)?.has(ref.codeId));
}

/** Reads `Transcription.codes` (JSON from the database) as a typed list. */
export function parseCodeRefs(value: unknown): CodeRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (ref): ref is CodeRef =>
      !!ref &&
      typeof ref === "object" &&
      typeof (ref as CodeRef).codebookId === "string" &&
      typeof (ref as CodeRef).codeId === "string",
  );
}

/**
 * Validates the `codes` field of a transcription update. `allowedCodebookIds`
 * is the set of codebooks the caller owns — referencing anything else is
 * rejected rather than silently dropped, so a bad client is visible.
 */
export function validateCodeRefs(
  value: unknown,
  allowedCodebookIds: Set<string>,
): { codes: CodeRef[] } | { error: string } {
  if (value === null) return { codes: [] };
  if (!Array.isArray(value)) return { error: "codes must be an array" };

  const codes: CodeRef[] = [];
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.codebookId !== "string" ||
      typeof entry.codeId !== "string"
    ) {
      return { error: "Each code must be { codebookId, codeId }" };
    }
    if (!allowedCodebookIds.has(entry.codebookId)) {
      return { error: "Unknown codebook" };
    }
    // Same code twice is a no-op, not an error.
    if (
      !codes.some(
        (c) => c.codebookId === entry.codebookId && c.codeId === entry.codeId,
      )
    ) {
      codes.push({ codebookId: entry.codebookId, codeId: entry.codeId });
    }
  }
  return { codes };
}

/** Reads `Transcription.speakerCodes` (JSON) as a typed list. */
export function parseSpeakerCodeRefs(value: unknown): SpeakerCodeRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (ref): ref is SpeakerCodeRef =>
      !!ref &&
      typeof ref === "object" &&
      typeof (ref as SpeakerCodeRef).speakerId === "string" &&
      typeof (ref as SpeakerCodeRef).codebookId === "string" &&
      typeof (ref as SpeakerCodeRef).codeId === "string",
  );
}

/**
 * Validates the `speakerCodes` field of a transcription update — the same
 * contract as `validateCodeRefs`, with the speaker the code is pinned on. The
 * speaker id is not checked against the transcript: it lives inside the
 * (possibly encrypted) content, which the server cannot read.
 */
export function validateSpeakerCodeRefs(
  value: unknown,
  allowedCodebookIds: Set<string>,
): { speakerCodes: SpeakerCodeRef[] } | { error: string } {
  if (value === null) return { speakerCodes: [] };
  if (!Array.isArray(value)) {
    return { error: "speakerCodes must be an array" };
  }

  const speakerCodes: SpeakerCodeRef[] = [];
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.speakerId !== "string" ||
      !entry.speakerId ||
      typeof entry.codebookId !== "string" ||
      typeof entry.codeId !== "string"
    ) {
      return {
        error: "Each speaker code must be { speakerId, codebookId, codeId }",
      };
    }
    if (!allowedCodebookIds.has(entry.codebookId)) {
      return { error: "Unknown codebook" };
    }
    // Same code on the same speaker twice is a no-op, not an error.
    if (
      !speakerCodes.some(
        (c) =>
          c.speakerId === entry.speakerId &&
          c.codebookId === entry.codebookId &&
          c.codeId === entry.codeId,
      )
    ) {
      speakerCodes.push({
        speakerId: entry.speakerId,
        codebookId: entry.codebookId,
        codeId: entry.codeId,
      });
    }
  }
  return { speakerCodes };
}

/**
 * Validates the structural (unencrypted) fields of a codebook create/update.
 * `content` is never inspected: it is opaque ciphertext for encrypted users.
 */
export function parseCodebookInput(
  body: Record<string, unknown>,
  { requireContent }: { requireContent: boolean },
):
  | {
      data: {
        content?: unknown;
        allStudies?: boolean;
        studyIds?: string[];
        target?: CodebookTarget;
        preset?: string | null;
      };
    }
  | { error: string } {
  const data: {
    content?: unknown;
    allStudies?: boolean;
    studyIds?: string[];
    target?: CodebookTarget;
    preset?: string | null;
  } = {};

  if (body.content !== undefined) {
    if (!body.content || typeof body.content !== "object") {
      return { error: "content must be an object" };
    }
    data.content = body.content;
  } else if (requireContent) {
    return { error: "content is required" };
  }

  if (body.allStudies !== undefined) {
    if (typeof body.allStudies !== "boolean") {
      return { error: "allStudies must be a boolean" };
    }
    data.allStudies = body.allStudies;
  }

  if (body.studyIds !== undefined) {
    if (
      !Array.isArray(body.studyIds) ||
      body.studyIds.some((id) => typeof id !== "string")
    ) {
      return { error: "studyIds must be an array of ids" };
    }
    data.studyIds = Array.from(new Set(body.studyIds as string[]));
  }

  if (body.target !== undefined) {
    if (!isCodebookTarget(body.target)) return { error: "Invalid target" };
    data.target = body.target;
  }

  if (body.preset !== undefined) {
    if (body.preset !== null && typeof body.preset !== "string") {
      return { error: "preset must be a string or null" };
    }
    data.preset = body.preset as string | null;
  }

  // A codebook must be reachable: either it covers every study, or it names at
  // least one. `undefined` means "unchanged" on a PATCH, so only check when the
  // request actually sets the scope.
  const allStudies = data.allStudies;
  const studyIds = data.studyIds;
  if (allStudies === false && studyIds !== undefined && studyIds.length === 0) {
    return { error: "A codebook must belong to at least one study" };
  }
  if (requireContent && !allStudies && !studyIds?.length) {
    return { error: "A codebook must belong to at least one study" };
  }

  return { data };
}

/** Guards the code colors coming from the client (palette keys only). */
export function isValidCodeColor(value: unknown): boolean {
  return isValidColor(value);
}
