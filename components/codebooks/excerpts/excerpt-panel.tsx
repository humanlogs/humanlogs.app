"use client";

import * as React from "react";
import { PanelRightCloseIcon, RefreshCwIcon, TableIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCodebooks } from "@/hooks/use-codebooks";
import { useLocalIndexSync, useStudyPhrases } from "@/hooks/use-local-index";
import { useUserProfile } from "@/hooks/use-api";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import {
  flattenCodes,
  type Code,
  type CodeRef,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { codeColorVar } from "@/lib/codebooks/coding";
import type { PhraseCodeRow, PhraseRow } from "@/lib/local/phrase-index";
import {
  documentsMatchingCodes,
  queryPhrases,
  speakersMatchingCodes,
  type PhraseGroup,
} from "@/lib/local/phrase-query";
import { cn } from "@/lib/utils/utils";
import { ExcerptFilters, type ExcerptDocument } from "./excerpt-filters";
import {
  focusMatchesPhrase,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  useExcerptPanel,
} from "./excerpt-panel-context";

/**
 * The excerpt panel: every coded passage the current filter keeps, grouped the way
 * the researcher asked for, permanently available on the right of the app.
 *
 * It reads the LOCAL index (hooks/use-local-index.ts), never the server, which is
 * what lets it stay open while a study of a thousand interviews is browsed and what
 * lets it work at all on an end-to-end encrypted corpus. The sync that keeps that
 * index current runs behind it and is only ever visible as the line at the bottom.
 *
 * Everything it shows about a code — label, colour — comes from the decrypted
 * codebooks, and everything about a document — title, speakers — from the document
 * list the app already holds. The index stores ids, so renaming a code in the
 * codebook editor renames it here without touching a single stored row.
 */
export function ExcerptPanel() {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const { data: profile } = useUserProfile();
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcriptions = [] } = useTranscriptions();

  const projectId = panel.context.projectId;
  // Neither the sync nor the read should cost anything to a researcher who never
  // opens the panel — hence the explicit flag rather than a null scope, which would
  // mean something quite different (the documents filed in no study).
  const sync = useLocalIndexSync(projectId, { enabled: panel.open });
  const { data: index, isPending } = useStudyPhrases(projectId, {
    enabled: panel.open,
  });

  const documents = React.useMemo<ExcerptDocument[]>(
    () =>
      transcriptions.map((doc) => ({
        id: doc.id,
        title: doc.title,
        projectId: doc.projectId ?? null,
        codes: doc.codes ?? [],
        speakerCodes: doc.speakerCodes ?? [],
        speakers: doc.speakers ?? [],
        speakerCount: doc.speakerCount ?? 0,
      })),
    [transcriptions],
  );

  const resolved = useResolvedQuery({
    index,
    documents,
    codebooks,
    userId: profile?.id,
  });

  if (!panel.open) return null;

  return (
    <aside
      // Hidden on small screens on purpose: the panel is a second column, and a
      // second column on a phone is a modal that hides the text it is about.
      className="hidden md:flex relative shrink-0 flex-col border-l bg-background"
      style={{ width: panel.width }}
      aria-label={t("title")}
    >
      <ResizeHandle />

      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <TableIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t("title")}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {resolved.phrases.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-7"
          onClick={() => panel.setOpen(false)}
          aria-label={t("close")}
        >
          <PanelRightCloseIcon className="size-4" />
        </Button>
      </div>

      <ExcerptFilters documents={documents} codebooks={codebooks} />

      <PhraseCodesContext.Provider value={resolved.codesByPhrase}>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2">
            {isPending && !index ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : resolved.groups.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              resolved.groups.map((group) => (
                <ExcerptGroup
                  key={group.key}
                  group={group}
                  labels={resolved.labels}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </PhraseCodesContext.Provider>

      <SyncFooter
        pending={sync.isFetching}
        total={sync.data?.total ?? 0}
        done={sync.data?.done ?? 0}
        failed={sync.data?.failed ?? 0}
      />
    </aside>
  );
}

/** What a row needs, resolved once per query rather than once per row. */
type ExcerptLabels = {
  codeLabel: (ref: CodeRef) => { label: string; color: string | null };
  codebookName: (codebookId: string) => string;
  documentTitle: (documentId: string) => string;
  speakerName: (documentId: string, speakerId: string | null) => string;
};

/** Every code of a codebook, with its full path and the colour it inherits. */
function describeCodes(
  codebook: DecryptedCodebook,
): Array<{ id: string; label: string; color: string | null }> {
  const out: Array<{ id: string; label: string; color: string | null }> = [];
  const walk = (codes: Code[] | undefined, path: string[], color: string | null) => {
    for (const code of codes ?? []) {
      // Sub-codes carry no colour of their own, so a passage coded with a sub-theme
      // still reads as belonging to its theme — the same rule the coding menu uses.
      const own = code.color ?? color;
      out.push({ id: code.id, label: [...path, code.label].join(" › "), color: own });
      walk(code.children, [...path, code.label], own);
    }
  };
  walk(codebook.codes, [], null);
  return out;
}

/**
 * Turn the panel's filter into an actual query.
 *
 * The two halves run in the order the data model was designed for: the
 * speaker-codebook codes are resolved against the DOCUMENT LIST first — a pass over
 * rows the app already holds, producing document and speaker ids — and only then is
 * the index filtered by those ids and by the verbatim codes.
 */
function useResolvedQuery({
  index,
  documents,
  codebooks,
  userId,
}: {
  index: { phrases: PhraseRow[]; links: PhraseCodeRow[] } | undefined;
  documents: ExcerptDocument[];
  codebooks: DecryptedCodebook[];
  userId: string | undefined;
}) {
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
      return Array.from({ length: doc?.speakerCount ?? 0 }, (_, i) => `speaker_${i}`);
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

    const codebook = codebooks.find((c) => c.id === context.codebookId);
    const codeOrder: CodeRef[] | undefined =
      groupBy === "code" && codebook
        ? flattenCodes(codebook.codes).map(({ code }) => ({
            codebookId: codebook.id,
            codeId: code.id,
          }))
        : undefined;

    const query = queryPhrases({
      phrases: index.phrases,
      links: index.links,
      groupBy,
      codeOrder,
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
  }, [
    index,
    filter,
    groupBy,
    context.documentId,
    context.projectId,
    context.codebookId,
    codebooks,
    inStudy,
    rosterOf,
    userId,
  ]);

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
      documentTitle: (documentId) => titles.get(documentId) || t("untitledDocument"),
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

function ExcerptGroup({
  group,
  labels,
}: {
  group: PhraseGroup;
  labels: ExcerptLabels;
}) {
  const t = useTranslations("codebook.excerpts");
  const [collapsed, setCollapsed] = React.useState(false);

  const header = (() => {
    switch (group.label.type) {
      case "all":
        return null;
      case "code": {
        const { label, color } = labels.codeLabel(group.label);
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: codeColorVar(color) }}
            />
            <span className="truncate">{label}</span>
          </span>
        );
      }
      case "codebook":
        return (
          <span className="truncate">
            {labels.codebookName(group.label.codebookId)}
          </span>
        );
      case "document":
        return (
          <span className="truncate">
            {labels.documentTitle(group.label.documentId)}
          </span>
        );
      case "speaker":
        return (
          <span className="truncate">
            {labels.speakerName(group.label.documentId, group.label.speakerId)}
          </span>
        );
    }
  })();

  return (
    <section className="mb-2">
      {header && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent/50"
        >
          <span className="min-w-0 flex-1">{header}</span>
          <span className="tabular-nums">{group.phrases.length}</span>
        </button>
      )}
      {!collapsed &&
        (group.phrases.length === 0 ? (
          <p className="px-3 py-1.5 text-xs text-muted-foreground/60">
            {t("groupEmpty")}
          </p>
        ) : (
          group.phrases.map((phrase) => (
            <ExcerptRow
              key={`${group.key}:${phrase.id}`}
              phrase={phrase}
              labels={labels}
            />
          ))
        ))}
    </section>
  );
}

