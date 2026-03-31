"use client";

import { Select } from "@/components/ui/select";
import { useProjects } from "@/hooks/use-api";
import { useProjectModal } from "./dialogs/project-create-modal";

type ProjectSelectorProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  value?: string;
  onChange: (projectId: string | undefined) => void;
  disabled?: boolean;
};

export function ProjectSelector({
  value,
  onChange,
  size,
  className,
  disabled,
}: ProjectSelectorProps) {
  const { data: projects = [] } = useProjects();
  const { openCreate } = useProjectModal();

  const options = [
    { label: "No Project", value: "none" },
    ...projects.map((project) => ({
      label: project.name,
      value: project.id,
    })),
    { label: "Create new project...", value: "__create_new__" },
  ];

  const handleChange = (newValue: string) => {
    if (newValue === "__create_new__") {
      openCreate((projectId) => {
        onChange(projectId);
      });
    } else {
      onChange(newValue === "none" ? undefined : newValue);
    }
  };

  return (
    <Select
      disabled={disabled}
      size={size}
      className={className}
      options={options}
      value={value || "none"}
      onChange={handleChange}
      placeholder="Select a project..."
      searchPlaceholder="Search projects..."
    />
  );
}
