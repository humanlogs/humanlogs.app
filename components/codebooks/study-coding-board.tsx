"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { CodeChips, CodeCheckItems } from "@/components/codebooks/code-picker";
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
  useUpdateSpeakerCodes,
} from "@/hooks/use-transcriptions";
import {
  codebooksInScopeForProject,
  speakerCodebooks,
  type CodeRef,
  type DecryptedCodebook,
  type SpeakerCodeRef,
} from "@/lib/codebooks/codebook";
import {
  BookMarkedIcon,
  ChevronDownIcon,
  FileTextIcon,
  LockIcon,
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
  speakers?: { id: string; name?: string | null }[];
  speakerCount?: number;
  isEncrypted?: boolean;
};

/**
 * Coding the whole study from one screen: pick a codebook, then assign its
 * codes to each document and to each of its speakers without opening them one
 * by one. This is the counterpart of the per-speaker menu in the editor — same
 * codes, same storage, but the corpus in front of you instead of one interview.
 *
 * Only speaker codebooks are offered: verbatim codes hang on a passage of the
 * text, which only exists inside the editor.
 */
export function StudyCodingBoard({ projectId }: { projectId: string }) {
  const t = useTranslations("codebook.board");
  const { openCreate } = useCodebookModal();
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcriptions = [], isLoading } = useTranscriptions();

  const documents = React.useMemo(
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

  const available = speakerCodebooks(
    codebooksInScopeForProject(codebooks, projectId),
  );

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  // Falling back to the first one keeps the board usable before any choice, and
  // after the selected codebook is deleted from another tab.
  const codebook =
    available.find((c) => c.id === selectedId) ?? available[0] ?? null;

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

  return (
    <div className="space-y-4">
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

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <DocumentCodingRow
              key={doc.id}
              document={doc}
              codebook={codebook}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A menu that toggles the codes of one target (a document, or one speaker). */
function CodesMenu({
  codebook,
  applied,
  onToggle,
  label,
}: {
  codebook: DecryptedCodebook;
  applied: CodeRef[];
  onToggle: (codeId: string) => void;
  label: string;
}) {
  const isApplied = (codebookId: string, codeId: string) =>
    applied.some(
      (ref) => ref.codebookId === codebookId && ref.codeId === codeId,
    );

  return (
    <DropdownMenu
      align="end"
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
        isApplied={isApplied}
        onToggle={(_codebookId, codeId) => onToggle(codeId)}
      />
    </DropdownMenu>
  );
}

/**
 * One document: its own codes, then one line per speaker.
 *
 * The speakers come from the roster cache carried by the list — encrypted like
 * the rest for an E2E document, but small enough to decrypt on the spot. Only a
 * document with no cache at all (one that predates it, and that nobody has
 * opened since) falls back to loading the transcript on demand.
 */
function DocumentCodingRow({
  document: doc,
  codebook,
}: {
  document: StudyDocument;
  codebook: DecryptedCodebook;
}) {
  const t = useTranslations("codebook.board");
  const [revealSpeakers, setRevealSpeakers] = React.useState(false);
  const updateDocumentCodes = useUpdateDocumentCodes(doc.id);
  const updateSpeakerCodes = useUpdateSpeakerCodes(doc.id);

  // Disabled (empty id) unless the cache is missing *and* the researcher asked
  // for the document to be loaded.
  const needsDetail = !doc.speakers && revealSpeakers;
  const detail = useTranscription(needsDetail ? doc.id : "");

  const speakers = doc.speakers ?? detail.data?.transcription?.speakers ?? [];
  const documentCodes = doc.codes ?? [];
  const speakerCodes = doc.speakerCodes ?? [];

  const toggleDocumentCode = (codeId: string) => {
    const applied = documentCodes.some(
      (ref) => ref.codebookId === codebook.id && ref.codeId === codeId,
    );
    const next = applied
      ? documentCodes.filter(
          (ref) => !(ref.codebookId === codebook.id && ref.codeId === codeId),
        )
      : [...documentCodes, { codebookId: codebook.id, codeId }];

    updateDocumentCodes.mutate(next, {
      onError: () => toast.error(t("failed")),
    });
  };

  const toggleSpeakerCode = (speakerId: string, codeId: string) => {
    const applied = speakerCodes.some(
      (ref) =>
        ref.speakerId === speakerId &&
        ref.codebookId === codebook.id &&
        ref.codeId === codeId,
    );
    const next = applied
      ? speakerCodes.filter(
          (ref) =>
            !(
              ref.speakerId === speakerId &&
              ref.codebookId === codebook.id &&
              ref.codeId === codeId
            ),
        )
      : [...speakerCodes, { speakerId, codebookId: codebook.id, codeId }];

    updateSpeakerCodes.mutate(next, {
      onError: () => toast.error(t("failed")),
    });
  };

  const speakerLabel = (
    speaker: { id: string; name?: string | null },
    index: number,
  ) => speaker.name?.trim() || t("speakerFallback", { index: index + 1 });

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 p-3">
        <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Link
          href={`/app/transcription/${doc.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
        >
          {doc.title}
        </Link>
        <CodeChips
          refs={documentCodes.filter((ref) => ref.codebookId === codebook.id)}
          codebooks={[codebook]}
        />
        <CodesMenu
          codebook={codebook}
          applied={documentCodes}
          onToggle={toggleDocumentCode}
          label={t("documentCodes")}
        />
      </div>

      <div className="border-t px-3 py-2">
        {speakers.length > 0 ? (
          <ul className="space-y-1">
            {speakers.map((speaker, index) => (
              <li
                key={speaker.id}
                className="flex flex-wrap items-center gap-2 py-0.5"
              >
                <UserIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {speakerLabel(speaker, index)}
                </span>
                <CodeChips
                  refs={speakerCodes.filter(
                    (ref) =>
                      ref.speakerId === speaker.id &&
                      ref.codebookId === codebook.id,
                  )}
                  codebooks={[codebook]}
                />
                <CodesMenu
                  codebook={codebook}
                  applied={speakerCodes.filter(
                    (ref) => ref.speakerId === speaker.id,
                  )}
                  onToggle={(codeId) => toggleSpeakerCode(speaker.id, codeId)}
                  label={t("speakerCodes")}
                />
              </li>
            ))}
          </ul>
        ) : detail.isLoading ? (
          <Skeleton className="h-6 w-40" />
        ) : detail.isError ? (
          <p className="text-xs text-muted-foreground">{t("locked")}</p>
        ) : !revealSpeakers ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setRevealSpeakers(true)}
          >
            <LockIcon className="h-3.5 w-3.5" />
            {t("revealSpeakers", { count: doc.speakerCount ?? 0 })}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">{t("noSpeakers")}</p>
        )}
      </div>
    </div>
  );
}
