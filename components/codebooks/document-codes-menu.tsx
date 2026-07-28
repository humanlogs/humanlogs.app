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
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  useTranscription,
  useUpdateDocumentCodes,
} from "@/hooks/use-transcriptions";
import {
  codebooksInScopeForProject,
  speakerCodebooks,
  type CodeRef,
} from "@/lib/codebooks/codebook";
import { PlusIcon, TagsIcon } from "lucide-react";
import { toast } from "sonner";

/**
 * The codes carried by the document as a whole, as a submenu of the document's
 * own menu — the counterpart of the speaker badge submenu, one level up.
 *
 * Same codebooks as the speakers: a speaker codebook codes the people *and* the
 * interview they are in, the interview being the coarsest of the two.
 */
export function DocumentCodesMenu({
  transcriptionId,
  projectId,
}: {
  transcriptionId: string;
  projectId?: string | null;
}) {
  const t = useTranslations("codebook.document");
  const { data: codebooks = [] } = useCodebooks();
  const { data: transcription } = useTranscription(transcriptionId);
  const { openCreate } = useCodebookModal();
  const updateCodes = useUpdateDocumentCodes(transcriptionId);

  const inScope = speakerCodebooks(
    codebooksInScopeForProject(codebooks, projectId),
  );

  const applied: CodeRef[] = transcription?.codes ?? [];
  const stateOf = (codebookId: string, codeId: string): CodeState =>
    applied.some(
      (ref) => ref.codebookId === codebookId && ref.codeId === codeId,
    )
      ? "all"
      : "none";

  const toggle = (codebookId: string, codeId: string) => {
    // Nothing is written before the document is loaded: an empty list would go
    // over the codes already there.
    if (!transcription) return;

    const next =
      stateOf(codebookId, codeId) === "all"
        ? applied.filter(
            (ref) => !(ref.codebookId === codebookId && ref.codeId === codeId),
          )
        : [...applied, { codebookId, codeId }];

    updateCodes.mutate(next, { onError: () => toast.error(t("failed")) });
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
        <DropdownMenuItem onClick={() => openCreate(projectId, "speaker")}>
          <PlusIcon className="mr-2 h-3.5 w-3.5" />
          {t("create")}
        </DropdownMenuItem>
      ) : (
        <CodeCheckItems
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
