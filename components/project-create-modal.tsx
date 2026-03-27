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
import { useModal } from "@/components/use-modal";
import { useQueryClient } from "@tanstack/react-query";
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

export function ProjectCreateModal() {
  const { isOpen, data, close } = useProjectModal();
  const [projectName, setProjectName] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const queryClient = useQueryClient();

  const isRenameMode = data?.mode === "rename";

  // Update projectName when modal opens
  React.useEffect(() => {
    if (isOpen && data?.mode === "rename") {
      setProjectName(data.projectName);
    } else if (isOpen && data?.mode === "create") {
      setProjectName("");
    }
  }, [isOpen, data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }

    setIsSubmitting(true);

    try {
      if (data?.mode === "rename") {
        // Rename existing project
        const response = await fetch(`/api/projects/${data.projectId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: projectName.trim() }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to rename project");
        }

        const project = await response.json();
        toast.success("Project renamed successfully!");

        // Invalidate queries to refresh
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["transcriptions"] });

        data.onSuccess?.(project.id);
      } else {
        // Create new project
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: projectName.trim() }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to create project");
        }

        const project = await response.json();
        toast.success("Project created successfully!");

        // Invalidate projects query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["projects"] });

        data?.onSuccess?.(project.id);
      }

      // Reset form and close modal
      setProjectName("");
      close();
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${isRenameMode ? "rename" : "create"} project`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRenameMode ? "Rename Project" : "Create New Project"}
          </DialogTitle>
          <DialogDescription>
            {isRenameMode
              ? "Enter a new name for your project."
              : "Enter a name for your new project. You can organize your transcriptions by project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-6">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., Marketing Videos"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isRenameMode
                  ? "Renaming..."
                  : "Creating..."
                : isRenameMode
                  ? "Rename Project"
                  : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
