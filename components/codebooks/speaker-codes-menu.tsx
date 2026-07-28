"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import {
  CodeCheckItems,
  type CodeState,
} from "@/components/codebooks/code-picker";
import { useTranslations } from "@/components/locale-provider";
import {
  DropdownMenuItem,
  DropdownMenuSub,
} from "@/components/ui/dropdown-menu";
import { useBetaFeatures } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  useTranscription,
  useUpdateSpeakerCodes,
} from "@/hooks/use-transcriptions";
import {
  codebooksInScopeForProject,
  speakerCodebooks,
  type SpeakerCodeRef,
} from "@/lib/codebooks/codebook";
import { PlusIcon, TagsIcon } from "lucide-react";
import { toast } from "sonner";

/**
 * The codes carried by one speaker of a document, as a submenu of the speaker
 * badge — the place where that speaker already is.
 *
 * Only speaker codebooks show up: a verbatim codebook codes what is said, and
 * is applied to a passage of the text rather than to the person saying it.
 */
export function SpeakerCodesMenu({
  transcriptionId,
  projectId,
  speakerId,
}: {
  transcriptionId: string;
  projectId?: string | null;
  speakerId: string;
}) {
  const t = useTranslations("codebook.speaker");
  const betaFeatures = useBetaFeatures();
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcription } = useTranscription(transcriptionId);
  const { openCreate } = useCodebookModal();
  const updateCodes = useUpdateSpeakerCodes(transcriptionId);

  const inScope = speakerCodebooks(
    codebooksInScopeForProject(codebooks, projectId),
  );

  const applied: SpeakerCodeRef[] = transcription?.speakerCodes ?? [];
  const isApplied = (codebookId: string, codeId: string) =>
    applied.some(
      (ref) =>
        ref.speakerId === speakerId &&
        ref.codebookId === codebookId &&
        ref.codeId === codeId,
    );
  // One speaker in one document: a code is either on it or not.
  const stateOf = (codebookId: string, codeId: string): CodeState =>
    isApplied(codebookId, codeId) ? "all" : "none";

  // The whole list is replaced on every toggle: the other speakers' codes
  // travel untouched, which is what keeps this a single write — and why nothing
  // is written before the document is loaded, which would post an empty list
  // over the codes already there.
  const toggle = (codebookId: string, codeId: string) => {
    if (!transcription) return;

    const next = isApplied(codebookId, codeId)
      ? applied.filter(
          (ref) =>
            !(
              ref.speakerId === speakerId &&
              ref.codebookId === codebookId &&
              ref.codeId === codeId
            ),
        )
      : [...applied, { speakerId, codebookId, codeId }];

    updateCodes.mutate(next, {
      onError: () => toast.error(t("failed")),
    });
  };

  // Codebooks are still beta: the entry stays out of the menu entirely for
  // users who have not opted in, rather than showing an empty picker.
  if (!betaFeatures) return null;

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
        <DropdownMenuItem onClick={() => openCreate(projectId, "speaker")}>
          <PlusIcon className="mr-2 h-3.5 w-3.5" />
          {t("create")}
        </DropdownMenuItem>
      ) : (
        <CodeCheckItems
          // A codebook with no readable name is one this device has no key for;
          // its codes still apply, so it keeps a header rather than vanishing.
          codebooks={inScope.map((c) =>
            c.name ? c : { ...c, name: t("untitled") },
          )}
          stateOf={stateOf}
          onToggle={toggle}
        />
      )}
    </DropdownMenuSub>
  );
}
