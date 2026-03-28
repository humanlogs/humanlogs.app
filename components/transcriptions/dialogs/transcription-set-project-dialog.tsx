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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useModal } from "../../use-modal";
import { useProjectModal } from "../../project-create-modal";

export type TranscriptionSetProjectModalData = {
  transcriptionId: string;
  currentProjectId?: string;
};

export function useTranscriptionSetProjectModal() {
  const modal = useModal<TranscriptionSetProjectModalData>(
    "transcription-set-project-modal",
  );

  return {
    ...modal,
    openSetProject: (transcriptionId: string, currentProjectId?: string) => {
      modal.open({ transcriptionId, currentProjectId });
    },
  };
}

export function TranscriptionSetProjectDialog() {
  const { isOpen, data, close } = useTranscriptionSetProjectModal();
  const [projectId, setProjectId] = React.useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const queryClient = useQueryClient();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const { openCreate } = useProjectModal();

  // Update the project ID when modal opens
  React.useEffect(() => {
    if (isOpen && data) {
      setProjectId(data.currentProjectId);
    }
  }, [isOpen, data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!data) return;

    if (projectId === data.currentProjectId) {
      close();
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/transcriptions/${data.transcriptionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ projectId: projectId || null }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update project");
      }

      toast.success(
        projectId ? "Project updated successfully!" : "Project removed",
      );

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      queryClient.invalidateQueries({
        queryKey: ["transcription", data.transcriptionId],
      });

      close();
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update project",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Project</DialogTitle>
            <DialogDescription>
              Assign this transcription to a project to keep your work
              organized.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 px-6">
              <div className="space-y-2">
                <Label htmlFor="project">Project</Label>
                <div className="flex gap-2">
                  <Select
                    options={[
                      { label: "No Project", value: "none" },
                      ...(projects?.map((project) => ({
                        label: project.name,
                        value: project.id,
                      })) || []),
                    ]}
                    value={projectId || "none"}
                    onChange={(value) =>
                      setProjectId(value === "none" ? undefined : value)
                    }
                    disabled={projectsLoading}
                    placeholder="Select a project..."
                    searchPlaceholder="Search projects..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      openCreate((newProjectId) => {
                        setProjectId(newProjectId);
                      });
                    }}
                    title="Create new project"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </Button>
                </div>
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
              <Button type="submit" variant={"primary"} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
