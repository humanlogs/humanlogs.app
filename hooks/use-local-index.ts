"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CodingDTO } from "@/lib/codebooks/coding";
import {
  isLocalDbAvailable,
  readStudyIndex,
  type LocalDocumentRow,
} from "@/lib/local/db.browser";
import type { CodingRef } from "@/lib/local/phrase-index";
import {
  codingSignature,
  reindexOpenDocument,
  syncStudyIndex,
  type CodingManifestEntry,
  type FetchedDocument,
  type SyncResult,
} from "@/lib/local/sync.browser";
import { fetchGateway } from "./fetch";
import { useUserProfile } from "./use-api";
import { useDecryptData } from "./use-encryption";
import type { TranscriptionDetail } from "./use-transcriptions";

/**
 * The local index, from React's side: keeping it current, and reading it.
 *
 * Two queries, on purpose. The SYNC is a slow, network-bound job that runs once per
 * study and mostly decides there is nothing to do; the READ is a fast IndexedDB pass
 * the panel re-runs whenever the index changes. Splitting them is what lets the
 * table paint from what is already on disk while the corpus catches up behind it —
 * a study you synced yesterday opens instantly and corrects itself a second later,
 * rather than showing a spinner over data it already had.
 */

const studyKey = (projectId: string | null | undefined) =>
  projectId === undefined ? "all" : (projectId ?? "none");

export function localPhrasesQueryKey(
  userId: string | undefined,
  projectId: string | null | undefined,
) {
  return ["local-phrases", userId ?? "anon", studyKey(projectId)] as const;
}

/** Strip a coding down to what the index needs — no author object, no dates. */
function toCodingRef(coding: CodingDTO): CodingRef {
  return {
    id: coding.id,
    codebookId: coding.codebookId,
    codeId: coding.codeId,
    userId: coding.userId,
  };
}

/**
 * Bring this study's local index up to date, then let the readers know.
 *
 * Runs as a query rather than an effect so several mounted consumers share ONE
 * pass — the panel and the editor both want the index fresh, and two concurrent
 * syncs of the same study would fight over the same IndexedDB rows. `staleTime`
 * is what keeps navigating between documents of a study from re-running it.
 */
export function useLocalIndexSync(
  projectId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { data: profile } = useUserProfile();
  const decrypt = useDecryptData();
  const queryClient = useQueryClient();
  const userId = profile?.id;

  const query = useQuery({
    queryKey: ["local-index-sync", userId ?? "anon", studyKey(projectId)],
    // `enabled` is a separate flag rather than a `projectId` of `undefined`:
    // undefined is a legitimate scope here (the whole corpus), and conflating the
    // two would make a closed panel download every study on the account.
    enabled: enabled && !!userId && isLocalDbAvailable(),
    // The index is a cache of a cache: a stale one is a table missing the codes a
    // colleague added in the last few minutes, not a wrong document. Five minutes
    // buys quiet navigation; the open document reindexes itself live anyway.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    queryFn: async (): Promise<SyncResult> => {
      const params = new URLSearchParams();
      if (projectId !== undefined) params.set("study", projectId ?? "none");
      const response = await fetchGateway(
        `/api/codings/manifest${params.size ? `?${params}` : ""}`,
      );
      if (!response.ok) throw new Error("Failed to fetch the coding manifest");
      const { documents } = (await response.json()) as {
        documents: CodingManifestEntry[];
      };

      return syncStudyIndex({
        userId: userId!,
        projectId,
        manifest: documents,
        fetchDocument: (id) => fetchAndDecryptDocument(id, decrypt),
      });
    },
  });

  // Reindexing changed nothing readers can see until they re-read; invalidating
  // here rather than inside the engine keeps that engine free of React.
  const synced = query.data;
  useEffect(() => {
    if (!synced || synced.upToDate) return;
    void queryClient.invalidateQueries({
      queryKey: localPhrasesQueryKey(userId, projectId),
    });
  }, [synced, queryClient, userId, projectId]);

  return query;
}

/**
 * Fetch one document and decrypt it, exactly as the editor's own query does — the
 * index has to see the same text the reader does, and for an encrypted study that
 * means unwrapping the key on this device.
 *
 * Returns null for anything unreadable (no key, revoked share, a transcript that
 * never completed), which the engine records as a document the panel is not showing.
 */
async function fetchAndDecryptDocument(
  id: string,
  decrypt: ReturnType<typeof useDecryptData>,
): Promise<FetchedDocument | null> {
  const [documentResponse, codingsResponse] = await Promise.all([
    fetchGateway(`/api/transcriptions/${id}`),
    fetchGateway(`/api/transcriptions/${id}/codings`),
  ]);
  if (!documentResponse.ok || !codingsResponse.ok) return null;

  const raw = (await documentResponse.json()) as Record<string, unknown>;
  // The roster cache is decrypted separately everywhere else and is not needed
  // here; dropping it keeps one failure mode (an old document with no cache) from
  // costing us the transcript.
  const { speakers: _speakers, roomGrant: _roomGrant, ...rest } = raw;

  let detail: TranscriptionDetail;
  try {
    detail = await decrypt<TranscriptionDetail>(rest as never);
  } catch {
    return null;
  }

  const segments = detail.transcription?.words;
  if (!segments) return null;

  const { codings } = (await codingsResponse.json()) as { codings: CodingDTO[] };
  return {
    title: detail.title ?? "",
    projectId: detail.projectId ?? null,
    segments,
    codings: codings.map(toCodingRef),
  };
}

