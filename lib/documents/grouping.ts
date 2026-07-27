/**
 * Grouping and sorting of the document list.
 *
 * This is a pure function on purpose: it is the whole behaviour of the sidebar's
 * "group by / sort by" menu, and the only way to test date bucketing at its
 * boundaries without a browser. It returns *structured* labels rather than
 * translated strings so it stays free of i18n and of React.
 */

import { flattenCodes, type Code, type CodeRef } from "@/lib/codebooks/codebook";

export const TIME_BUCKETS = [
  "today",
  "yesterday",
  "thisWeek",
  "thisMonth",
  "before",
] as const;

export type TimeBucket = (typeof TIME_BUCKETS)[number];

export type GroupBy = "study" | "updatedAt" | "createdAt" | `codebook:${string}`;

export type SortBy = "alphabetical" | "updatedAt" | "createdAt";

export const DEFAULT_GROUP_BY: GroupBy = "study";
export const DEFAULT_SORT_BY: SortBy = "alphabetical";

/** The codebook id encoded in a `codebook:<id>` grouping, or null. */
export function codebookIdFromGroupBy(groupBy: GroupBy): string | null {
  return groupBy.startsWith("codebook:") ? groupBy.slice("codebook:".length) : null;
}

export type GroupableDocument = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  projectId?: string | null;
  codes?: CodeRef[];
};

/**
 * What a group header stands for. The component turns this into a translated
 * string, a study badge, or a code chip.
 */
export type GroupLabel =
  /** `projectId` null means "documents with no study". */
  | { type: "study"; projectId: string | null }
  | { type: "bucket"; bucket: TimeBucket }
  /** `codeId` null means "documents this codebook does not code". */
  | { type: "code"; codebookId: string; codeId: string | null; label: string };

export type DocumentGroup<T> = {
  key: string;
  label: GroupLabel;
  documents: T[];
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calendar buckets, in the viewer's local time. "This week" starts on Monday,
 * and each bucket excludes the finer ones above it — a document from this
 * morning is "today", never "this week".
 */
export function timeBucketFor(value: string | Date, now: Date): TimeBucket {
  const date = value instanceof Date ? value : new Date(value);
  const day = startOfDay(date).getTime();
  const today = startOfDay(now).getTime();

  if (day === today) return "today";

  const yesterday = startOfDay(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  ).getTime();
  if (day === yesterday) return "yesterday";

  // Monday-based week start. getDay() is 0 for Sunday, hence the shift.
  const weekday = (now.getDay() + 6) % 7;
  const weekStart = startOfDay(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - weekday),
  ).getTime();
  if (day >= weekStart && day < today) return "thisWeek";

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (day >= monthStart && day < today) return "thisMonth";

  return "before";
}

function compareTitle(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function sortDocuments<T extends GroupableDocument>(
  documents: T[],
  sortBy: SortBy,
): T[] {
  const sorted = [...documents];
  if (sortBy === "alphabetical") {
    sorted.sort((a, b) => compareTitle(a.title, b.title));
  } else {
    // Most recent first — the only useful direction for a "last update" list.
    const field = sortBy === "createdAt" ? "createdAt" : "updatedAt";
    sorted.sort(
      (a, b) => new Date(b[field]).getTime() - new Date(a[field]).getTime(),
    );
  }
  return sorted;
}

export type GroupDocumentsOptions<T extends GroupableDocument> = {
  documents: T[];
  /** Studies in display order; groups follow it. */
  projects: Array<{ id: string }>;
  /** Decrypted codebooks, needed only for `codebook:<id>` groupings. */
  codebooks?: Array<{ id: string; codes: Code[] }>;
  groupBy: GroupBy;
  sortBy: SortBy;
  /** Injectable clock, so bucket boundaries can be tested. */
  now?: Date;
};

/**
 * Groups documents and sorts each group's contents. Empty groups are dropped;
 * a document carrying several codes of the grouping codebook appears in each of
 * their groups.
 */
export function groupDocuments<T extends GroupableDocument>({
  documents,
  projects,
  codebooks = [],
  groupBy,
  sortBy,
  now = new Date(),
}: GroupDocumentsOptions<T>): DocumentGroup<T>[] {
  const groups: DocumentGroup<T>[] = [];
  const push = (key: string, label: GroupLabel, docs: T[]) => {
    if (docs.length > 0) {
      groups.push({ key, label, documents: sortDocuments(docs, sortBy) });
    }
  };

  const codebookId = codebookIdFromGroupBy(groupBy);

  if (codebookId) {
    const codebook = codebooks.find((c) => c.id === codebookId);
    // Sub-codes are groups of their own, listed right after their parent. The
    // header shows the full path, so two sub-codes sharing a label stay
    // distinguishable.
    const codes = flattenCodes(codebook?.codes);
    const codeIds = new Set(codes.map(({ code }) => code.id));

    for (const { code, path } of codes) {
      push(
        `code:${codebookId}:${code.id}`,
        {
          type: "code",
          codebookId,
          codeId: code.id,
          label: path.join(" › "),
        },
        documents.filter((doc) =>
          (doc.codes ?? []).some(
            (ref) => ref.codebookId === codebookId && ref.codeId === code.id,
          ),
        ),
      );
    }

    // Anything this codebook does not code — including refs to codes it no
    // longer has, which must not silently vanish from the list.
    push(
      `code:${codebookId}:none`,
      { type: "code", codebookId, codeId: null, label: "" },
      documents.filter(
        (doc) =>
          !(doc.codes ?? []).some(
            (ref) => ref.codebookId === codebookId && codeIds.has(ref.codeId),
          ),
      ),
    );

    return groups;
  }

  if (groupBy === "study") {
    for (const project of projects) {
      push(
        `study:${project.id}`,
        { type: "study", projectId: project.id },
        documents.filter((doc) => doc.projectId === project.id),
      );
    }
    push(
      "study:none",
      { type: "study", projectId: null },
      documents.filter((doc) => !doc.projectId),
    );
    return groups;
  }

  const field = groupBy === "createdAt" ? "createdAt" : "updatedAt";
  for (const bucket of TIME_BUCKETS) {
    push(
      `bucket:${bucket}`,
      { type: "bucket", bucket },
      documents.filter((doc) => timeBucketFor(doc[field], now) === bucket),
    );
  }
  return groups;
}
