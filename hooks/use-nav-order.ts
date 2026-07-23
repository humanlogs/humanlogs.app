"use client";

import { useMemo } from "react";
import { useProjects, useUserProfile } from "./use-api";
import { useTranscriptions } from "./use-transcriptions";

/**
 * The ordered list of app routes as they appear, top-to-bottom, in the sidebar.
 * This is the "map" the route transition uses to decide whether a navigation
 * moves *up* or *down* the sidebar (and therefore which way content should
 * slide). It intentionally mirrors the rendering order of `AppSidebar`:
 *
 *   Home → New → Admin? → [project, ...its transcriptions] × N
 *        → unassigned transcriptions → shared transcriptions
 *
 * Routes not in this list (account, billing, a project opened from elsewhere…)
 * simply aren't found, and the transition falls back to a forward/back slide.
 */
export function useNavOrder(): string[] {
  const { data: projects = [] } = useProjects();
  const { data: transcriptions = [] } = useTranscriptions();
  const { data: userProfile } = useUserProfile();

  return useMemo(() => {
    const owned = transcriptions.filter((t) => t.isOwner !== false);
    const byRecent = (a: { updatedAt: string }, b: { updatedAt: string }) =>
      b.updatedAt.localeCompare(a.updatedAt);

    const order: string[] = ["/app", "/app/new"];
    if (userProfile?.isAdmin) order.push("/app/admin");

    // Projects, each followed by its (owned) transcriptions.
    for (const project of projects) {
      order.push(`/app/project/${project.id}`);
      owned
        .filter((t) => t.projectId === project.id)
        .sort(byRecent)
        .forEach((t) => order.push(`/app/transcription/${t.id}`));
    }

    // Unassigned, then shared.
    owned
      .filter((t) => !t.projectId)
      .sort(byRecent)
      .forEach((t) => order.push(`/app/transcription/${t.id}`));
    transcriptions
      .filter((t) => t.isOwner === false)
      .sort(byRecent)
      .forEach((t) => order.push(`/app/transcription/${t.id}`));

    return order;
  }, [projects, transcriptions, userProfile?.isAdmin]);
}
