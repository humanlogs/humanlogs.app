/**
 * Verbatim coding: applying a codebook's codes to a passage of a transcript.
 *
 * A coding is a triple — a range, a code, an author. The range lives in the document
 * (a `coding` mark, see extensions/coding-mark.ts), the code and the author live in
 * the `Coding` table, and this module holds everything both sides need to agree on:
 * how a code tree becomes a keyboard-driven menu, which colour a passage is painted,
 * and what the API accepts.
 *
 * Deliberately free of React and of `node:crypto`, like `codebook.ts`, so API routes,
 * client components and tests can all import it.
 */

import {
  flattenCodes,
  type Code,
  type CodebookTarget,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { PROJECT_COLORS } from "@/lib/projects/appearance";

/** A coding as the API returns it. Both code ids are opaque uuids. */
export type CodingDTO = {
  id: string;
  userId: string;
  author: { id: string; name: string | null; email: string } | null;
  codebookId: string;
  codeId: string;
  createdAt: string;
};

/**
 * Whose codings the researcher is looking at. Coding is an interpretation, so two
 * people coding the same corpus disagree on purpose: reading only your own pass is
 * the working mode, reading everyone's is the comparison mode.
 */
export const CODING_SCOPES = ["mine", "everyone"] as const;
export type CodingScope = (typeof CODING_SCOPES)[number];
export const DEFAULT_CODING_SCOPE: CodingScope = "mine";

/** The codebooks whose codes go on a passage — the only ones the editor offers. */
export function verbatimCodebooks<T extends { target?: CodebookTarget }>(
  codebooks: T[],
): T[] {
  return codebooks.filter((c) => c.target === "verbatim");
}

/**
 * One entry of the coding menu: a code, the codebook it came from, the colour its
 * highlight is painted with, and the keystrokes that reach it.
 */
export type CodingOption = {
  codebookId: string;
  codebookName: string;
  code: Code;
  /** The letter typed at this level, e.g. "B". Null past the 26th sibling. */
  letter: string | null;
  /** The full sequence from the root, e.g. "AB" — null as soon as one level has none. */
  sequence: string | null;
  /**
   * The palette key the highlight uses. Sub-codes carry no colour of their own for
   * now, so they inherit their parent's: a passage coded with a sub-theme still reads
   * as belonging to its theme, and the legend's dots stay a small fixed set.
   */
  color: string | null;
  children: CodingOption[];
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function buildLevel(
  codes: Code[] | undefined,
  codebookId: string,
  codebookName: string,
  parentSequence: string | null,
  inheritedColor: string | null,
): CodingOption[] {
  if (!Array.isArray(codes)) return [];
  return codes.map((code, index) => {
    const letter = index < LETTERS.length ? LETTERS[index] : null;
    // A level past the 26th sibling has no letter, and neither has anything under it:
    // there is no sequence to type that would reach it.
    const sequence =
      letter !== null && parentSequence !== null
        ? `${parentSequence}${letter}`
        : null;
    const color = code.color ?? inheritedColor;
    return {
      codebookId,
      codebookName,
      code,
      letter,
      sequence,
      color,
      children: buildLevel(code.children, codebookId, codebookName, sequence, color),
    };
  });
}

/**
 * The coding menu for a set of codebooks: codes in their authored order, sub-codes
 * nested, each reachable by typing its letter sequence.
 *
 * Letters run across the WHOLE top level rather than restarting per codebook — the
 * researcher types "A" without first choosing a codebook, so two codes answering to
 * "A" would make the shortcut ambiguous. Within a code, its sub-codes restart at "A",
 * which is what makes "AB" mean "second sub-code of the first code".
 */
export function buildCodingOptions(
  codebooks: DecryptedCodebook[],
): CodingOption[] {
  const options: CodingOption[] = [];
  let topIndex = 0;
  for (const codebook of codebooks) {
    for (const code of codebook.codes ?? []) {
      const letter = topIndex < LETTERS.length ? LETTERS[topIndex] : null;
      topIndex++;
      const color = code.color ?? null;
      options.push({
        codebookId: codebook.id,
        codebookName: codebook.name,
        code,
        letter,
        sequence: letter,
        color,
        children: buildLevel(
          code.children,
          codebook.id,
          codebook.name,
          letter,
          color,
        ),
      });
    }
  }
  return options;
}

/** Depth-first walk of a built menu — parents immediately followed by descendants. */
export function flattenCodingOptions(
  options: CodingOption[],
): CodingOption[] {
  const flat: CodingOption[] = [];
  for (const option of options) {
    flat.push(option);
    flat.push(...flattenCodingOptions(option.children));
  }
  return flat;
}

/** The option a typed letter sequence lands on, or null when nothing matches. */
export function optionForSequence(
  options: CodingOption[],
  sequence: string,
): CodingOption | null {
  const wanted = sequence.toUpperCase();
  return (
    flattenCodingOptions(options).find((o) => o.sequence === wanted) ?? null
  );
}

/** Whether more letters could still extend `sequence` into a real option. */
export function sequenceHasContinuation(
  options: CodingOption[],
  sequence: string,
): boolean {
  const wanted = sequence.toUpperCase();
  return flattenCodingOptions(options).some(
    (o) => o.sequence !== null && o.sequence.length > wanted.length && o.sequence.startsWith(wanted),
  );
}

/** Index the built menu by `codebookId:codeId`, for resolving stored codings. */
export function indexCodingOptions(
  options: CodingOption[],
): Map<string, CodingOption> {
  return new Map(
    flattenCodingOptions(options).map((o) => [
      codeKey(o.codebookId, o.code.id),
      o,
    ]),
  );
}

export function codeKey(codebookId: string, codeId: string): string {
  return `${codebookId}:${codeId}`;
}

/**
 * The CSS colour a palette key paints with. `PROJECT_COLORS` holds Tailwind classes
 * because badges need classes; a highlight is drawn from a gradient, which needs the
 * value — and Tailwind v4 publishes every palette entry as a CSS variable, so the two
 * cannot drift.
 */
export function codeColorVar(color: string | null | undefined): string {
  const className = (color && PROJECT_COLORS[color]) || null;
  if (!className) return "var(--color-slate-400)";
  return `var(--${className.replace(/^bg-/, "color-")})`;
}

/**
 * The background painted on a run covered by `colors`.
 *
 * One colour is a flat wash. Several are hatched rather than blended: a blend of two
 * codes is a third colour that matches neither legend dot, whereas stripes stay
 * readable as "this passage carries both". Colours are used in the order given, which
 * callers keep stable (menu order) so the same overlap always looks the same.
 */
export function codingBackground(colors: Array<string | null>): string {
  const vars = Array.from(new Set(colors.map((c) => codeColorVar(c))));
  if (vars.length === 0) return "transparent";
  const tint = (v: string) => `color-mix(in oklab, ${v} 30%, transparent)`;
  if (vars.length === 1) return tint(vars[0]);

  const band = 8; // px — wide enough to read as stripes, narrow enough to stay text
  const stops = vars.map(
    (v, i) => `${tint(v)} ${i * band}px, ${tint(v)} ${(i + 1) * band}px`,
  );
  return `repeating-linear-gradient(135deg, ${stops.join(", ")})`;
}

/** The codings a scope shows: everyone's, or only those authored by `userId`. */
export function codingsInScope(
  codings: CodingDTO[],
  scope: CodingScope,
  userId: string | undefined,
): CodingDTO[] {
  if (scope === "everyone") return codings;
  if (!userId) return [];
  return codings.filter((c) => c.userId === userId);
}

/**
 * Validates a coding create request. `allowedCodebookIds` is the set of codebooks the
 * caller can read — referencing anything else is rejected rather than dropped, so a
 * bad client is visible (same contract as `validateCodeRefs`).
 */
export function parseCodingInput(
  body: Record<string, unknown>,
  allowedCodebookIds: Set<string>,
):
  | { data: { id: string; codebookId: string; codeId: string } }
  | { error: string } {
  const { id, codebookId, codeId } = body as Record<string, unknown>;
  if (typeof id !== "string" || !id.trim()) {
    return { error: "id is required" };
  }
  if (typeof codebookId !== "string" || typeof codeId !== "string") {
    return { error: "codebookId and codeId are required" };
  }
  if (!allowedCodebookIds.has(codebookId)) {
    return { error: "Unknown codebook" };
  }
  return { data: { id, codebookId, codeId } };
}

/**
 * Drop codings whose code or codebook no longer exists. Deleting a code leaves its
 * codings behind on purpose — cleaning every document on every delete would be a large
 * write — so, as with `sanitizeCodeRefs`, filtering here is what makes them invisible.
 */
export function sanitizeCodings(
  codings: CodingDTO[],
  codebooks: Array<{ id: string; codes: Code[] }>,
): CodingDTO[] {
  const known = new Map(
    codebooks.map((c) => [
      c.id,
      new Set(flattenCodes(c.codes).map(({ code }) => code.id)),
    ]),
  );
  return codings.filter((c) => known.get(c.codebookId)?.has(c.codeId));
}
