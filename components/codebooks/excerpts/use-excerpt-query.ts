"use client";

import * as React from "react";
import { useTranslations } from "@/components/locale-provider";
import {
  flattenCodes,
  type Code,
  type CodeRef,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import type { PhraseCodeRow, PhraseRow } from "@/lib/local/phrase-index";
import {
  documentsMatchingCodes,
  queryPhrases,
  sanitizeLinks,
  speakersMatchingCodes,
  type PhraseGroup,
} from "@/lib/local/phrase-query";
import type { ExcerptDocument } from "./excerpt-filters";
import { useExcerptPanel } from "./excerpt-panel-context";

/**
 * Turning the panel's controls into an actual query, and into the labels the rows
 * need.
 *
 * The two halves run in the order the data model was designed for: the
 * speaker-codebook codes are resolved against the DOCUMENT LIST first — a pass over
 * rows the app already holds, producing document and speaker ids — and only then is
 * the index filtered by those ids and by the verbatim codes.
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
  phrases: PhraseRow[];
  groups: PhraseGroup[];
  codesByPhrase: Map<string, CodeRef[]>;
  labels: ExcerptLabels;
};

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
  index,
  documents,
  codebooks,
  userId,
}: {
  index: { phrases: PhraseRow[]; links: PhraseCodeRow[] } | undefined;
  documents: ExcerptDocument[];
  codebooks: DecryptedCodebook[];
  userId: string | undefined;
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

  const result = React.useMemo(() => {
    if (!index) {
      return {
        phrases: [] as PhraseRow[],
        groups: [] as PhraseGroup[],
        codesByPhrase: new Map<string, CodeRef[]>(),
      };
    }

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

    const query = queryPhrases({
      phrases: index.phrases,
      links: sanitizeLinks(index.links, codebooks),
      groupBy,
      codeOrder: codeOrderFor({ groupBy, filter, codebooks, context }),
      filter: {
        projectId: context.projectId,
        documentIds,
        speakerKeys,
        codes: filter.codes.length > 0 ? filter.codes : undefined,
        userIds: filter.authors === "mine" && userId ? [userId] : undefined,
        search: filter.search,
      },
    });

    // The same code applied by two researchers is one chip, not two.
    const codesByPhrase = new Map<string, CodeRef[]>();
    for (const [phraseId, links] of query.codesByPhrase) {
      const seen = new Set<string>();
      const refs: CodeRef[] = [];
      for (const link of links) {
        const key = `${link.codebookId}:${link.codeId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({ codebookId: link.codebookId, codeId: link.codeId });
      }
      codesByPhrase.set(phraseId, refs);
    }

    return { phrases: query.phrases, groups: query.groups, codesByPhrase };
  }, [index, filter, groupBy, context, codebooks, inStudy, rosterOf, userId]);

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

  return { ...result, labels };
}

/**
 * The order the code groups are shown in, and which empty ones survive.
 *
 * Grouped by code with no code filter, the whole codebook in use is laid out — so
 * what has NOT been coded is as visible as what has, which is half of what a
 * researcher reads a coding pass for. Once codes are explicitly selected, the empty
 * groups become noise: the answer to "show me «violence»" is not a list of the
 * eleven themes it is not.
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
  const codebook = codebooks.find((c) => c.id === context.codebookId);
  if (!codebook) return undefined;
  return flattenCodes(codebook.codes).map(({ code }) => ({
    codebookId: codebook.id,
    codeId: code.id,
  }));
}
