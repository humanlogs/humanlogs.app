"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import {
  CodeChips,
  CodeCheckItems,
  type CodeState,
} from "@/components/codebooks/code-picker";
import { GuideCallout } from "@/components/guidance/guide-callout";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  useTranscription,
  useTranscriptions,
  useUpdateDocumentCodes,
  useUpdateSpeakerCodesAcross,
} from "@/hooks/use-transcriptions";
import {
  codebooksInScopeForProject,
  speakerCodebooks,
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
import {
  BookMarkedIcon,
  ChevronDownIcon,
  FileTextIcon,
  PlusIcon,
  TagsIcon,
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
 * Coding the whole study from one screen: pick a codebook, then assign its codes
 * to the people of the corpus and to its documents, without opening them one by
 * one.
 *
 * Speakers are grouped **by name across the study**: the same name in five
 * interviews is one row, and coding it writes on all five. That is a view, not a
 * data model — each document keeps its own speaker codes, so a person coded here
 * reads back identically from the editor of any one interview.
 *
 * Only speaker codebooks are offered: verbatim codes hang on a passage of the
 * text, which only exists inside the editor.
 */
export function StudyCodingBoard({ projectId }: { projectId: string }) {
  const t = useTranslations("codebook.board");
  const { openCreate } = useCodebookModal();
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcriptions = [], isLoading } = useTranscriptions();
  const updateSpeakerCodes = useUpdateSpeakerCodesAcross();

  // Rosters pulled on demand for the documents whose cache is missing — only
  // ever the ones predating it, so this stays empty in practice.
  const [loadedRosters, setLoadedRosters] = React.useState<
    Record<string, SpeakerSummary[]>
  >({});
  const [loadMissing, setLoadMissing] = React.useState(false);

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
  );

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

  const speakerState = (group: SpeakerGroup, codeId: string): CodeState => {
    if (!codebook) return "none";
    const carrying = occurrencesOf(group).filter(({ occurrence, document }) =>
      (document?.speakerCodes ?? []).some(
        (ref) =>
          ref.speakerId === occurrence.speakerId &&
          ref.codebookId === codebook.id &&
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
  const toggleSpeakerCode = (group: SpeakerGroup, codeId: string) => {
    if (!codebook) return;
    const remove = speakerState(group, codeId) === "all";

    const updates = new Map<string, SpeakerCodeRef[]>();
    for (const { occurrence, document } of occurrencesOf(group)) {
      if (!document) continue;
      const current = updates.get(document.id) ?? document.speakerCodes ?? [];
      const matches = (ref: SpeakerCodeRef) =>
        ref.speakerId === occurrence.speakerId &&
        ref.codebookId === codebook.id &&
        ref.codeId === codeId;

      updates.set(
        document.id,
        remove
          ? current.filter((ref) => !matches(ref))
          : current.some(matches)
            ? current
            : [
                ...current,
                {
                  speakerId: occurrence.speakerId,
                  codebookId: codebook.id,
                  codeId,
                },
              ],
      );
    }

    updateSpeakerCodes.mutate(
      Array.from(updates.entries()).map(([transcriptionId, speakerCodes]) => ({
        transcriptionId,
        speakerCodes,
      })),
      { onError: () => toast.error(t("failed")) },
    );
  };

  /** The distinct codes a person carries, whichever interview they come from. */
  const chipsFor = (group: SpeakerGroup): CodeRef[] => {
    if (!codebook) return [];
    const seen = new Set<string>();
    const refs: CodeRef[] = [];
    for (const { occurrence, document } of occurrencesOf(group)) {
      for (const ref of document?.speakerCodes ?? []) {
        if (
          ref.speakerId === occurrence.speakerId &&
          ref.codebookId === codebook.id &&
          !seen.has(ref.codeId)
        ) {
          seen.add(ref.codeId);
          refs.push({ codebookId: ref.codebookId, codeId: ref.codeId });
        }
      }
    }
    return refs;
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

  const groupLabel = (group: SpeakerGroup) =>
    group.name ??
    t("speakerFallback", { index: group.occurrences[0].index + 1 });

  const groupSubtitle = (group: SpeakerGroup) =>
    !group.named || group.occurrences.length === 1
      ? group.occurrences[0].documentTitle
      : t("inDocuments", { count: group.occurrences.length });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("codebook")}</p>
        <Select
          options={available.map((c) => ({
            value: c.id,
            label: c.name || t("untitled"),
          }))}
          value={codebook.id}
          onChange={setSelectedId}
        />
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("speakers", { count: groups.length })}
        </h2>
        <p className="text-xs text-muted-foreground">{t("speakersHint")}</p>

        <div className="rounded-lg border">
          {groups.map((group) => (
            <div
              key={group.key}
              className="flex flex-wrap items-center gap-2 border-b p-3 last:border-b-0"
            >
              <UserIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {groupLabel(group)}
                </span>
                <span
                  className="block truncate text-xs text-muted-foreground"
                  title={group.occurrences
                    .map((occurrence) => occurrence.documentTitle)
                    .join(", ")}
                >
                  {groupSubtitle(group)}
                </span>
              </span>
              <CodeChips refs={chipsFor(group)} codebooks={[codebook]} />
              <CodesMenu
                codebook={codebook}
                stateOf={(_codebookId, codeId) => speakerState(group, codeId)}
                onToggle={(codeId) => toggleSpeakerCode(group, codeId)}
                label={t("speakerCodes")}
              />
            </div>
          ))}

          {groups.length === 0 && (
            <p className="p-3 text-xs text-muted-foreground">
              {t("noSpeakers")}
            </p>
          )}
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
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("documents", { count: documents.length })}
        </h2>

        <div className="rounded-lg border">
          {documents.map((doc) => (
            <DocumentRow key={doc.id} document={doc} codebook={codebook} />
          ))}
        </div>
      </section>
    </div>
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

/** A menu that toggles the codes of one target (a person, or one document). */
function CodesMenu({
  codebook,
  stateOf,
  onToggle,
  label,
}: {
  codebook: DecryptedCodebook;
  stateOf: (codebookId: string, codeId: string) => CodeState;
  onToggle: (codeId: string) => void;
  label: string;
}) {
  return (
    <DropdownMenu
      align="end"
      // Below the trigger: opening upwards covered the row above, which on a
      // dense list hides the very thing being coded.
      position="bottom"
      trigger={
        <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors hover:bg-accent">
          <TagsIcon className="h-3.5 w-3.5" />
          {label}
          <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
        </span>
      }
    >
      <CodeCheckItems
        codebooks={[codebook]}
        stateOf={stateOf}
        onToggle={(_codebookId, codeId) => onToggle(codeId)}
      />
    </DropdownMenu>
  );
}

/** The codes of the interview as a whole. */
function DocumentRow({
  document: doc,
  codebook,
}: {
  document: StudyDocument;
  codebook: DecryptedCodebook;
}) {
  const t = useTranslations("codebook.board");
  const updateDocumentCodes = useUpdateDocumentCodes(doc.id);
  const applied = doc.codes ?? [];

  const stateOf = (codebookId: string, codeId: string): CodeState =>
    applied.some(
      (ref) => ref.codebookId === codebookId && ref.codeId === codeId,
    )
      ? "all"
      : "none";

  const toggle = (codeId: string) => {
    const next =
      stateOf(codebook.id, codeId) === "all"
        ? applied.filter(
            (ref) => !(ref.codebookId === codebook.id && ref.codeId === codeId),
          )
        : [...applied, { codebookId: codebook.id, codeId }];

    updateDocumentCodes.mutate(next, {
      onError: () => toast.error(t("failed")),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-3 last:border-b-0">
      <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Link
        href={`/app/transcription/${doc.id}`}
        className="min-w-0 flex-1 truncate text-sm hover:underline"
      >
        {doc.title}
      </Link>
      <CodeChips
        refs={applied.filter((ref) => ref.codebookId === codebook.id)}
        codebooks={[codebook]}
      />
      <CodesMenu
        codebook={codebook}
        stateOf={stateOf}
        onToggle={toggle}
        label={t("documentCodes")}
      />
    </div>
  );
}
