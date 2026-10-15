/**
 * The excerpt table's question, in the address bar.
 *
 * The panel's state is global and survives navigation, which is right while the
 * app is open and wrong the moment it is not: a reload, a back button, or a link
 * sent to a colleague all landed on "whatever that browser last had", and the
 * filter combination a researcher had just built was gone. A question worth
 * asking is worth being able to come back to.
 *
 * So the state is also a URL. Short keys, because this sits next to `?phase=` on
 * an interview and a researcher reads that line; lossy in one deliberate place
 * (see below); and canonical, so the same question always produces the same
 * string — which is what lets the sync loop tell "the URL changed under me" from
 * "I wrote that".
 *
 *   q   free text
 *   sc  scope, only when it is the open document (`doc`)
 *   au  authors, only when it is mine (`mine`)
 *   c   verbatim codes, `codebook:code`, comma separated
 *   cc  context codes (on the documents and the people), same shape
 *   g   the grouping chain, rule ids in order
 *
 * A default is written as ABSENCE, never as a value. That keeps the common case
 * — a document opened, nothing filtered — from putting six parameters on every
 * interview's URL, and it is what makes an empty encoding mean "nothing was
 * said", so arriving on a bare link does not wipe the panel.
 */

import type { GroupRule, GroupRules } from "@/lib/local/group-rules";

export type ExcerptUrlState = {
  scope: "document" | "study";
  authors: "mine" | "everyone";
  search: string;
  codes: Array<{ codebookId: string; codeId: string }>;
  contextCodes: Array<{ codebookId: string; codeId: string }>;
  rules: GroupRule[];
};

/** The parameters this owns. Anything else on the route is left alone. */
export const EXCERPT_PARAMS = ["q", "sc", "au", "c", "cc", "g"] as const;

const LIST = ",";
/** A code is `codebookId:codeId`; both are uuids, so the first colon splits. */
function encodeRef(ref: { codebookId: string; codeId: string }): string {
  return `${ref.codebookId}:${ref.codeId}`;
}

function decodeRef(raw: string): { codebookId: string; codeId: string } | null {
  const cut = raw.indexOf(":");
  if (cut <= 0 || cut === raw.length - 1) return null;
  return { codebookId: raw.slice(0, cut), codeId: raw.slice(cut + 1) };
}

/** A rule as one token: `speaker`, `document`, `code`, `code:<cb>`, `ctx:<cb>`. */
function encodeRule(rule: GroupRule): string {
  switch (rule.kind) {
    case "code":
      return rule.codebookId ? `code:${rule.codebookId}` : "code";
    case "context":
      return `ctx:${rule.codebookId}`;
    default:
      return rule.kind;
  }
}

function decodeRule(raw: string): GroupRule | null {
  if (raw === "speaker") return { kind: "speaker" };
  if (raw === "document") return { kind: "document" };
  if (raw === "code") return { kind: "code" };
  if (raw.startsWith("code:")) {
    const id = raw.slice(5);
    return id ? { kind: "code", codebookId: id } : null;
  }
  if (raw.startsWith("ctx:")) {
    const id = raw.slice(4);
    return id ? { kind: "context", codebookId: id } : null;
  }
  return null;
}

/**
 * The parameters this state adds to a URL — defaults omitted.
 *
 * `rules` is the one thing written even when empty (`g=`), because "grouped by
 * nothing" is a choice a researcher makes and is not the default. Without that
 * the flat list would be indistinguishable from a link that says nothing about
 * grouping, and following one would silently regroup the table.
 */
export function encodeExcerptState(
  state: Partial<ExcerptUrlState>,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const search = state.search?.trim();
  if (search) out.push(["q", search]);
  if (state.scope === "document") out.push(["sc", "doc"]);
  if (state.authors === "mine") out.push(["au", "mine"]);
  if (state.codes?.length)
    out.push(["c", state.codes.map(encodeRef).join(LIST)]);
  if (state.contextCodes?.length)
    out.push(["cc", state.contextCodes.map(encodeRef).join(LIST)]);
  if (state.rules) out.push(["g", state.rules.map(encodeRule).join(LIST)]);
  return out;
}

/** What a URL says about the table, and nothing about what it does not. */
export function decodeExcerptState(params: {
  get(name: string): string | null;
}): Partial<ExcerptUrlState> {
  const out: Partial<ExcerptUrlState> = {};
  const q = params.get("q");
  if (q !== null) out.search = q;
  const sc = params.get("sc");
  if (sc !== null) out.scope = sc === "doc" ? "document" : "study";
  const au = params.get("au");
  if (au !== null) out.authors = au === "mine" ? "mine" : "everyone";

  const codes = params.get("c");
  if (codes !== null) {
    out.codes = codes.split(LIST).map(decodeRef).filter(isRef);
  }
  const context = params.get("cc");
  if (context !== null) {
    out.contextCodes = context.split(LIST).map(decodeRef).filter(isRef);
  }
  const rules = params.get("g");
  if (rules !== null) {
    out.rules = rules
      .split(LIST)
      .filter(Boolean)
      .map(decodeRule)
      .filter((rule): rule is GroupRule => rule !== null);
  }
  return out;
}

function isRef(
  ref: { codebookId: string; codeId: string } | null,
): ref is { codebookId: string; codeId: string } {
  return ref !== null;
}

/**
 * The canonical string for a state — what the sync loop compares.
 *
 * Built from the encoding rather than from the object, so two states that
 * produce the same URL are the same question however they were reached.
 */
export function excerptStateKey(state: Partial<ExcerptUrlState>): string {
  return encodeExcerptState(state)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

/** Replace this state's parameters in a query string, leaving the rest alone. */
export function writeExcerptParams(
  params: URLSearchParams,
  state: Partial<ExcerptUrlState>,
): URLSearchParams {
  for (const key of EXCERPT_PARAMS) params.delete(key);
  for (const [key, value] of encodeExcerptState(state)) params.set(key, value);
  return params;
}

/** Whether a URL says anything about the table at all. */
export function hasExcerptParams(params: {
  get(name: string): string | null;
}): boolean {
  return EXCERPT_PARAMS.some((key) => params.get(key) !== null);
}

/** The rules as the panel holds them, for the comparison above. */
export function rulesKey(rules: GroupRules): string {
  return rules.map(encodeRule).join(LIST);
}
