"use client";

import * as React from "react";
import { useTranslations } from "@/components/locale-provider";
import { useStudyQuery } from "@/hooks/use-local-index";
import {
  codebooksInScopeForProject,
  flattenCodes,
  type Code,
  type CodeRef,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { verbatimCodebooks } from "@/lib/codebooks/coding";
import {
  documentsMatchingCodes,
  speakersMatchingCodes,
} from "@/lib/local/phrase-query";
import {
  DEFAULT_PER_GROUP,
  type KnownCodebooks,
  type StreamedGroup,
} from "@/lib/local/phrase-stream";
import type { StudyQuery } from "@/lib/local/query-store.browser";
import type { ExcerptDocument } from "./excerpt-filters";
import { useExcerptPanel } from "./excerpt-panel-context";

/**
 * Turning the panel's controls into an actual query, and into the labels the rows
 * need.
 *
 * The two halves run in the order the data model was designed for: the
 * speaker-codebook codes are resolved against the DOCUMENT LIST first — a pass over
 * rows the app already holds, producing document and speaker ids — and only then is
 * the index walked, with the resulting ids. That is the "première recherche simple"
 * the model was designed around: it turns a question about people into a question
 * about ids, and leaves the link table to answer only what it alone can.
 *
 * What comes back names its rows and counts the rest; it does not carry the study.
 * See `lib/local/query-store.browser.ts` for why, and `ExcerptList` for the fetch
 * that turns a page of names into text.
 *
 * Labels are resolved OUT of the index rather than stored in it. Every row holds
 * opaque ids; a code renamed in the codebook editor, a document retitled, a speaker
 * named for the first time all show up here without a single stored row being
 * touched.
 */

/** What a row needs, resolved once per query rather than once per row. */
export type ExcerptLabels = {
  codeLabel: (ref: CodeRef) => { label: string; color: string | null };
  codebookName: (codebookId: string) => string;
  documentTitle: (documentId: string) => string;
  speakerName: (documentId: string, speakerId: string | null) => string;
};

export type ExcerptQueryResult = {
  /** Distinct passages the filter keeps — the number in the panel's header. */
  total: number;
  groups: StreamedGroup[];
  labels: ExcerptLabels;
  /**
   * The question, as the store understands it. Exposed so the export can ask it
   * again — deeper, and always grouped by code — instead of reconstructing a
   * filter from the panel's controls a second time and drifting from this one.
   */
  request: Omit<StudyQuery, "signal">;
  /** True while the first answer to THIS question is being computed. */
  pending: boolean;
  /**
   * Keep more references per group.
   *
   * A pass retains a few pages of each group and counts the rest, so a reader who
   * scrolls past that has to be given a deeper pass. Rare by construction — it takes
   * three hundred rows of one group — and cheap, since the walk is the same walk.
   */
  deepen: () => void;
};

const NO_GROUPS: StreamedGroup[] = [];

/** Every code of a codebook, with its full path and the colour it inherits. */
function describeCodes(
  codebook: DecryptedCodebook,
): Array<{ id: string; label: string; color: string | null }> {
  const out: Array<{ id: string; label: string; color: string | null }> = [];
  const walk = (
    codes: Code[] | undefined,
    path: string[],
    color: string | null,
  ) => {
    for (const code of codes ?? []) {
      // Sub-codes carry no colour of their own, so a passage coded with a sub-theme
      // still reads as belonging to its theme — the same rule the coding menu uses.
      const own = code.color ?? color;
      out.push({
        id: code.id,
        label: [...path, code.label].join(" › "),
        color: own,
      });
      walk(code.children, [...path, code.label], own);
    }
  };
  walk(codebook.codes, [], null);
  return out;
}

export function useExcerptQuery({
  documents,
  codebooks,
  userId,
  enabled,
}: {
  documents: ExcerptDocument[];
  codebooks: DecryptedCodebook[];
  userId: string | undefined;
  enabled: boolean;
}): ExcerptQueryResult {
  const t = useTranslations("codebook.excerpts");
  const { filter, groupBy, context } = useExcerptPanel();

  const inStudy = React.useMemo(
    () => documents.filter((doc) => doc.projectId === context.projectId),
    [documents, context.projectId],
  );

  const rosterOf = React.useCallback(
    (documentId: string): string[] => {
      const doc = inStudy.find((d) => d.id === documentId);
      if (doc?.speakers.length) return doc.speakers.map((s) => s.id);
      // A document whose roster cache predates the column: fall back to the count,
      // which is what every other speaker-shaped surface does.
      return Array.from(
        { length: doc?.speakerCount ?? 0 },
        (_, i) => `speaker_${i}`,
      );
    },
    [inStudy],
  );

  // The document dimension. Scoping to the open document wins over the context
  // codes: "this document" is an explicit answer to the same question.
  let documentIds: string[] | undefined;
  if (filter.scope === "document" && context.documentId) {
    documentIds = [context.documentId];
  } else if (filter.contextCodes.length > 0) {
    documentIds = documentsMatchingCodes(inStudy, filter.contextCodes);
  }

  const speakerKeys =
    filter.contextCodes.length > 0 && filter.scope !== "document"
      ? speakersMatchingCodes(inStudy, filter.contextCodes, rosterOf)
      : undefined;

  const request: Omit<StudyQuery, "signal"> = {
    projectId: context.projectId,
    groupBy,
    codeOrder: codeOrderFor({ groupBy, filter, codebooks, context }),
    sanitize: knownCodesOf(codebooks),
    filter: {
      documentIds,
      speakerKeys,
      codes: filter.codes.length > 0 ? filter.codes : undefined,
      userIds: filter.authors === "mine" && userId ? [userId] : undefined,
      search: filter.search,
    },
  };

  // A new question starts shallow again. Adjusted during render rather than in an
  // effect, so no pass is ever launched at the previous question's depth.
  const question = JSON.stringify(request);
  const [depth, setDepth] = React.useState(DEFAULT_PER_GROUP);
  const [asked, setAsked] = React.useState(question);
  if (asked !== question) {
    setAsked(question);
    setDepth(DEFAULT_PER_GROUP);
  }

  const query = useStudyQuery({ ...request, perGroup: depth }, { enabled });

  const labels = React.useMemo<ExcerptLabels>(() => {
    const codes = new Map<string, { label: string; color: string | null }>();
    for (const codebook of codebooks) {
      for (const code of describeCodes(codebook)) {
        codes.set(`${codebook.id}:${code.id}`, {
          label: code.label,
          color: code.color,
        });
      }
    }
    const titles = new Map(documents.map((doc) => [doc.id, doc.title]));
    const rosters = new Map(documents.map((doc) => [doc.id, doc.speakers]));
    const names = new Map(codebooks.map((c) => [c.id, c.name]));

    return {
      codebookName: (codebookId) =>
        names.get(codebookId) || t("unknownCodebook"),
      codeLabel: (ref) =>
        codes.get(`${ref.codebookId}:${ref.codeId}`) ?? {
          label: t("unknownCode"),
          color: null,
        },
      documentTitle: (documentId) =>
        titles.get(documentId) || t("untitledDocument"),
      speakerName: (documentId, speakerId) => {
        if (!speakerId) return t("unknownSpeaker");
        const named = rosters.get(documentId)?.find((s) => s.id === speakerId);
        if (named?.name) return named.name;
        const position = Number(speakerId.replace(/^speaker_/, ""));
        return Number.isFinite(position)
          ? t("speakerFallback", { index: position + 1 })
          : t("unknownSpeaker");
      },
    };
  }, [codebooks, documents, t]);

  const deepen = React.useCallback(() => {
    setDepth((current) => current * 4);
  }, []);

  return {
    total: query.data?.total ?? 0,
    groups: query.data?.groups ?? NO_GROUPS,
    labels,
    request,
    pending: query.isPending,
    deepen,
  };
}

/**
 * The codebooks as this account holds them, for dropping links whose code was
 * deleted — `sanitizeLinks` applied inside the walk, since the rows are never all
 * in memory to be filtered beforehand.
 */
function knownCodesOf(codebooks: DecryptedCodebook[]): KnownCodebooks {
  return codebooks.map((codebook) => ({
    id: codebook.id,
    codeIds: flattenCodes(codebook.codes).map(({ code }) => code.id),
  }));
}

/**
 * The order the code groups are shown in, and which empty ones survive.
 *
 * Grouped by code with no code filter, the whole codebook in use is laid out — so
 * what has NOT been coded is as visible as what has, which is half of what a
 * researcher reads a coding pass for. Once codes are explicitly selected, the empty
 * groups become noise: the answer to "show me «violence»" is not a list of the
 * eleven themes it is not.
 *
 * Away from a document there is no codebook "in use", so a study coded through a
 * single verbatim codebook borrows that one. Without it the groups would come out
 * ordered by size alone, which reads as arbitrary next to a grille. Two codebooks
 * and the choice would be a guess, so it declines.
 */
function codeOrderFor({
  groupBy,
  filter,
  codebooks,
  context,
}: {
  groupBy: ReturnType<typeof useExcerptPanel>["groupBy"];
  filter: ReturnType<typeof useExcerptPanel>["filter"];
  codebooks: DecryptedCodebook[];
  context: ReturnType<typeof useExcerptPanel>["context"];
}): CodeRef[] | undefined {
  if (groupBy !== "code") return undefined;
  if (filter.codes.length > 0) return filter.codes;
  const codebook =
    codebooks.find((c) => c.id === context.codebookId) ??
    onlyVerbatimCodebook(codebooks, context.projectId);
  if (!codebook) return undefined;
  return flattenCodes(codebook.codes).map(({ code }) => ({
    codebookId: codebook.id,
    codeId: code.id,
  }));
}

/** The study's verbatim codebook, when it has exactly one. */
function onlyVerbatimCodebook(
  codebooks: DecryptedCodebook[],
  projectId: string | null,
): DecryptedCodebook | undefined {
  const candidates = verbatimCodebooks(
    codebooksInScopeForProject(codebooks, projectId),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}
