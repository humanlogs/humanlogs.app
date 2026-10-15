/**
 * How the table is grouped: a CHAIN of rules, not one axis.
 *
 * "Group by code" and "group by speaker" are the same question asked of two
 * dimensions, and the answer a researcher actually wants is usually the crossing:
 * what did the cadres say about violence, person by person. One selector that
 * appends a rule says that in the interface; here it is a list, and a passage
 * lands in one group per combination of the values it has on each rule.
 *
 * The group's identity is its FACET SET — the same vocabulary an analysis is
 * keyed on (`lib/analysis/analysis-facets.ts`), which is what lets a note follow
 * a crossing rather than a screen. Grouping by speaker then by code produces
 * `{speaker:renée, code:cb:violence}`, and that is exactly the slice the note
 * beside it is attached to.
 *
 * Four rules, because there are four things a passage can be sorted by:
 *
 * - `speaker`  — the PERSON, linked by name across the study (speaker-identity.ts)
 * - `document` — the interview it comes from
 * - `code`     — the verbatim codes it carries, from every codebook or from one
 * - `context`  — the codes carried by the person or the document it comes from,
 *                from one speaker codebook. Not a property of the passage: a
 *                property of who said it, which is what makes "the cadres" a row.
 *
 * A passage belongs to several code groups at once (a passage read as two things
 * is under both); it belongs to exactly one speaker and one document.
 */

import type { PhraseCodeRow } from "./phrase-index";
import {
  codeRefKey,
  speakerKey,
  type PhraseGroupBy,
  type PhraseGroupLabel,
} from "./phrase-query";

export type GroupRule =
  | { kind: "speaker" }
  | { kind: "document" }
  /** Every verbatim codebook, or one of them. */
  | { kind: "code"; codebookId?: string }
  /** One speaker codebook, read off the person and the document. */
  | { kind: "context"; codebookId: string };

export type GroupRules = readonly GroupRule[];

/** A stable id for a rule — the chip's key, and what a menu ticks. */
export function ruleId(rule: GroupRule): string {
  switch (rule.kind) {
    case "code":
      return rule.codebookId ? `code:${rule.codebookId}` : "code";
    case "context":
      return `context:${rule.codebookId}`;
    default:
      return rule.kind;
  }
}

export function sameRule(a: GroupRule, b: GroupRule): boolean {
  return ruleId(a) === ruleId(b);
}

/**
 * The single-axis grouping the panel used to have, as a chain.
 *
 * Kept because two callers legitimately want one axis and nothing else: the
 * export, whose first column is a theme by definition, and any stored preference
 * written before rules existed.
 */
export function rulesFromGroupBy(groupBy: PhraseGroupBy): GroupRule[] {
  switch (groupBy) {
    case "code":
      return [{ kind: "code" }];
    case "document":
      return [{ kind: "document" }];
    case "speaker":
      return [{ kind: "speaker" }];
    // "codebook" grouped by which codebook a code came from, which nobody asked
    // a question in terms of; it is now "the codes of THIS codebook" instead.
    case "codebook":
    case "none":
    default:
      return [];
  }
}

/** What the rules need to know that a link does not carry. */
export type GroupContext = {
  /** `(document, speaker)` pair key → the person, so Renée twice is one row. */
  speakerPersons?: Readonly<Record<string, string>>;
  /** Person key → the `codebookId:codeId` they carry. */
  contextByPerson?: Readonly<Record<string, readonly string[]>>;
  /** Document id → the `codebookId:codeId` it carries. */
  contextByDocument?: Readonly<Record<string, readonly string[]>>;
};

/** One group a phrase lands in: the facets that identify it, and how to name it. */
export type GroupPlacement = {
  /**
   * One facet per rule, IN RULE ORDER — which is what the reader's eye follows.
   * The group's identity is the SET of them ({@link groupKeyOf} sorts), so the
   * same crossing is one group whatever order the rules were added in; the order
   * here is only for reading.
   */
  facets: string[];
  /** One label per rule, in the same order — the breadcrumb of the header. */
  path: PhraseGroupLabel[];
};

