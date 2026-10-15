"use client";

import { useTranslations } from "@/components/locale-provider";
import { ProjectBadge } from "@/components/projects/project-badge";
import type { Project } from "@/hooks/use-api";
import {
  STUDY_SCOPE_ALL,
  STUDY_SCOPE_NONE,
  type StudyScope,
} from "@/lib/documents/grouping";
import { cn } from "@/lib/utils/utils";
import { ArrowUpRightIcon, FoldersIcon, LayersIcon } from "lucide-react";
import Link from "next/link";

/**
 * The studies, as a list rather than a menu.
 *
 * The one you are working in sits at the top, open, with its two passes under
 * it; the others are closed rows below, alphabetical, one click from taking its
 * place. That is the same choice the dropdown offered, with one difference that
 * is the whole point: the alternatives are VISIBLE. A researcher opening the app
 * could not previously tell how many studies they had without opening a menu,
 * and a corpus you cannot see the shape of is one you navigate by memory.
 *
 * "All studies" and "the documents in none" are views rather than places, so they
 * come last and carry an icon instead of a badge.
 */

export type StudyEntry = {
  scope: StudyScope;
  /** Absent for the two views, which have no study to show. */
  study?: Project;
  label: string;
  documentCount: number;
};

export function StudyList({
  entries,
  scope,
  onChange,
  children,
}: {
  /** Every reachable scope, the current one included, already in display order. */
  entries: StudyEntry[];
  scope: StudyScope;
  onChange: (scope: StudyScope) => void;
  /** The phases of the current study, rendered inside its band. */
  children: React.ReactNode;
}) {
  const t = useTranslations("sidebar");
  const current = entries.find((entry) => entry.scope === scope);
  const others = entries.filter((entry) => entry.scope !== scope);

  return (
    <div className="flex flex-col">
      {current && (
        // Full-bleed: a rule above and below rather than a frame around, so the
        // band spans the column and reads as the heading of everything under it.
        <div className="group/study flex items-center gap-1 border-y bg-sidebar-accent/40 px-2 py-1.5">
          <span className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left">
            <EntryIcon entry={current} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {current.label}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-sidebar-foreground/50">
              {current.documentCount}
            </span>
          </span>

          {/* Opening the study's page, revealed on hover so the band reads as one
              thing at rest. Only for a real study: the two views are not places
              and have no page. */}
          {current.study && (
            <span className="ml-auto flex shrink-0 items-center opacity-0 transition-opacity group-hover/study:opacity-100 focus-within:opacity-100">
              <Link
                href={`/app/project/${current.study.id}`}
                aria-label={t("study.open")}
                title={t("study.open")}
                className="flex h-6 w-6 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </Link>
            </span>
          )}
        </div>
      )}

      {children}

      {others.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t px-2 py-1.5">
          {others.map((entry) => (
            <button
              key={String(entry.scope)}
              type="button"
              onClick={() => onChange(entry.scope)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-md px-1.5 text-left",
                "text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <EntryIcon entry={entry} />
              <span className="min-w-0 flex-1 truncate text-sm">
                {entry.label}
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-sidebar-foreground/40">
                {entry.documentCount}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntryIcon({ entry }: { entry: StudyEntry }) {
  if (entry.study) {
    return (
      <ProjectBadge
        appearance={entry.study}
        projectId={entry.study.id}
        name={entry.study.name}
        size="xs"
        imageVersion={entry.study.updatedAt}
      />
    );
  }
  return entry.scope === STUDY_SCOPE_ALL ? (
    <LayersIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
  ) : (
    <FoldersIcon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
  );
}

export { STUDY_SCOPE_ALL, STUDY_SCOPE_NONE };