function ExcerptRow({
  phrase,
  labels,
}: {
  phrase: PhraseRow;
  labels: ExcerptLabels;
}) {
  const panel = useExcerptPanel();
  const ref = React.useRef<HTMLButtonElement>(null);
  const active = focusMatchesPhrase(panel.focused, phrase);
  const codes = usePhraseCodes(phrase.id);

  // The other half of the two-handed loop: the editor focused a passage, so bring
  // its row into view. Only for the EDITOR's own events — reacting to our own would
  // fight the click that produced them.
  React.useEffect(
    () =>
      panel.subscribe((focus) => {
        if (focus.source !== "editor" || !focusMatchesPhrase(focus, phrase)) return;
        ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }),
    [panel, phrase],
  );

  return (
    <button
      ref={ref}
      type="button"
      data-phrase-id={phrase.id}
      onClick={() =>
        panel.focus({
          phraseId: phrase.id,
          documentId: phrase.documentId,
          codingIds: phrase.codingIds,
          source: "table",
        })
      }
      className={cn(
        "mb-1 block w-full rounded-md border border-transparent px-2 py-2 text-left transition-colors",
        active ? "border-border bg-accent" : "hover:bg-accent/50",
      )}
    >
      <p className="line-clamp-3 text-sm leading-snug">{phrase.text}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span className="truncate">
          {labels.speakerName(phrase.documentId, phrase.speakerId)}
        </span>
        <span aria-hidden>·</span>
        <span className="truncate">{labels.documentTitle(phrase.documentId)}</span>
      </div>
      {codes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {codes.map((code) => {
            const { label, color } = labels.codeLabel(code);
            return (
              <span
                key={`${code.codebookId}:${code.codeId}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px]"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: codeColorVar(color) }}
                />
                <span className="truncate">{label}</span>
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}

/**
 * The codes of one phrase, read through a context rather than threaded down: rows
 * are the hot path, and passing a map through the group component would re-render
 * every row whenever any of them changed.
 */
const PhraseCodesContext = React.createContext<Map<string, CodeRef[]>>(new Map());

function usePhraseCodes(phraseId: string): CodeRef[] {
  return React.useContext(PhraseCodesContext).get(phraseId) ?? [];
}

function SyncFooter({
  pending,
  total,
  done,
  failed,
}: {
  pending: boolean;
  total: number;
  done: number;
  failed: number;
}) {
  const t = useTranslations("codebook.excerpts");
  if (!pending && failed === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
      {pending && <RefreshCwIcon className="size-3 animate-spin" />}
      <span>
        {pending ? t("syncing", { done, total }) : t("syncFailed", { count: failed })}
      </span>
    </div>
  );
}

/** Drag the panel's edge. The width is persisted, so it survives the next session. */
function ResizeHandle() {
  const panel = useExcerptPanel();
  const dragging = React.useRef(false);
  const setWidth = panel.setWidth;

  React.useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      setWidth(window.innerWidth - event.clientX);
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [setWidth]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={panel.width}
      aria-valuemin={MIN_PANEL_WIDTH}
      aria-valuemax={MAX_PANEL_WIDTH}
      onPointerDown={() => {
        dragging.current = true;
        // Without this the drag selects the transcript it is dragging across.
        document.body.style.userSelect = "none";
      }}
      className="absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize hover:bg-primary/20"
    />
  );
}
