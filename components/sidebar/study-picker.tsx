"use client";

import { useTranslations } from "@/components/locale-provider";
import { ProjectBadge } from "@/components/projects/project-badge";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/hooks/use-api";
import {
  STUDY_SCOPE_ALL,
  STUDY_SCOPE_NONE,
  type StudyScope,
} from "@/lib/documents/grouping";
import { cn } from "@/lib/utils/utils";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  FoldersIcon,
  PlusIcon,
} from "lucide-react";
import Link from "next/link";

/**
 * The study the sidebar is scoped to — the tab of the folder everything below
 * lives in.
 *
 * It is a tab and not a row in the list, because it is not one of the things
 * being listed: it says which corpus the phases, the groups and the counts
 * underneath are about. A researcher is rarely in two studies at once, so this
 * is the first choice made and the last one changed.
 */
export function StudyPicker({
  scope,
  studies,
  documentCount,
  onChange,
}: {
  scope: StudyScope;
  /** Every study reachable from the document list, own or received. */
  studies: Project[];
  documentCount: number;
  onChange: (scope: StudyScope) => void;
}) {
  const t = useTranslations("sidebar");
  const selected = studies.find((s) => s.id === scope) ?? null;

  const label =
    scope === STUDY_SCOPE_ALL
      ? t("study.all")
      : scope === STUDY_SCOPE_NONE
        ? t("study.none")
        : (selected?.name ?? t("study.all"));

  return (
    <div className="group/study flex items-center gap-1 border-b bg-sidebar-accent/40 px-2 py-1.5">
      <DropdownMenu
        align="start"
        position="bottom"
        trigger={
          <span className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-sidebar-accent">
            {selected ? (
              <ProjectBadge
                appearance={selected}
                projectId={selected.id}
                name={selected.name}
                size="xs"
                imageVersion={selected.updatedAt}
              />
            ) : (
              <FoldersIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {label}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-sidebar-foreground/50">
              {documentCount}
            </span>
            <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-sidebar-foreground/60" />
          </span>
        }
      >
        <ScopeItem
          active={scope === STUDY_SCOPE_ALL}
          label={t("study.all")}
          onClick={() => onChange(STUDY_SCOPE_ALL)}
        />
        {studies.length > 0 && <DropdownMenuSeparator />}
        {studies.map((study) => (
          <ScopeItem
            key={study.id}
            active={scope === study.id}
            label={study.name}
            onClick={() => onChange(study.id)}
            badge={
              <ProjectBadge
                appearance={study}
                projectId={study.id}
                name={study.name}
                size="xs"
                imageVersion={study.updatedAt}
              />
            }
          />
        ))}
        <DropdownMenuSeparator />
        <ScopeItem
          active={scope === STUDY_SCOPE_NONE}
          label={t("study.none")}
          onClick={() => onChange(STUDY_SCOPE_NONE)}
        />
      </DropdownMenu>

      {/* The two things one does WITH a study, revealed on hover so the tab reads
          as one target at rest. Only for a real study: "all" and "none" are views,
          not places, and neither has a page or a home for a new document. */}
      {selected && (
        <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/study:opacity-100 focus-within:opacity-100">
          <IconLink
            href={`/app/project/${selected.id}`}
            label={t("study.open")}
          >
            <ArrowUpRightIcon className="h-3.5 w-3.5" />
          </IconLink>
          <IconLink
            href={`/app/new?projectId=${selected.id}`}
            label={t("addDocument")}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </IconLink>
        </span>
      )}
    </div>
  );
}

function ScopeItem({
  active,
  label,
  onClick,
  badge,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2">
        {badge}
        <span className="truncate">{label}</span>
      </span>
      {active && <CheckIcon className="h-4 w-4 shrink-0" />}
    </DropdownMenuItem>
  );
}

function IconLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-6 w-6 items-center justify-center rounded-md",
        "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      {children}
    </Link>
  );
}
