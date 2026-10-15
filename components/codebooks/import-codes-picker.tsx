"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { CodeChips, CodeCheckItems } from "@/components/codebooks/code-picker";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/utils";
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
import { ChevronDownIcon, PlusIcon, TagsIcon } from "lucide-react";

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
 * A menu rather than every code laid out: a form with five files and three
 * codebooks would otherwise be mostly badges. Only the picked codes show, as
 * badges on the trigger. `compact` drops the label, hint and empty state, for
 * the row of each uploaded file.
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

  // Only what is picked is shown; the rest waits in the menu.
  const picker = (
    <DropdownMenu
      align="start"
      position="bottom"
      trigger={
        <span
          className={cn(
            "inline-flex min-h-7 cursor-pointer flex-wrap items-center gap-1 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-label={t("import.label")}
        >
          <TagsIcon className="h-3.5 w-3.5 shrink-0" />
          {value.length > 0 ? (
            <CodeChips refs={value} codebooks={withCodes} solid />
          ) : (
            <span>{t("import.add")}</span>
          )}
          <ChevronDownIcon className="h-3 w-3 shrink-0" />
        </span>
      }
    >
      <CodeCheckItems
        codebooks={withCodes.map((c) =>
          c.name ? c : { ...c, name: t("document.untitled") },
        )}
        stateOf={(codebookId, codeId) =>
          isOn(codebookId, codeId) ? "all" : "none"
        }
        onToggle={toggle}
      />
    </DropdownMenu>
  );

  if (compact) return picker;

  return (
    <div className="space-y-2">
      <Label>{t("import.label")}</Label>
      <div>{picker}</div>
      <p className="text-xs text-muted-foreground">{t("import.hint")}</p>
    </div>
  );
}