/**
 * A ceiling on how many groups one phrase can land in.
 *
 * Only reachable by crossing several code dimensions on a heavily coded passage;
 * a phrase read as six things, crossed with a four-code speaker codebook, is
 * twenty-four rows for one sentence. Past this the table has stopped being a
 * table, and silently truncating one phrase is better than a pass that never ends.
 */
const MAX_PLACEMENTS = 64;

/**
 * Where one phrase belongs, given its (already filtered) links.
 *
 * Shared by the streaming query and the materialising one, which is the point:
 * the two have to agree about what a group IS, and the only way to guarantee that
 * is for there to be one implementation of it.
 */
export function placementsOf(
  rules: GroupRules,
  links: readonly PhraseCodeRow[],
  context: GroupContext = {},
): GroupPlacement[] {
  if (links.length === 0) return [];
  if (rules.length === 0) {
    return [{ facets: [], path: [{ type: "all" }] }];
  }

  const levels = rules.map((rule) => valuesOf(rule, links, context));
  // A rule with no value at all cannot happen — `valuesOf` always falls back to
  // an "unassigned" value — but a guard here is cheaper than a silent empty table.
  if (levels.some((level) => level.length === 0)) return [];

  let out: GroupPlacement[] = [{ facets: [], path: [] }];
  for (const level of levels) {
    const next: GroupPlacement[] = [];
    for (const partial of out) {
      for (const value of level) {
        if (next.length >= MAX_PLACEMENTS) break;
        next.push({
          facets: [...partial.facets, value.facet],
          path: [...partial.path, value.label],
        });
      }
    }
    out = next;
  }
  return out;
}

/** The identity of a group, from its facets. Matches `analysisKey`. */
export function groupKeyOf(facets: readonly string[]): string {
  return Array.from(new Set(facets)).sort().join("|");
}

type LevelValue = { facet: string; label: PhraseGroupLabel };

function valuesOf(
  rule: GroupRule,
  links: readonly PhraseCodeRow[],
  context: GroupContext,
): LevelValue[] {
  const first = links[0];
  switch (rule.kind) {
    case "document":
      return [
        {
          facet: `document:${first.documentId}`,
          label: { type: "document", documentId: first.documentId },
        },
      ];

    case "speaker": {
      const pair = speakerKey(first.documentId, first.speakerId);
      return [
        {
          facet: `speaker:${context.speakerPersons?.[pair] ?? pair}`,
          // The label still names ONE (document, speaker): that is what resolves
          // to a display name, and for a person it is the same name whichever of
          // their interviews supplies it.
          label: {
            type: "speaker",
            documentId: first.documentId,
            speakerId: first.speakerId,
          },
        },
      ];
    }

    case "code": {
      const seen = new Set<string>();
      const out: LevelValue[] = [];
      for (const link of links) {
        if (rule.codebookId && link.codebookId !== rule.codebookId) continue;
        const key = codeRefKey(link);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          facet: `code:${key}`,
          label: {
            type: "code",
            codebookId: link.codebookId,
            codeId: link.codeId,
          },
        });
      }
      // Grouping by ONE codebook, a passage coded only in another one still has to
      // land somewhere: a row for what this grille says nothing about is an
      // answer, and dropping it would quietly shrink the corpus.
      return out.length > 0 ? out : [unassigned(rule.codebookId)];
    }

    case "context": {
      const pair = speakerKey(first.documentId, first.speakerId);
      const person = context.speakerPersons?.[pair] ?? pair;
      const carried = [
        ...(context.contextByPerson?.[person] ?? []),
        ...(context.contextByDocument?.[first.documentId] ?? []),
      ];
      const seen = new Set<string>();
      const out: LevelValue[] = [];
      for (const key of carried) {
        if (!key.startsWith(`${rule.codebookId}:`) || seen.has(key)) continue;
        seen.add(key);
        out.push({
          facet: `context:${key}`,
          label: {
            type: "code",
            codebookId: rule.codebookId,
            codeId: key.slice(rule.codebookId.length + 1),
          },
        });
      }
      return out.length > 0 ? out : [unassigned(rule.codebookId)];
    }
  }
}

function unassigned(codebookId: string | undefined): LevelValue {
  return {
    facet: `nocode:${codebookId ?? ""}`,
    label: { type: "unassigned", codebookId: codebookId ?? null },
  };
}