/**
 * Every coded passage of a study, read from disk.
 *
 * Whole rather than filtered: the filter bar changes on every keystroke, and the
 * pure query over rows already in memory ({@link queryPhrases}) is faster than
 * re-opening a transaction per change. See `readStudyIndex` for where that stops
 * being true.
 */
export function useStudyPhrases(
  projectId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { data: profile } = useUserProfile();
  const userId = profile?.id;

  return useQuery({
    queryKey: localPhrasesQueryKey(userId, projectId),
    enabled:
      enabled && !!userId && isLocalDbAvailable() && projectId !== undefined,
    staleTime: 30_000,
    queryFn: () => readStudyIndex(userId!, projectId ?? null),
  });
}

/**
 * Rewrite the open document's rows from what the editor holds right now.
 *
 * The background sync is driven by `updatedAt`, which does not move when a code is
 * applied — and even when it does, only after the save leader flushes. The panel is
 * supposed to be watching the passage being coded, so the editor pushes its own rows
 * directly. Debounced, because coding is rapid-fire and each pass rewrites the
 * document's whole index.
 */
export function useLiveDocumentIndex({
  documentId,
  projectId,
  title,
  serverUpdatedAt,
  enabled = true,
}: {
  documentId: string;
  projectId: string | null;
  title: string;
  /**
   * The document's `updatedAt`. Half of the stamp that keeps the next background
   * pass from re-downloading a document this session already indexed; without it
   * the rows are written unstamped and will simply be rebuilt.
   */
  serverUpdatedAt?: string | null;
  enabled?: boolean;
}) {
  const { data: profile } = useUserProfile();
  const queryClient = useQueryClient();
  const userId = profile?.id;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{
    segments: FetchedDocument["segments"];
    codings: CodingRef[];
    stamp: { updatedAt: string; signature: string } | null;
  } | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (input: { segments: FetchedDocument["segments"]; codings: CodingDTO[] }) => {
      // Computed here, from the same codings the manifest counts, so the stamp is
      // byte-identical to the one the server would report for this document.
      const latest = input.codings.reduce<string | null>(
        (max, coding) => (!max || coding.createdAt > max ? coding.createdAt : max),
        null,
      );
      pending.current = {
        segments: input.segments,
        codings: input.codings.map(toCodingRef),
        stamp: serverUpdatedAt
          ? {
              updatedAt: serverUpdatedAt,
              signature: codingSignature({
                codings: input.codings.length,
                codingLatest: latest,
              }),
            }
          : null,
      };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const next = pending.current;
        pending.current = null;
        if (!next || !userId || !enabled || !isLocalDbAvailable()) return;
        void reindexOpenDocument({
          userId,
          documentId,
          projectId,
          title,
          segments: next.segments,
          codings: next.codings,
          stamp: next.stamp,
        })
          .then(() =>
            queryClient.invalidateQueries({
              queryKey: localPhrasesQueryKey(userId, projectId),
            }),
          )
          .catch((error) =>
            console.warn("[local-index] live reindex failed", error),
          );
      }, 400);
    },
    [userId, enabled, documentId, projectId, title, serverUpdatedAt, queryClient],
  );
}

/** What the local database holds, for the panel's "synced" line. */
export function useLocalIndexStatus(): {
  available: boolean;
  documents: LocalDocumentRow[] | undefined;
} {
  const { data: profile } = useUserProfile();
  const userId = profile?.id;
  const { data } = useQuery({
    queryKey: ["local-index-status", userId ?? "anon"],
    enabled: !!userId && isLocalDbAvailable(),
    staleTime: 60_000,
    queryFn: async () => {
      const { readDocumentRows } = await import("@/lib/local/db.browser");
      return readDocumentRows(userId!);
    },
  });
  return { available: isLocalDbAvailable(), documents: data };
}

/** Wipe this device's copy — the security page's "forget this device" action. */
export function useForgetLocalData() {
  const { data: profile } = useUserProfile();
  const queryClient = useQueryClient();
  const userId = profile?.id;

  return useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { destroyLocalDb } = await import("@/lib/local/db.browser");
      await destroyLocalDb(userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["local-phrases"] });
      void queryClient.invalidateQueries({ queryKey: ["local-index-sync"] });
      void queryClient.invalidateQueries({ queryKey: ["local-index-status"] });
    },
  });
}
