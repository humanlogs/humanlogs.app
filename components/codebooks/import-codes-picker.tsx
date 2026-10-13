"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { colorClass } from "@/components/codebooks/code-picker";
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
import { cn } from "@/lib/utils/utils";
import { CheckIcon, PlusIcon } from "lucide-react";

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
 * so they are picked on the upload form rather than in a second pass.
 *
 * Codes are pills, a click each — the same gesture as a cell of the study
 * coding board, without a menu to open.
 */
export function ImportCodesPicker({
  projectId,
  value,
  onChange,
  disabled,
}: {
  projectId: string | null | undefined;
  value: CodeRef[];
  onChange: (value: CodeRef[]) => void;
  disabled?: boolean;
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

  return (
    <div className="space-y-2">
      <Label>{t("import.label")}</Label>
      {withCodes.length === 0 ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => openCreate(projectId, "speaker")}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {t("document.create")}
        </button>
      ) : (
        <>
          <div className="space-y-2">
            {withCodes.map((codebook) => (
              <div key={codebook.id} className="space-y-1">
                {withCodes.length > 1 && (
                  <p className="text-xs font-medium text-muted-foreground">
                    {codebook.name || t("document.untitled")}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {flattenCodes(codebook.codes).map(({ code, path }) => {
                    const on = isOn(codebook.id, code.id);
                    return (
                      <button
                        key={code.id}
                        type="button"
                        disabled={disabled}
                        aria-pressed={on}
                        title={[...path, code.label].join(" › ")}
                        onClick={() => toggle(codebook.id, code.id)}
                        className={cn(
                          "inline-flex h-7 max-w-[14rem] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors disabled:opacity-50",
                          on
                            ? cn(
                                colorClass(code),
                                "border-transparent text-white",
                              )
                            : "hover:bg-accent",
                        )}
                      >
                        {on ? (
                          <CheckIcon className="h-3 w-3 shrink-0" />
                        ) : (
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              colorClass(code),
                            )}
                          />
                        )}
                        <span className="truncate">{code.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("import.hint")}</p>
        </>
      )}
    </div>
  );
}
