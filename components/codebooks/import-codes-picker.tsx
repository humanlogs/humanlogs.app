"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { CodeToggle } from "@/components/codebooks/code-picker";
import { useTranslations } from "@/components/locale-provider";
import { Label } from "@/components/ui/label";
import { useBetaFeatures } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  codebooksInScopeForProject,
  flattenCodes,
  speakerCodebooks,
  type CodeRef,
} from "@/lib/codebooks/codebook";
import { PlusIcon, TagsIcon } from "lucide-react";

/**
 * The codebooks a new document can be coded with: document-and-people ones in
 * scope for the study it goes into. Exported so the forms drop, at submit, the
 * refs a change of study took out of scope.
 */
export function useImportCodebooks(projectId: string | null | undefined) {
  const { data: codebooks = [] } = useCodebooks();
  return speakerCodebooks(codebooksInScopeForProject(codebooks, projectId));
}

/** Only the refs still offered — the study may have changed since they were picked. */
export function keepInScope(
  refs: CodeRef[],
  codebooks: Array<{ id: string }>,
): CodeRef[] {
  const ids = new Set(codebooks.map((c) => c.id));
  return refs.filter((ref) => ids.has(ref.codebookId));
}

/**
 * Coding a document as it comes in: the codes that describe the interview as a
 * whole (site, wave, interview type…) are known before it is even transcribed,
 * so they are picked on the upload form rather than in a second pass — per
 * document, since a batch of files is rarely a batch of identical interviews.
 *
 * Codes are pills in their own colour, a click each — the same switch as a cell
 * of the study coding board, without a menu to open. `compact` drops the label,
 * hint and empty state, for the row of each uploaded file.
 */
export function ImportCodesPicker({
  projectId,
  value,
  onChange,
  disabled,
  compact,
}: {
  projectId: string | null | undefined;
  value: CodeRef[];
  onChange: (value: CodeRef[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("codebook");
  const betaFeatures = useBetaFeatures();
  const { openCreate } = useCodebookModal();
  const inScope = useImportCodebooks(projectId);

  // Same beta gate as the rest of the codebooks.
  if (!betaFeatures) return null;

  const isOn = (codebookId: string, codeId: string) =>
    value.some((ref) => ref.codebookId === codebookId && ref.codeId === codeId);

  const toggle = (codebookId: string, codeId: string) =>
    onChange(
      isOn(codebookId, codeId)
        ? value.filter(
            (ref) => !(ref.codebookId === codebookId && ref.codeId === codeId),
          )
        : [...value, { codebookId, codeId }],
    );

  const withCodes = inScope.filter((c) => flattenCodes(c.codes).length > 0);

  if (withCodes.length === 0) {
    if (compact) return null;
    return (
      <div className="space-y-2">
        <Label>{t("import.label")}</Label>
        <button
          type="button"
          disabled={disabled}
          onClick={() => openCreate(projectId, "speaker")}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {t("document.create")}
        </button>
      </div>
    );
  }

  const pills = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {withCodes.map((codebook) => (
        <div key={codebook.id} className="flex flex-wrap items-center gap-1.5">
          {withCodes.length > 1 && (
            <span className="text-xs text-muted-foreground">
              {codebook.name || t("document.untitled")}
            </span>
          )}
          {flattenCodes(codebook.codes).map(({ code, path }) => (
            <CodeToggle
              key={code.id}
              code={code}
              state={isOn(codebook.id, code.id) ? "all" : "none"}
              label={[...path, code.label].join(" › ")}
              disabled={disabled}
              onToggle={() => toggle(codebook.id, code.id)}
              className="h-7 max-w-[14rem] rounded-full px-2.5 text-xs"
            >
              <span className="truncate">{code.label}</span>
            </CodeToggle>
          ))}
        </div>
      ))}
    </div>
  );

  if (compact) {
    return (
      <div className="flex items-start gap-2">
        <TagsIcon
          className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-label={t("import.label")}
        />
        {pills}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{t("import.label")}</Label>
      {pills}
      <p className="text-xs text-muted-foreground">{t("import.hint")}</p>
    </div>
  );
}
