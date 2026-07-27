"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { GuideCallout } from "@/components/guidance/guide-callout";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { useCodebooks } from "@/hooks/use-codebooks";
import {
  codebooksInScopeForProject,
  flattenCodes,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { BookMarkedIcon, PlusIcon } from "lucide-react";

/**
 * The codebooks available from a study: those attached to it, plus the ones
 * covering every study.
 */
export function CodebookSection({ projectId }: { projectId: string }) {
  const t = useTranslations("codebook");
  const { data: codebooks = [], isLoading } = useCodebooks();
  const { openCreate, openEdit } = useCodebookModal();

  const inScope = codebooksInScopeForProject(codebooks, projectId);

  const renderCodebook = (codebook: DecryptedCodebook) => (
    <button
      key={codebook.id}
      type="button"
      onClick={() => openEdit(codebook.id)}
      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
    >
      <BookMarkedIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {codebook.name || (
            <span className="text-muted-foreground">{t("section.locked")}</span>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          {codebook.allStudies
            ? t("section.allStudies")
            : t("section.studyCount", { count: codebook.studyIds.length })}
          {" · "}
          {/* Sub-codes count too — they are codes of this codebook. */}
          {t("section.codeCount", {
            count: flattenCodes(codebook.codes).length,
          })}
        </span>
      </span>
    </button>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          {t("section.title", { count: inScope.length })}
        </h2>
        {/* Presets live inside the creation dialog, as cards — no separate entry
            point here. */}
        <Button size="sm" onClick={() => openCreate(projectId)}>
          <PlusIcon className="h-4 w-4" />
          {t("section.create")}
        </Button>
      </div>

      {!isLoading && inScope.length === 0 ? (
        <GuideCallout
          icon={<BookMarkedIcon className="h-5 w-5" />}
          title={t("section.empty.title")}
          description={t("section.empty.description")}
          action={{
            label: t("section.empty.action"),
            onClick: () => openCreate(projectId),
            icon: <PlusIcon className="h-4 w-4" />,
          }}
        />
      ) : (
        <div className="space-y-2">
          {inScope.map((codebook) => renderCodebook(codebook))}
        </div>
      )}
    </section>
  );
}
