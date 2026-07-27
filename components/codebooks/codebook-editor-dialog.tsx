"use client";

import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useModal } from "@/components/use-modal";
import { useProjects } from "@/hooks/use-api";
import {
  newCodeId,
  useCodebooks,
  useCreateCodebook,
  useCreateCodebookFromPreset,
  useDeleteCodebook,
  useUpdateCodebook,
} from "@/hooks/use-codebooks";
import {
  CODEBOOK_TARGETS,
  DEFAULT_CODEBOOK_TARGET,
  type Code,
  type CodebookTarget,
} from "@/lib/codebooks/codebook";
import {
  CODEBOOK_PRESETS,
  type CodebookPreset,
} from "@/lib/codebooks/presets";
import { PlusIcon, SparklesIcon, Trash2Icon, XIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

export type CodebookModalData = {
  /** Editing an existing codebook, or creating one when absent. */
  codebookId?: string;
  /** Study pre-selected when creating from a study page. */
  projectId?: string;
};

export function useCodebookModal() {
  const modal = useModal<CodebookModalData>("codebook-modal");

  return {
    ...modal,
    openCreate: (projectId?: string) => modal.open({ projectId }),
    openEdit: (codebookId: string) => modal.open({ codebookId }),
  };
}

export function CodebookEditorDialog() {
  const { isOpen, data, close } = useCodebookModal();
  const t = useTranslations("codebook.editor");

  const tPreset = useTranslations("codebook.presets");

  const { data: projects = [] } = useProjects();
  const { data: codebooks = [] } = useCodebooks();
  const createCodebook = useCreateCodebook();
  const updateCodebook = useUpdateCodebook();
  const deleteCodebook = useDeleteCodebook();
  const createFromPreset = useCreateCodebookFromPreset();

  const existing = data?.codebookId
    ? codebooks.find((c) => c.id === data.codebookId)
    : undefined;

  const [name, setName] = React.useState("");
  const [codes, setCodes] = React.useState<Code[]>([]);
  const [allStudies, setAllStudies] = React.useState(false);
  const [studyIds, setStudyIds] = React.useState<string[]>([]);
  const [parentId, setParentId] = React.useState<string>("");
  const [target, setTarget] = React.useState<CodebookTarget>(
    DEFAULT_CODEBOOK_TARGET,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);

  // Seed the form on the closed→open transition, like the study modal does:
  // a render-phase reset rather than a setState inside an effect.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setIsSubmitting(false);
    setConfirmingDelete(false);
    if (existing) {
      setName(existing.name);
      setCodes(existing.codes);
      setAllStudies(existing.allStudies);
      setStudyIds(existing.studyIds);
      setParentId(existing.parentId ?? "");
      setTarget(existing.target);
    } else {
      setName("");
      setCodes([{ id: newCodeId(), label: "" }]);
      setAllStudies(false);
      setStudyIds(data?.projectId ? [data.projectId] : []);
      setParentId("");
      setTarget(DEFAULT_CODEBOOK_TARGET);
    }
  }
  if (!isOpen && wasOpen) setWasOpen(false);

  const toggleStudy = (projectId: string) => {
    setStudyIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [...current, projectId],
    );
  };

  const updateCode = (id: string, patch: Partial<Code>) => {
    setCodes((current) =>
      current.map((code) => (code.id === id ? { ...code, ...patch } : code)),
    );
  };

  /**
   * Presets are created whole — a preset can hold a tree of codebooks, which no
   * single form could represent — and always cover every study, as agreed. The
   * result is editable right after, from the same dialog.
   */
  const applyPreset = async (preset: CodebookPreset) => {
    setIsSubmitting(true);
    try {
      await createFromPreset.mutateAsync(preset);
      close();
    } catch (error) {
      console.error("Failed to create codebook from preset", error);
      toast.error(t("errors.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    const cleanCodes = codes
      .map((code) => ({ ...code, label: code.label.trim() }))
      .filter((code) => code.label.length > 0);

    if (!name.trim()) {
      toast.error(t("errors.nameRequired"));
      return;
    }
    if (!allStudies && studyIds.length === 0) {
      toast.error(t("errors.scopeRequired"));
      return;
    }
    if (cleanCodes.length === 0) {
      toast.error(t("errors.codeRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (existing) {
        await updateCodebook.mutateAsync({
          id: existing.id,
          name: name.trim(),
          codes: cleanCodes,
          allStudies,
          studyIds: allStudies ? [] : studyIds,
          parentId: parentId || null,
          target,
        });
      } else {
        await createCodebook.mutateAsync({
          name: name.trim(),
          codes: cleanCodes,
          allStudies,
          studyIds: allStudies ? [] : studyIds,
          parentId: parentId || null,
          target,
        });
      }
      close();
    } catch (error) {
      console.error("Failed to save codebook", error);
      toast.error(
        error instanceof Error ? error.message : t("errors.failed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    setIsSubmitting(true);
    try {
      await deleteCodebook.mutateAsync(existing.id);
      close();
    } catch (error) {
      console.error("Failed to delete codebook", error);
      toast.error(t("errors.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // A codebook cannot be its own parent; deeper cycles are refused server-side.
  const parentOptions = [
    { value: "", label: t("noParent") },
    ...codebooks
      .filter((c) => c.id !== existing?.id)
      .map((c) => ({ value: c.id, label: c.name || c.id.slice(0, 8) })),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {existing ? t("editTitle") : t("createTitle")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {/* DialogContent has no padding of its own — only the header and footer
            carry it, so the body supplies its own. */}
        <div className="space-y-4 px-6">
          {!existing && (
            <div className="space-y-2">
              <Label>{tPreset("title")}</Label>
              <p className="text-xs text-muted-foreground">
                {tPreset("description")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {CODEBOOK_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    disabled={isSubmitting}
                    className="rounded-lg border p-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <SparklesIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{preset.label}</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {preset.description}
                    </span>
                    {preset.draft && (
                      <span className="mt-1 block text-xs text-amber-600">
                        {tPreset("draft")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="codebook-name">{t("name")}</Label>
            <Input
              id="codebook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("scope")}</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={allStudies}
                onCheckedChange={(checked) => setAllStudies(checked === true)}
              />
              {t("scopeAll")}
            </label>
            {!allStudies && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={studyIds.includes(project.id)}
                      onCheckedChange={() => toggleStudy(project.id)}
                    />
                    <span className="truncate">{project.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("parent")}</Label>
              <Select
                options={parentOptions}
                value={parentId}
                onChange={setParentId}
                placeholder={t("noParent")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("target")}</Label>
              <Select
                options={CODEBOOK_TARGETS.map((value) => ({
                  value,
                  label: t(`targets.${value}`),
                }))}
                value={target}
                onChange={(value) => setTarget(value as CodebookTarget)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>{t("codes")}</Label>
            <div className="space-y-2">
              {codes.map((code) => (
                <div key={code.id} className="flex items-center gap-2">
                  <Input
                    value={code.label}
                    onChange={(e) =>
                      updateCode(code.id, { label: e.target.value })
                    }
                    placeholder={t("codePlaceholder")}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeCode")}
                    onClick={() =>
                      setCodes((current) =>
                        current.filter((c) => c.id !== code.id),
                      )
                    }
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setCodes((current) => [
                  ...current,
                  { id: newCodeId(), label: "" },
                ])
              }
            >
              <PlusIcon className="h-4 w-4" />
              {t("addCode")}
            </Button>
          </div>

          {existing && (
            <>
              <Separator />
              {confirmingDelete ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("deleteConfirm")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isSubmitting}
                    >
                      {t("delete")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDelete(false)}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2Icon className="h-4 w-4" />
                  {t("delete")}
                </Button>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={isSubmitting}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
