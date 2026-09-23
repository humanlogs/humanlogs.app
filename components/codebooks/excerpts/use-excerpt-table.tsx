"use client";

import * as React from "react";
import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "@/components/locale-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/use-api";
import { useCodebooks } from "@/hooks/use-codebooks";
import { useLocalIndexSync } from "@/hooks/use-local-index";
import { codebooksInScopeForProject } from "@/lib/codebooks/codebook";
import { verbatimCodebooks } from "@/lib/codebooks/coding";
import { ExcerptFilters } from "./excerpt-filters";
import { ExcerptList } from "./excerpt-list";
import { useExcerptPanel } from "./excerpt-panel-context";
import { useExcerptDocuments } from "./use-excerpt-documents";
import { useExcerptQuery } from "./use-excerpt-query";

/**
 * The excerpt table itself: the controls, the rows, and the line that says how
 * much of the study has been read.
 *
 * Extracted from the panel because the table now has two homes and they are the
 * same table. Docked to the right of a document it is a companion to the text; on
 * the study's coding workshop it is the full-width answer to "what have we said
 * about this corpus". Neither should be a second implementation of the other, and
 * the state they share (filter, grouping) is already global.
 *
 * What differs is only the frame, which stays with the callers. A hook rather than
 * a component because it hands back three pieces the two frames arrange
 * differently: the count for their own header, the body, and the sync line.
 */
export function useExcerptTable({
  /** Whether to run the query at all. The panel closes; a tab is unmounted. */
  enabled,
}: {
  enabled: boolean;
}) {
  const t = useTranslations("codebook.excerpts");
  const panel = useExcerptPanel();
  const { data: profile } = useUserProfile();
  const { data: codebooks = [] } = useCodebooks();
  const documents = useExcerptDocuments();
  const projectId = panel.context.projectId;

  const sync = useLocalIndexSync(projectId, { enabled });
  /** A pass with documents left to fetch: the table is filling, not empty. */
  const indexing = sync.isFetching && (sync.progress?.total ?? 0) > 0;

  const query = useExcerptQuery({
    documents,
    codebooks,
    userId: profile?.id,
    enabled,
  });

  // The table may change codes only on the interview an editor is lending it, and
  // only through the verbatim codebooks that cover this study.
  const coding = React.useMemo(() => {
    if (!panel.codingDocumentId) return undefined;
    return {
      documentId: panel.codingDocumentId,
      codebooks: verbatimCodebooks(
        codebooksInScopeForProject(codebooks, projectId),
      ),
      toggle: (
        phrase: { documentId: string; codingIds: string[] },
        codebookId: string,
        codeId: string,
      ) => {
        panel.togglePhraseCode({ ...phrase, codebookId, codeId });
      },
    };
  }, [panel, codebooks, projectId]);

  return {
    total: query.total,
    node: (
      <>
        <ExcerptFilters documents={documents} codebooks={codebooks} />
        {query.pending ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : query.groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {/* "Nothing matches" and "nothing here yet" are different answers, and
                a study being indexed for the first time is the second one. Saying
                the first would be telling a researcher their corpus is uncoded
                while we are still reading it. */}
            {indexing ? t("indexingEmpty") : t("empty")}
          </p>
        ) : (
          <ExcerptList
            groups={query.groups}
            labels={query.labels}
            deepen={query.deepen}
            coding={coding}
          />
        )}
      </>
    ),
    footer: (
      <SyncFooter
        pending={sync.isFetching}
        total={sync.progress?.total ?? 0}
        done={sync.progress?.done ?? 0}
        failed={sync.progress?.failed ?? sync.data?.failed ?? 0}
      />
    ),
  };
}

/**
 * How much of the study the table is actually showing.
 *
 * Silent while everything is in hand, which is the normal state: the sync's whole
 * point is that it usually has nothing to do. It speaks up while a study is being
 * indexed for the first time, and when documents could not be read — a study half
 * indexed without saying so is worse than one that admits it.
 */
function SyncFooter({
  pending,
  total,
  done,
  failed,
}: {
  pending: boolean;
  total: number;
  done: number;
  failed: number;
}) {
  const t = useTranslations("codebook.excerpts");
  if (!pending && failed === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
      {pending && <RefreshCwIcon className="size-3 animate-spin" />}
      <span>
        {pending
          ? t("syncing", { done, total })
          : t("syncFailed", { count: failed })}
      </span>
    </div>
  );
}
