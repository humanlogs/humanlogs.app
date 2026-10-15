"use client";

import { ProjectBadge } from "@/components/projects/project-badge";
import { DocumentPhaseSwitch } from "@/components/transcriptions/document-phase-switch";
import type { WorkspaceArea } from "@/components/transcriptions/editor/phase";
import { useBetaFeatures, type Project } from "@/hooks/use-api";
import { useDeclareWorkspaceArea } from "@/hooks/use-workspace-area";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { createPortal } from "react-dom";

/**
 * The top bar of a study's three rooms: the study itself, its coding workshop,
 * and its analysis table.
 *
 * One header for all three, in the app's own bar rather than inside the page.
 * Before this, each room drew its own title somewhere down the page and the bar
 * above it was empty — so arriving on the coding workshop from a document, the
 * screen lost the study, the way back, and the switch between the passes all at
 * once, and there was no way to reach analysis except through a document.
 *
 * The switch here moves the PAGE, not a document's phase: the three rooms are
 * three URLs. That is the same control the document header carries, deliberately
 * — a researcher reads one device for "which pass am I in", whether what is open
 * is one interview or the whole corpus.
 */
export function StudyHeader({
  study,
  area,
  children,
}: {
  study: Project;
  /** Which of the study's rooms this page is. */
  area: WorkspaceArea;
  /** Page-specific actions, right-aligned. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const betaFeatures = useBetaFeatures();
  const [target, setTarget] = React.useState<HTMLElement | null>(null);

  // The portal's host is in the layout above this page, so it exists by the time
  // an effect runs but not during the first render.
  React.useEffect(() => {
    setTarget(document.getElementById("header-actions-portal"));
  }, []);

  // The route is what says which space this is — see the hook.
  useDeclareWorkspaceArea(area);

  if (!target) return null;

  const go = (next: WorkspaceArea) => {
    router.push(
      next === "transcription"
        ? `/app/project/${study.id}`
        : `/app/project/${study.id}/${next}`,
    );
  };

  return createPortal(
    <div className="flex w-full items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link
          href={`/app/project/${study.id}`}
          className="flex min-w-0 shrink items-center gap-1.5 hover:opacity-80"
        >
          <ProjectBadge
            appearance={study}
            projectId={study.id}
            name={study.name}
            size="sm"
            imageVersion={study.updatedAt}
          />
          <span className="truncate font-semibold">{study.name}</span>
        </Link>
        {/* Coding and analysis are part of the codebooks beta, so without the
            opt-in there is only one room and no switch to show. */}
        {betaFeatures && (
          <DocumentPhaseSwitch area={area} onChange={go} />
        )}
      </div>
      {children}
    </div>,
    target,
  );
}
