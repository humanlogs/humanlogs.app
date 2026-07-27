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
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CornerDownRightIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
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

  const existing = data?.codebookId
    ? codebooks.find((c) => c.id === data.codebookId)
    : undefined;

  const [name, setName] = React.useState("");
  const [codes, setCodes] = React.useState<Code[]>([]);
  const [allStudies, setAllStudies] = React.useState(false);
  const [studyIds, setStudyIds] = React.useState<string[]>([]);
  const [target, setTarget] = React.useState<CodebookTarget>(
    DEFAULT_CODEBOOK_TARGET,
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  // Creation opens on the preset picker; editing goes straight to the form.
  const [step, setStep] = React.useState<"preset" | "form">("preset");

  // Seed the form on the closed→open transition, like the study modal does:
  // a render-phase reset rather than a setState inside an effect.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setIsSubmitting(false);
    setConfirmingDelete(false);
    setStep(existing ? "form" : "preset");
    if (existing) {
      setName(existing.name);
      setCodes(existing.codes);
      setAllStudies(existing.allStudies);
      setStudyIds(existing.studyIds);
      setTarget(existing.target);
    } else {
      setName("");
      setCodes([{ id: newCodeId(), label: "" }]);
      setAllStudies(false);
      setStudyIds(data?.projectId ? [data.projectId] : []);
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

  // The three edits below rebuild the tree rather than mutating it, so a code
  // at any depth is handled by the same call — sub-codes are just `children`.
  const mapTree = (
    list: Code[],
    id: string,
    fn: (code: Code) => Code,
  ): Code[] =>
    list.map((code) =>
      code.id === id
        ? fn(code)
        : { ...code, children: mapTree(code.children ?? [], id, fn) },
    );

  const updateCode = (id: string, patch: Partial<Code>) => {
    setCodes((current) => mapTree(current, id, (code) => ({ ...code, ...patch })));
  };

  const addSubCode = (id: string) => {
    setCodes((current) =>
      mapTree(current, id, (code) => ({
        ...code,
        children: [...(code.children ?? []), { id: newCodeId(), label: "" }],
      })),
    );
  };

  /** Removing a code removes its sub-codes with it. */
  const removeCode = (id: string) => {
    const prune = (list: Code[]): Code[] =>
      list
        .filter((code) => code.id !== id)
        .map((code) =>
          code.children
            ? { ...code, children: prune(code.children) }
            : code,
        );
    setCodes((current) => prune(current));
  };

  /**
   * A preset only fills the form — nothing is written until the researcher
   * saves, so every label can still be corrected first. Code ids are minted
   * here, never taken from the preset: they must carry no meaning.
   */
  const applyPreset = (preset: CodebookPreset) => {
    setName(preset.name);
    setCodes(
      preset.codes.map((code) => ({
        id: newCodeId(),
        label: code.label,
        color: code.color,
        description: code.description,
      })),
    );
    setTarget(preset.target);
    setStep("form");
  };

  const handleSubmit = async () => {
    // An unlabelled code is a row the researcher started and left blank; it goes
    // with its sub-codes, which would otherwise hang off nothing.
    const cleanTree = (list: Code[]): Code[] =>
      list
        .map((code) => ({ ...code, label: code.label.trim() }))
        .filter((code) => code.label.length > 0)
        .map(({ children, ...code }) => {
          const cleanedChildren = cleanTree(children ?? []);
          return cleanedChildren.length > 0
            ? { ...code, children: cleanedChildren }
            : code;
        });

    const cleanCodes = cleanTree(codes);

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
          target,
        });
      } else {
        await createCodebook.mutateAsync({
          name: name.trim(),
          codes: cleanCodes,
          allStudies,
          studyIds: allStudies ? [] : studyIds,
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

  /**
   * One row per code, its sub-codes nested underneath. The same row handles
   * every depth — that is the point of holding the hierarchy in the codes
   * rather than in a tree of codebooks.
   */
  const renderCode = (code: Code, depth = 0): React.ReactNode => (
    <div key={code.id} className="space-y-2">
      <div
        className="flex items-center gap-1"
        style={{ paddingLeft: depth * 20 }}
      >
        <Input
          value={code.label}
          onChange={(e) => updateCode(code.id, { label: e.target.value })}
          placeholder={t("codePlaceholder")}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("addSubCode")}
          title={t("addSubCode")}
          onClick={() => addSubCode(code.id)}
        >
          <CornerDownRightIcon className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("removeCode")}
          onClick={() => removeCode(code.id)}
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
      {(code.children ?? []).map((child) => renderCode(child, depth + 1))}
    </div>
  );

  // Step one of a creation: pick a preset to prefill the form, or skip it.
  if (isOpen && step === "preset") {
    return (
      <Dialog open={isOpen} onOpenChange={close}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tPreset("title")}</DialogTitle>
            <DialogDescription>{tPreset("description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 px-6 pb-6">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors hover:bg-accent"
            >
              {tPreset("manual")}
              <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <div className="grid gap-2 sm:grid-cols-2">
              {CODEBOOK_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-lg border p-3 text-left transition-colors hover:bg-accent"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <SparklesIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{preset.name}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t("codes")} · {preset.codes.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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

          <Separator />

          <div className="space-y-2">
            <Label>{t("codes")}</Label>
            <div className="space-y-2">{codes.map((code) => renderCode(code))}</div>
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
          {!existing && (
            <Button
              variant="ghost"
              onClick={() => setStep("preset")}
              disabled={isSubmitting}
              className="sm:mr-auto"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              {tPreset("back")}
            </Button>
          )}
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
