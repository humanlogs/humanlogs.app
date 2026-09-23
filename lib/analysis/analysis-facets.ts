/**
 * What an analysis is ABOUT.
 *
 * A coded passage is a fact: this person said this, and someone read it as
 * «violence». An analysis is not about a passage — it is what a researcher makes
 * of a *slice* of the corpus, and the slice is exactly the question the excerpt
 * table was asked when they wrote it. "The positive passages" is one slice. "The
 * positive passages of the people coded «cadre»" is another, narrower one, and it
 * deserves its own note rather than overwriting the first.
 *
 * So an analysis is keyed on a SET of facets: the group it sits under, plus every
 * filter that was active. A set, unordered and deduplicated, because the same
 * question asked in a different order is the same question — arriving at
 * «positif» + «cadre» by grouping then filtering, or by filtering then grouping,
 * must find the note you already wrote.
 *
 * The consequence that makes this worth the trouble: a WIDER view can find the
 * narrower notes, because their facet sets are supersets of its own. Looking at
 * every positive passage, you are shown what you wrote about the positive
 * passages of the cadres, labelled with what makes it narrower. Nothing is
 * stranded in a filter combination you have to remember to reproduce.
 *
 * The facet vocabulary is deliberately the group keys the query already produces
 * (`lib/local/phrase-stream.ts`), so a group's facet IS its key and the two cannot
 * drift:
 *
 * - `code:<codebookId>:<codeId>`    a verbatim code, grouped by or filtered on
 * - `codebook:<codebookId>`         a whole codebook, when grouping by codebook
 * - `document:<documentId>`         one interview
 * - `speaker:<person>`              one person, across the study (see
 *                                   `speaker-identity.ts`: linked by name)
 * - `context:<codebookId>:<codeId>` a code on the DOCUMENTS or the PEOPLE, which
 *                                   narrows whose passages count rather than
 *                                   which passages do
 * - `nocode:<codebookId>`           what that codebook says nothing about, which
 *                                   is one of the things a grille is read for
 *
 * Two things are deliberately NOT facets. The free-text search is a way of
 * finding a passage, not a property of a slice, and a note attached to a typo
 * would be unreachable forever. And "my codes only" is about whose reading is on
 * screen, not about what the corpus says — a note written with it on is still a
 * note about that code.
 */

/** One dimension of the slice, as a stable token. */
export type AnalysisFacet = string;

/** Separates facets inside a key. Neither uuids nor the prefixes contain it. */
const SEPARATOR = "|";

/**
 * The canonical key of a facet set: sorted and deduplicated, so the same question
 * always produces the same string whatever order it was built in.
 *
 * The empty set is a real key, not a missing one: it is the whole study, ungrouped
 * and unfiltered, which is where a general note about the corpus belongs.
 */
export function analysisKey(facets: readonly AnalysisFacet[]): string {
  return Array.from(new Set(facets)).sort().join(SEPARATOR);
}

export function parseAnalysisKey(key: string): AnalysisFacet[] {
  return key ? key.split(SEPARATOR) : [];
}

/** A facet set as a set, for the containment tests below. */
function setOf(facets: readonly AnalysisFacet[]): Set<AnalysisFacet> {
  return new Set(facets);
}

/** Whether `base` is contained in `candidate` — the same slice, or a wider one. */
export function covers(
  candidate: readonly AnalysisFacet[],
  base: readonly AnalysisFacet[],
): boolean {
  const have = setOf(candidate);
  return base.every((facet) => have.has(facet));
}

/**
 * Whether `candidate` is a STRICTLY narrower slice than `base`: everything base
 * asks, and at least one thing more.
 */
export function isNarrowerThan(
  candidate: readonly AnalysisFacet[],
  base: readonly AnalysisFacet[],
): boolean {
  return (
    candidate.length > base.length &&
    covers(candidate, base) &&
    // Length alone would be fooled by duplicates; both sides are canonical when
    // they come from `analysisKey`, but this is cheap and the invariant matters.
    setOf(candidate).size > setOf(base).size
  );
}

/** What makes `candidate` narrower than `base` — used to label a narrower note. */
export function extraFacets(
  candidate: readonly AnalysisFacet[],
  base: readonly AnalysisFacet[],
): AnalysisFacet[] {
  const had = setOf(base);
  return candidate.filter((facet) => !had.has(facet));
}

/** The filters the table was asked with, reduced to what an analysis is keyed on. */
export type AnalysisView = {
  /**
   * The group's own facets, straight from the query. Empty for the ungrouped
   * list, which narrows nothing. Several of them now that grouping is a chain:
   * a crossing of speaker and code contributes both, which is exactly the slice
   * the note beside it is about.
   */
  groupFacets?: readonly AnalysisFacet[];
  /** Verbatim codes the passages had to carry. */
  codes?: ReadonlyArray<{ codebookId: string; codeId: string }>;
  /** Codes on the documents or the people, narrowing whose passages count. */
  contextCodes?: ReadonlyArray<{ codebookId: string; codeId: string }>;
  /** The one interview the table was scoped to, if any. */
  documentId?: string | null;
};

export function facetsOfView(view: AnalysisView): AnalysisFacet[] {
  const facets: AnalysisFacet[] = [];
  for (const facet of view.groupFacets ?? []) facets.push(facet);
  for (const ref of view.codes ?? [])
    facets.push(`code:${ref.codebookId}:${ref.codeId}`);
  for (const ref of view.contextCodes ?? [])
    facets.push(`context:${ref.codebookId}:${ref.codeId}`);
  if (view.documentId) facets.push(`document:${view.documentId}`);
  return Array.from(new Set(facets)).sort();
}

/** The key of a view, in one step. */
export function keyOfView(view: AnalysisView): string {
  return analysisKey(facetsOfView(view));
}

/** How a facet reads, split into the dimension and the id it names. */
export function describeFacet(facet: AnalysisFacet): {
  kind:
    | "code"
    | "codebook"
    | "document"
    | "speaker"
    | "context"
    | "nocode"
    | "unknown";
  codebookId?: string;
  codeId?: string;
  id?: string;
} {
  const [kind, ...rest] = facet.split(":");
  switch (kind) {
    case "code":
    case "context":
      return { kind, codebookId: rest[0], codeId: rest.slice(1).join(":") };
    case "codebook":
    case "document":
    case "speaker":
    case "nocode":
      return { kind, id: rest.join(":") };
    default:
      return { kind: "unknown" };
  }
}
