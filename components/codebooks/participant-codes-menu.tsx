"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { useTranslations } from "@/components/locale-provider";
import {
  DropdownMenuItem,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  useTranscription,
  useUpdateParticipantCodes,
} from "@/hooks/use-transcriptions";
import {
  codebooksInScopeForProject,
  flattenCodes,
  participantCodebooks,
  type ParticipantCodeRef,
} from "@/lib/codebooks/codebook";
import { CheckIcon, PlusIcon, TagsIcon } from "lucide-react";
import { toast } from "sonner";

/**
 * The codes carried by one participant of a document, as a submenu of the
 * speaker badge — the place where that participant already is.
 *
 * Only codebooks whose target is "participant" show up: a document codebook
 * codes what the interview says, this one codes who is in it (role, group,
 * profile). Both are stored on the document, so the sidebar can group on either
 * without reading the transcript.
 */
export function ParticipantCodesMenu({
  transcriptionId,
  projectId,
  participantId,
}: {
  transcriptionId: string;
  projectId?: string | null;
  participantId: string;
}) {
  const t = useTranslations("codebook.participant");
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcription } = useTranscription(transcriptionId);
  const { openCreate } = useCodebookModal();
  const updateCodes = useUpdateParticipantCodes(transcriptionId);

  const inScope = participantCodebooks(
    codebooksInScopeForProject(codebooks, projectId),
  );

  const applied: ParticipantCodeRef[] = transcription?.participantCodes ?? [];
  const isApplied = (codebookId: string, codeId: string) =>
    applied.some(
      (ref) =>
        ref.participantId === participantId &&
        ref.codebookId === codebookId &&
        ref.codeId === codeId,
    );

  // The whole list is replaced on every toggle: the other participants' codes
  // travel untouched, which is what keeps this a single write — and why nothing
  // is written before the document is loaded, which would post an empty list
  // over the codes already there.
  const toggle = (codebookId: string, codeId: string) => {
    if (!transcription) return;

    const next = isApplied(codebookId, codeId)
      ? applied.filter(
          (ref) =>
            !(
              ref.participantId === participantId &&
              ref.codebookId === codebookId &&
              ref.codeId === codeId
            ),
        )
      : [...applied, { participantId, codebookId, codeId }];

    updateCodes.mutate(next, {
      onError: () => toast.error(t("failed")),
    });
  };

  return (
    <DropdownMenuSub
      trigger={
        <span className="flex items-center gap-2">
          <TagsIcon className="h-3.5 w-3.5" />
          {t("menu")}
        </span>
      }
    >
      {inScope.length === 0 ? (
        <DropdownMenuItem onClick={() => openCreate(projectId, "participant")}>
          <PlusIcon className="mr-2 h-3.5 w-3.5" />
          {t("create")}
        </DropdownMenuItem>
      ) : (
        inScope.map((codebook) => (
          <div key={codebook.id}>
            {/* One header per codebook: two codebooks may well hold codes with
                the same label ("Autre"), and the flat list alone would not say
                which is which. */}
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground truncate">
              {codebook.name || t("untitled")}
            </div>
            {flattenCodes(codebook.codes).map(({ code, depth }) => (
              <DropdownMenuItem
                key={code.id}
                preventClose
                className="justify-between gap-4"
                onClick={() => toggle(codebook.id, code.id)}
              >
                <span className="truncate" style={{ paddingLeft: depth * 12 }}>
                  {code.label}
                </span>
                {isApplied(codebook.id, code.id) && (
                  <CheckIcon className="h-4 w-4 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </div>
        ))
      )}
    </DropdownMenuSub>
  );
}
