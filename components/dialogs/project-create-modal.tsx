"use client";

import { Button } from "@/components/ui/button";
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
import {
  ProjectAppearancePicker,
  type AppearanceValue,
} from "@/components/projects/project-appearance-picker";
import { ProjectBadge } from "@/components/projects/project-badge";
import {
  DEFAULT_PROJECT_COLOR,
  DEFAULT_PROJECT_ICON,
} from "@/lib/projects/appearance";
import { useProjects } from "@/hooks/use-api";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "@/components/locale-provider";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
  ImageIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

export type ProjectModalData =
  | { mode: "create"; onSuccess?: (projectId: string) => void }
  | {
      mode: "rename";
      projectId: string;
      projectName: string;
      onSuccess?: (projectId: string) => void;
    };

// Project Modal
export function useProjectModal() {
  const modal = useModal<ProjectModalData>("project-modal");

  return {
    ...modal,
    openCreate: (onSuccess?: (projectId: string) => void) => {
      modal.open({ mode: "create", onSuccess });
    },
    openRename: (
      projectId: string,
      projectName: string,
      onSuccess?: (projectId: string) => void,
    ) => {
      modal.open({ mode: "rename", projectId, projectName, onSuccess });
    },
  };
}

const DEFAULT_APPEARANCE: AppearanceValue = {
  iconType: "icon",
  icon: DEFAULT_PROJECT_ICON,
  color: DEFAULT_PROJECT_COLOR,
};

