"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import {
  CodeChips,
  CodeCheckItems,
  CodeToggle,
  colorClass,
  type CodeState,
} from "@/components/codebooks/code-picker";
import { GuideCallout } from "@/components/guidance/guide-callout";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  useTranscription,
  useTranscriptions,
  useUpdateDocumentCodesAcross,
  useUpdateSpeakerCodesAcross,
} from "@/hooks/use-transcriptions";
import {
  codebooksInScopeForProject,
  flattenCodes,
  speakerCodebooks,
  type Code,
  type CodeRef,
  type DecryptedCodebook,
  type SpeakerCodeRef,
} from "@/lib/codebooks/codebook";
import {
  groupSpeakersByName,
  parseSpeakers,
  type SpeakerGroup,
  type SpeakerSummary,
} from "@/lib/transcriptions/speakers";
import { cn } from "@/lib/utils/utils";
import {
  BookMarkedIcon,
  ChevronDownIcon,
  Columns3Icon,
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  Table2Icon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

type StudyDocument = {
  id: string;
  title: string;
  codes?: CodeRef[];
  speakerCodes?: SpeakerCodeRef[];
  speakers?: SpeakerSummary[];
  speakerCount?: number;
};

/**
 * One row of the board — a document, or a person across the study. Both views
 * render the same rows; only the columns differ.
 */
type CodingTarget = {
  key: string;
  kind: "document" | "speaker";
  label: string;
  subtitle?: string;
  /** Full list behind a "In 3 documents" subtitle. */
  subtitleTitle?: string;
  href?: string;
  stateOf: (codebookId: string, codeId: string) => CodeState;
  toggle: (codebookId: string, codeId: string) => void;
  refsFor: (codebookId: string) => CodeRef[];
};

type BoardView = "codebook" | "all";

/**
 * Coding the whole study from one screen: the documents of the study and the
 * people in them as rows, codes as columns.
 *
 * Two views of the same rows. **One codebook**: a column per code, a cell per
 * (row, code) that toggles in one click and takes the code's colour — the
 * fastest way through a pass, and an overview of who carries what. **All
 * codebooks**: a column per codebook, each cell a menu of its codes — for
 * reading and adjusting a row across every grid at once.
 *
 * Speakers are grouped **by name across the study**: the same name in five
 * interviews is one row, and coding it writes on all five. That is a view, not a
 * data model — each document keeps its own speaker codes, so a person coded here
 * reads back identically from the editor of any one interview.
 *
 * Only document-and-people codebooks are offered: verbatim codes hang on a
 * passage of the text, which only exists inside the editor.
 */
export function StudyCodingBoard({ projectId }: { projectId: string }) {
  const t = useTranslations("codebook.board");
  const { openCreate, openEdit } = useCodebookModal();
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcriptions = [], isLoading } = useTranscriptions();
  const updateSpeakerCodes = useUpdateSpeakerCodesAcross();
  const updateDocumentCodes = useUpdateDocumentCodesAcross();

  // Rosters pulled on demand for the documents whose cache is missing — only
  // ever the ones predating it, so this stays empty in practice.
  const [loadedRosters, setLoadedRosters] = React.useState<
    Record<string, SpeakerSummary[]>
  >({});
  const [loadMissing, setLoadMissing] = React.useState(false);
  const [view, setView] = React.useState<BoardView>("codebook");

  const documents: StudyDocument[] = React.useMemo(
    () =>
      transcriptions
        .filter((doc) => doc.projectId === projectId && doc.isOwner !== false)
        .sort((a, b) =>
          a.title.localeCompare(b.title, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),
    [transcriptions, projectId],
  );

  const withRosters = documents.map((doc) => ({
    ...doc,
    speakers: doc.speakers ?? loadedRosters[doc.id],
  }));
  const missing = withRosters.filter((doc) => !doc.speakers);
  const groups = groupSpeakersByName(withRosters);

  const available = speakerCodebooks(
    codebooksInScopeForProject(codebooks, projectId),
  ).map((c) => (c.name ? c : { ...c, name: t("untitled") }));

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  // Falling back to the first one keeps the board usable before any choice, and
  // after the selected codebook is deleted from another tab.
  const codebook =
    available.find((c) => c.id === selectedId) ?? available[0] ?? null;

  /** Every (document, speaker) pair a group stands for. */
  const occurrencesOf = (group: SpeakerGroup) =>
    group.occurrences.map((occurrence) => ({
      occurrence,
      document: withRosters.find((doc) => doc.id === occurrence.documentId),
    }));

  const speakerState = (
    group: SpeakerGroup,
    codebookId: string,
    codeId: string,
  ): CodeState => {
    const carrying = occurrencesOf(group).filter(({ occurrence, document }) =>
      (document?.speakerCodes ?? []).some(
        (ref) =>
          ref.speakerId === occurrence.speakerId &&
          ref.codebookId === codebookId &&
          ref.codeId === codeId,
      ),
    ).length;
    if (carrying === 0) return "none";
    return carrying === group.occurrences.length ? "all" : "some";
  };

  /**
   * Applying a code to a person means writing it on each of their appearances —
   * one update per document. A partially coded group is *completed* rather than
   * cleared: the click that follows a dash reads as "code them everywhere".
   */
  const toggleSpeakerCode = (
    group: SpeakerGroup,
    codebookId: string,
    codeId: string,
  ) => {
    const remove = speakerState(group, codebookId, codeId) === "all";

    const updates = new Map<string, SpeakerCodeRef[]>();
    for (const { occurrence, document } of occurrencesOf(group)) {
      if (!document) continue;
      const current = updates.get(document.id) ?? document.speakerCodes ?? [];
      const matches = (ref: SpeakerCodeRef) =>
        ref.speakerId === occurrence.speakerId &&
        ref.codebookId === codebookId &&
        ref.codeId === codeId;

      updates.set(
        document.id,
        remove
          ? current.filter((ref) => !matches(ref))
          : current.some(matches)
            ? current
            : [
                ...current,
                { speakerId: occurrence.speakerId, codebookId, codeId },
              ],
      );
    }

    updateSpeakerCodes.mutate(
      Array.from(updates.entries()).map(([transcriptionId, value]) => ({
        transcriptionId,
        value,
      })),
      { onError: () => toast.error(t("failed")) },
    );
  };

  /** The distinct codes a person carries, whichever interview they come from. */
  const speakerRefs = (group: SpeakerGroup, codebookId: string): CodeRef[] => {
    const seen = new Set<string>();
    const refs: CodeRef[] = [];
    for (const { occurrence, document } of occurrencesOf(group)) {
      for (const ref of document?.speakerCodes ?? []) {
        if (
          ref.speakerId === occurrence.speakerId &&
          ref.codebookId === codebookId &&
          !seen.has(ref.codeId)
        ) {
          seen.add(ref.codeId);
          refs.push({ codebookId: ref.codebookId, codeId: ref.codeId });
        }
      }
    }
    return refs;
  };

  const documentState = (
    doc: StudyDocument,
    codebookId: string,
    codeId: string,
  ): CodeState =>
    (doc.codes ?? []).some(
      (ref) => ref.codebookId === codebookId && ref.codeId === codeId,
    )
      ? "all"
      : "none";

  const toggleDocumentCode = (
    doc: StudyDocument,
    codebookId: string,
    codeId: string,
  ) => {
    const applied = doc.codes ?? [];
    const value =
      documentState(doc, codebookId, codeId) === "all"
        ? applied.filter(
            (ref) => !(ref.codebookId === codebookId && ref.codeId === codeId),
          )
        : [...applied, { codebookId, codeId }];

    updateDocumentCodes.mutate([{ transcriptionId: doc.id, value }], {
      onError: () => toast.error(t("failed")),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!codebook) {
    return (
      <GuideCallout
        icon={<BookMarkedIcon className="h-5 w-5" />}
        title={t("noCodebook.title")}
        description={t("noCodebook.description")}
        action={{
          label: t("noCodebook.action"),
          onClick: () => openCreate(projectId, "speaker"),
          icon: <PlusIcon className="h-4 w-4" />,
        }}
      />
    );
  }

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  const documentTargets: CodingTarget[] = documents.map((doc) => ({
    key: `document:${doc.id}`,
    kind: "document",
    label: doc.title,
    href: `/app/transcription/${doc.id}`,
    stateOf: (codebookId, codeId) => documentState(doc, codebookId, codeId),
    toggle: (codebookId, codeId) => toggleDocumentCode(doc, codebookId, codeId),
    refsFor: (codebookId) =>
      (doc.codes ?? []).filter((ref) => ref.codebookId === codebookId),
  }));

  const speakerTargets: CodingTarget[] = groups.map((group) => ({
    key: `speaker:${group.key}`,
    kind: "speaker",
    label:
      group.name ??
      t("speakerFallback", { index: group.occurrences[0].index + 1 }),
    subtitle:
      !group.named || group.occurrences.length === 1
        ? group.occurrences[0].documentTitle
        : t("inDocuments", { count: group.occurrences.length }),
    subtitleTitle: group.occurrences
      .map((occurrence) => occurrence.documentTitle)
      .join(", "),
    stateOf: (codebookId, codeId) => speakerState(group, codebookId, codeId),
    toggle: (codebookId, codeId) =>
      toggleSpeakerCode(group, codebookId, codeId),
    refsFor: (codebookId) => speakerRefs(group, codebookId),
  }));

  const columnCount =
    1 +
    (view === "codebook"
      ? Math.max(flattenCodes(codebook.codes).length, 1)
      : available.length);

  const renderRows = (targets: CodingTarget[]) =>
    targets.map((target) => (
      <tr key={target.key} className="border-b last:border-b-0">
        <RowHeader target={target} />
        {view === "codebook" ? (
          <CodeCells codebook={codebook} target={target} />
        ) : (
          available.map((c) => (
            <CodebookCell key={c.id} codebook={c} target={target} />
          ))
        )}
      </tr>
    ));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label={t("view.label")}
          className="inline-flex gap-1 rounded-lg border p-1"
        >
          {(
            [
              ["codebook", Table2Icon],
              ["all", Columns3Icon],
            ] as const
          ).map(([value, Icon]) => (
            <Button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              variant={view === value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView(value)}
            >
              <Icon className="h-4 w-4" />
              {t(`view.${value}`)}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openCreate(projectId, "speaker")}
        >
          <PlusIcon className="h-4 w-4" />
          {t("newCodebook")}
        </Button>
      </div>

      {view === "codebook" && (
        <div className="space-y-2">
          {/* Chips rather than a select: switching grid is the most frequent
              move on this screen, and every option stays in sight. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {available.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={c.id === codebook.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  c.id === codebook.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent",
                )}
              >
                <BookMarkedIcon className="h-3.5 w-3.5" />
                <span className="max-w-[14rem] truncate">{c.name}</span>
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => openEdit(codebook.id)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {t("editCodebook")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 min-w-[12rem] bg-muted p-2 text-left text-xs font-medium text-muted-foreground" />
              {view === "codebook" ? (
                <CodeHeaders
                  codebook={codebook}
                  onAddCodes={() => openEdit(codebook.id)}
                />
              ) : (
                available.map((c) => (
                  <th
                    key={c.id}
                    className="min-w-[10rem] p-2 text-left text-xs font-medium"
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(c.id)}
                      className="inline-flex max-w-[14rem] items-center gap-1.5 hover:underline"
                      title={t("editCodebook")}
                    >
                      <BookMarkedIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{c.name}</span>
                    </button>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            <SectionRow colSpan={columnCount}>
              {t("documents", { count: documents.length })}
            </SectionRow>
            {renderRows(documentTargets)}

            <SectionRow colSpan={columnCount} hint={t("speakersHint")}>
              {t("speakers", { count: groups.length })}
            </SectionRow>
            {renderRows(speakerTargets)}
            {groups.length === 0 && (
              <tr>
                <td
                  colSpan={columnCount}
                  className="p-3 text-xs text-muted-foreground"
                >
                  {t("noSpeakers")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {missing.length > 0 &&
        (loadMissing ? (
          <>
            {missing.map((doc) => (
              <RosterLoader
                key={doc.id}
                documentId={doc.id}
                onLoaded={(speakers) =>
                  setLoadedRosters((current) => ({
                    ...current,
                    [doc.id]: speakers,
                  }))
                }
              />
            ))}
            <p className="text-xs text-muted-foreground">
              {t("loadingRosters", { count: missing.length })}
            </p>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setLoadMissing(true)}
          >
            {t("loadRosters", { count: missing.length })}
          </Button>
        ))}
    </div>
  );
}

/** A full-width row that opens a group of rows (documents, people). */
function SectionRow({
  colSpan,
  hint,
  children,
}: {
  colSpan: number;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b">
      {/* The label stays put while the codes scroll sideways. */}
      <th
        colSpan={1}
        className="sticky left-0 z-10 bg-muted p-2 text-left text-xs font-medium text-muted-foreground"
        title={hint}
      >
        {children}
      </th>
      {colSpan > 1 && <td colSpan={colSpan - 1} className="bg-muted" />}
    </tr>
  );
}

function RowHeader({ target }: { target: CodingTarget }) {
  const Icon = target.kind === "document" ? FileTextIcon : UserIcon;
  return (
    <th
      scope="row"
      className="sticky left-0 z-10 max-w-[16rem] bg-background p-2 text-left font-normal"
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          {target.href ? (
            <Link
              href={target.href}
              className="block truncate text-sm hover:underline"
            >
              {target.label}
            </Link>
          ) : (
            <span className="block truncate text-sm font-medium">
              {target.label}
            </span>
          )}
          {target.subtitle && (
            <span
              className="block truncate text-xs text-muted-foreground"
              title={target.subtitleTitle}
            >
              {target.subtitle}
            </span>
          )}
        </span>
      </span>
    </th>
  );
}

/** One header per code, sub-codes included and marked as such. */
function CodeHeaders({
  codebook,
  onAddCodes,
}: {
  codebook: DecryptedCodebook;
  onAddCodes: () => void;
}) {
  const t = useTranslations("codebook.board");
  const codes = flattenCodes(codebook.codes);

  if (codes.length === 0) {
    return (
      <th className="p-2 text-left text-xs font-normal text-muted-foreground">
        {t("noCodes")}{" "}
        <button
          type="button"
          onClick={onAddCodes}
          className="font-medium text-primary hover:underline"
        >
          {t("addCodes")}
        </button>
      </th>
    );
  }

  return (
    <>
      {codes.map(({ code, path, depth }) => (
        <th
          key={code.id}
          className="w-24 min-w-[5.5rem] max-w-[8rem] p-2 align-bottom text-xs font-medium"
          title={[...path, code.label].join(" › ")}
        >
          <span className="flex flex-col items-center gap-1 text-center">
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                colorClass(code),
              )}
            />
            <span className="line-clamp-2 break-words">
              {depth > 0 && <span className="text-muted-foreground">› </span>}
              {code.label}
            </span>
          </span>
        </th>
      ))}
    </>
  );
}

/** One checkbox per code, filled with the code's colour when applied. */
function CodeCells({
  codebook,
  target,
}: {
  codebook: DecryptedCodebook;
  target: CodingTarget;
}) {
  const codes = flattenCodes(codebook.codes);
  if (codes.length === 0) return <td />;

  return (
    <>
      {codes.map(({ code }) => (
        <CodeCell
          key={code.id}
          code={code}
          state={target.stateOf(codebook.id, code.id)}
          label={`${code.label} — ${target.label}`}
          onToggle={() => target.toggle(codebook.id, code.id)}
        />
      ))}
    </>
  );
}

function CodeCell({
  code,
  state,
  label,
  onToggle,
}: {
  code: Code;
  state: CodeState;
  label: string;
  onToggle: () => void;
}) {
  // The whole cell is the switch, in the code's colour: a row reads as a strip
  // of what it carries, and a column as who carries one code.
  return (
    <td className="border-l p-0.5">
      <CodeToggle
        code={code}
        state={state}
        label={label}
        onToggle={onToggle}
        className="h-10 w-full rounded-md px-2 text-xs"
      />
    </td>
  );
}

/** A codebook's codes on one row, as chips that open the menu to change them. */
function CodebookCell({
  codebook,
  target,
}: {
  codebook: DecryptedCodebook;
  target: CodingTarget;
}) {
  const t = useTranslations("codebook.board");
  const refs = target.refsFor(codebook.id);

  return (
    <td className="border-l p-1 align-middle">
      <DropdownMenu
        align="start"
        // Below the trigger: opening upwards covered the row above, which on a
        // dense list hides the very thing being coded.
        position="bottom"
        trigger={
          <span
            className="flex min-h-9 w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent"
            aria-label={`${codebook.name} — ${target.label}`}
          >
            {refs.length > 0 ? (
              <CodeChips
                refs={refs}
                codebooks={[codebook]}
                className="flex-1"
                solid
              />
            ) : (
              <span className="flex-1 text-xs text-muted-foreground">
                {t("pickCodes")}
              </span>
            )}
            <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
          </span>
        }
      >
        <CodeCheckItems
          codebooks={[codebook]}
          stateOf={target.stateOf}
          onToggle={target.toggle}
        />
      </DropdownMenu>
    </td>
  );
}

/**
 * Loads one document's transcript for its roster. Rendered only for documents
 * whose cache is missing, and only once the researcher asked for them — one
 * component per document, because that is what gives each its own query.
 */
function RosterLoader({
  documentId,
  onLoaded,
}: {
  documentId: string;
  onLoaded: (speakers: SpeakerSummary[]) => void;
}) {
  const { data } = useTranscription(documentId);
  const reported = React.useRef(false);

  React.useEffect(() => {
    if (reported.current) return;
    const speakers = parseSpeakers(data?.transcription);
    if (!speakers) return;
    reported.current = true;
    onLoaded(speakers);
  }, [data, onLoaded]);

  return null;
}
