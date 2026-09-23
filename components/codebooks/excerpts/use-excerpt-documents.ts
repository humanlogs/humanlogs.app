"use client";

import * as React from "react";
import { useTranscriptions } from "@/hooks/use-transcriptions";
import type { ExcerptDocument } from "./excerpt-filters";

/**
 * The document list, reduced to what every excerpt surface needs from it.
 *
 * One hook rather than the same `.map` in the panel and in the export menu: the
 * shape carries the speaker roster and the document/speaker codes, which is what
 * resolves "the people coded «cadre»" into ids before the index is touched, and two
 * copies of that mapping would be two chances to forget a field.
 */
export function useExcerptDocuments(): ExcerptDocument[] {
  const { data: transcriptions = [] } = useTranscriptions();

  return React.useMemo<ExcerptDocument[]>(
    () =>
      transcriptions.map((doc) => ({
        id: doc.id,
        title: doc.title,
        projectId: doc.projectId ?? null,
        codes: doc.codes ?? [],
        speakerCodes: doc.speakerCodes ?? [],
        speakers: doc.speakers ?? [],
        speakerCount: doc.speakerCount ?? 0,
      })),
    [transcriptions],
  );
}