export function ProjectCreateModal() {
  const { isOpen, data, close } = useProjectModal();
  const [projectName, setProjectName] = React.useState("");
  const [appearance, setAppearance] =
    React.useState<AppearanceValue>(DEFAULT_APPEARANCE);
  const [pendingImage, setPendingImage] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  // The modal has two views: the main settings form and a focused appearance
  // editor reached from the summary row (keeps the settings modal uncluttered).
  const [appearanceView, setAppearanceView] = React.useState(false);

  // Danger zone state.
  const [confirmingDelete, setConfirmingDelete] = React.useState(false);
  const [deleteMode, setDeleteMode] = React.useState<"move" | "delete">("move");
  const [moveTarget, setMoveTarget] = React.useState<string>("none");
  const [isDeleting, setIsDeleting] = React.useState(false);
  // Deleting the documents too is irreversible, so it's gated behind typing the
  // study name (the "move" path keeps the transcriptions and needs no typing).
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");

  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("dialog.project");

  const { data: projects = [] } = useProjects();
  const { data: transcriptions = [] } = useTranscriptions();

  const isEditMode = data?.mode === "rename";
  const project = isEditMode
    ? projects.find((p) => p.id === data.projectId)
    : undefined;

  const attachedCount = React.useMemo(
    () =>
      isEditMode
        ? transcriptions.filter(
            (tr) => tr.projectId === data.projectId && tr.isOwner !== false,
          ).length
        : 0,
    [transcriptions, isEditMode, data],
  );

  // Seed the form on the closed→open transition (render-phase reset, so it stays
  // React-Compiler-safe — no setState-in-effect).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    setConfirmingDelete(false);
    setDeleteMode("move");
    setMoveTarget("none");
    setDeleteConfirmText("");
    setPendingImage(null);
    setAppearanceView(false);
    if (data?.mode === "rename") {
      setProjectName(data.projectName);
      const p = projects.find((pr) => pr.id === data.projectId);
      setAppearance({
        iconType: (p?.iconType as AppearanceValue["iconType"]) ?? "icon",
        icon: p?.icon ?? DEFAULT_PROJECT_ICON,
        color: p?.color ?? DEFAULT_PROJECT_COLOR,
      });
    } else {
      setProjectName("");
      setAppearance(DEFAULT_APPEARANCE);
    }
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  // Only icon/emoji appearance is sent as JSON; images go to their own endpoint.
  const appearancePayload = () =>
    appearance.iconType === "image"
      ? {}
      : {
          iconType: appearance.iconType,
          icon: appearance.icon,
          color: appearance.color,
        };

  const uploadImage = async (projectId: string) => {
    if (!pendingImage) return;
    const form = new FormData();
    form.append("file", pendingImage);
    const res = await fetch(`/api/projects/${projectId}/image`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || t("errorImage"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast.error(t("errorEmpty"));
      return;
    }
    setIsSubmitting(true);
    try {
      if (data?.mode === "rename") {
        const response = await fetch(`/api/projects/${data.projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName.trim(),
            ...appearancePayload(),
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || t("errorRename"));
        }
        await uploadImage(data.projectId);
        toast.success(t("successRename"));
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
        data.onSuccess?.(data.projectId);
      } else {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName.trim(),
            ...appearancePayload(),
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || t("errorCreate"));
        }
        const created = await response.json();
        await uploadImage(created.id);
        toast.success(t("successCreate"));
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        data?.onSuccess?.(created.id);
      }
      close();
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : isEditMode
            ? t("errorRename")
            : t("errorCreate"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // The destructive "delete documents too" path requires the typed name to match.
  const needsTypedConfirm =
    isEditMode && deleteMode === "delete" && attachedCount > 0;
  const deleteConfirmed =
    !needsTypedConfirm ||
    deleteConfirmText.trim() === (project?.name ?? "").trim();

  const handleDelete = async () => {
    if (!isEditMode || !deleteConfirmed) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects/${data.projectId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: deleteMode,
          targetProjectId:
            deleteMode === "move" && moveTarget !== "none" ? moveTarget : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("errorDelete"));
      }
      toast.success(t("successDelete"));
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      close();
      // Leave the (now deleted) study page if we're on it.
      if (pathname === `/app/project/${data.projectId}`) router.push("/app");
    } catch (error) {
      console.error("Error deleting study:", error);
      toast.error(error instanceof Error ? error.message : t("errorDelete"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Other studies to move transcriptions into.
  const moveOptions = [
    { label: t("danger.unassigned"), value: "none" },
    ...projects
      .filter((p) => !isEditMode || p.id !== data.projectId)
      .map((p) => ({ label: p.name, value: p.id })),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent>
        {appearanceView ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={t("appearance.back")}
                  onClick={() => setAppearanceView(false)}
                  className="-ml-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <div className="space-y-1.5">
                  <DialogTitle>{t("appearance.title")}</DialogTitle>
                  <DialogDescription>
                    {t("appearance.description")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="px-6 pb-2">
              <ProjectAppearancePicker
                value={appearance}
                onChange={setAppearance}
                projectId={isEditMode ? data.projectId : undefined}
                hasExistingImage={project?.hasImage}
                imageVersion={project?.updatedAt}
                pendingImageFile={pendingImage}
                onPendingImageChange={setPendingImage}
              />
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => setAppearanceView(false)}>
                {t("appearance.done")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? t("editTitle") : t("createTitle")}
              </DialogTitle>
              <DialogDescription>
                {isEditMode ? t("editDescription") : t("createDescription")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-5 px-6">
                <div className="space-y-2">
                  <Label htmlFor="project-name">{t("label")}</Label>
                  <Input
                    id="project-name"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder={t("placeholder")}
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setAppearanceView(true)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-accent/40"
                >
                  <AppearancePreview
                    appearance={appearance}
                    pendingImage={pendingImage}
                    projectId={isEditMode ? data.projectId : undefined}
                    hasExistingImage={project?.hasImage}
                    imageVersion={project?.updatedAt}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {t("appearance.label")}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t("appearance.edit")}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>

                {isEditMode && (
                  <>
                    <Separator />
                    <div className="rounded-lg border border-destructive/30 p-4">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <h3 className="text-sm font-semibold">
                          {t("danger.title")}
                        </h3>
                      </div>

                      {!confirmingDelete ? (
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className="text-sm text-muted-foreground">
                            {t("danger.description")}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setConfirmingDelete(true)}
                          >
                            {t("danger.delete")}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-3">
                          <p className="text-sm text-muted-foreground">
                            {t("danger.attached", { count: attachedCount })}
                          </p>

                          <div className="space-y-2">
                            <DeleteChoice
                              checked={deleteMode === "move"}
                              onSelect={() => setDeleteMode("move")}
                              title={t("danger.moveTitle")}
                              description={t("danger.moveDescription")}
                            />
                            {deleteMode === "move" && (
                              <div className="pl-6">
                                <Select
                                  options={moveOptions}
                                  value={moveTarget}
                                  onChange={setMoveTarget}
                                />
                              </div>
                            )}
                            <DeleteChoice
                              checked={deleteMode === "delete"}
                              onSelect={() => setDeleteMode("delete")}
                              title={t("danger.deleteTitle")}
                              description={t("danger.deleteDescription", {
                                count: attachedCount,
                              })}
                              danger
                            />
                          </div>

                          {needsTypedConfirm && (
                            <div className="space-y-1.5">
                              <Label
                                htmlFor="delete-confirm"
                                className="text-xs font-normal text-muted-foreground"
                              >
                                {t("danger.confirmPrompt", {
                                  name: project?.name ?? "",
                                })}
                              </Label>
                              <Input
                                id="delete-confirm"
                                value={deleteConfirmText}
                                onChange={(e) =>
                                  setDeleteConfirmText(e.target.value)
                                }
                                placeholder={project?.name ?? ""}
                                autoComplete="off"
                              />
                            </div>
                          )}

                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setConfirmingDelete(false)}
                              disabled={isDeleting}
                            >
                              {t("cancel")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={handleDelete}
                              disabled={isDeleting || !deleteConfirmed}
                            >
                              {isDeleting
                                ? t("danger.deleting")
                                : t("danger.confirm")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={close}
                  disabled={isSubmitting}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? isEditMode
                      ? t("renaming")
                      : t("creating")
                    : isEditMode
                      ? t("save")
                      : t("create")}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The badge shown in the settings summary row: mirrors the live appearance,
 * including a not-yet-uploaded image (previewed from an object URL).
 */
function AppearancePreview({
  appearance,
  pendingImage,
  projectId,
  hasExistingImage,
  imageVersion,
}: {
  appearance: AppearanceValue;
  pendingImage: File | null;
  projectId?: string;
  hasExistingImage?: boolean;
  imageVersion?: string | number;
}) {
  const url = React.useMemo(
    () => (pendingImage ? URL.createObjectURL(pendingImage) : null),
    [pendingImage],
  );
  React.useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  if (appearance.iconType === "image") {
    const src =
      url ??
      (hasExistingImage && projectId
        ? `/api/projects/${projectId}/image${imageVersion ? `?v=${imageVersion}` : ""}`
        : null);
    if (src) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
      );
    }
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed text-muted-foreground">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <ProjectBadge
      appearance={{
        iconType: appearance.iconType,
        icon: appearance.icon,
        color: appearance.color,
        hasImage: false,
      }}
      projectId={projectId ?? ""}
      size="lg"
    />
  );
}

function DeleteChoice({
  checked,
  onSelect,
  title,
  description,
  danger,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors",
        checked
          ? danger
            ? "border-destructive bg-destructive/5"
            : "border-primary bg-accent/50"
          : "hover:bg-accent/40",
      ].join(" ")}
    >
      <span
        className={[
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          checked
            ? danger
              ? "border-destructive"
              : "border-primary"
            : "border-muted-foreground/40",
        ].join(" ")}
      >
        {checked && (
          <span
            className={[
              "h-2 w-2 rounded-full",
              danger ? "bg-destructive" : "bg-primary",
            ].join(" ")}
          />
        )}
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </button>
  );
}
