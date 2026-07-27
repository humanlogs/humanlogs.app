"use client";

import { useCodebookModal } from "@/components/codebooks/codebook-editor-dialog";
import { GuideCallout } from "@/components/guidance/guide-callout";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useCodebooks, useCreateCodebookFromPreset } from "@/hooks/use-codebooks";
import {
  codebooksInScopeForProject,
  type DecryptedCodebook,
} from "@/lib/codebooks/codebook";
import { CODEBOOK_PRESETS } from "@/lib/codebooks/presets";
import { BookMarkedIcon, PlusIcon, SparklesIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

/**
 * The codebooks available from a study: those attached to it, plus the ones
 * covering every study. Children are nested under their parent.
 */
export function CodebookSection({ projectId }: { projectId: string }) {
  const t = useTranslations("codebook");
  const { data: codebooks = [], isLoading } = useCodebooks();
  const { openCreate, openEdit } = useCodebookModal();
  const createFromPreset = useCreateCodebookFromPreset();

  const inScope = codebooksInScopeForProject(codebooks, projectId);
  const roots = inScope.filter(
    (c) => !c.parentId || !inScope.some((other) => other.id === c.parentId),
  );
  const childrenOf = (id: string) => inScope.filter((c) => c.parentId === id);

  const handlePreset = async (presetKey: string) => {
    const preset = CODEBOOK_PRESETS.find((p) => p.key === presetKey);
    if (!preset) return;
    try {
      await createFromPreset.mutateAsync(preset);
    } catch (error) {
      console.error("Failed to create codebook from preset", error);
      toast.error(t("editor.errors.failed"));
    }
  };

  const renderCodebook = (codebook: DecryptedCodebook, depth = 0) => (
    <React.Fragment key={codebook.id}>
      <button
        type="button"
        onClick={() => openEdit(codebook.id)}
        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
        style={{ marginLeft: depth * 16, width: `calc(100% - ${depth * 16}px)` }}
      >
        <BookMarkedIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {codebook.name || (
              <span className="text-muted-foreground">
                {t("section.locked")}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">
            {codebook.allStudies
              ? t("section.allStudies")
              : t("section.studyCount", { count: codebook.studyIds.length })}
            {" · "}
            {t("section.codeCount", { count: codebook.codes.length })}
          </span>
        </span>
      </button>
      {childrenOf(codebook.id).map((child) => renderCodebook(child, depth + 1))}
    </React.Fragment>
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
          {roots.map((codebook) => renderCodebook(codebook))}
        </div>
      )}
    </section>
  );
}
