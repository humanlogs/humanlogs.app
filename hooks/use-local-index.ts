"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CodingDTO } from "@/lib/codebooks/coding";
import {
  isLocalDbAvailable,
  type LocalDocumentRow,
} from "@/lib/local/db.browser";
import { buildPhraseIndex, type CodingRef } from "@/lib/local/phrase-index";
import type { PhraseStreamResult } from "@/lib/local/phrase-stream";
import {
  queryStudy,
  readPhraseRows,
  type HydratedPhrases,
  type StudyQuery,
} from "@/lib/local/query-store.browser";
import {
  codingSignature,
  type CodingManifestEntry,
} from "@/lib/local/manifest";
import {
  phraseIndexSignature,
  syncStudyIndex,
  SyncThrottledError,
  writeDocumentIndex,
  type FetchedDocument,
  type SyncProgress,
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

/**
 * How long the open document sits still before its index is rewritten. Long enough
 * that a run of codes is one write, short enough that the row is in the table before
 * the researcher looks up.
 */
const LIVE_REINDEX_DEBOUNCE_MS = 400;

const studyKey = (projectId: string | null | undefined) =>
  projectId === undefined ? "all" : (projectId ?? "none");

export function localPhrasesQueryKey(
  userId: string | undefined,
  projectId: string | null | undefined,
) {
  return ["local-phrases", userId ?? "anon", studyKey(projectId)] as const;
}

const PHRASE_ROWS_KEY = "local-phrase-rows";

/**
 * Tell the readers the rows moved.
 *
 * Two keys, because the panel reads in two steps now: the pass that counts the
 * study and the fetch that turns the visible page into text. A reindex invalidates
 * both — a passage whose wording changed must not keep its old text under a count
 * that was just redone.
 */
function invalidateLocalPhrases(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined,
  projectId: string | null | undefined,
): void {
  void queryClient.invalidateQueries({
    queryKey: localPhrasesQueryKey(userId, projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: [PHRASE_ROWS_KEY, userId ?? "anon"],
  });
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
 * How often a running pass tells the readers to look again.
 *
 * A first sync of a large study is paced over minutes (see `DOCUMENTS_PER_MINUTE`),
 * and a panel that only refreshed at the end would sit empty through all of it.
 * Every few documents is enough to feel like it is filling without re-reading the
 * whole study's rows on each one.
 */
const REFRESH_EVERY_DOCUMENTS = 5;

/**
 * Bring this study's local index up to date, and report on it as it goes.
 *
 * Runs as a query rather than an effect so several mounted consumers share ONE
 * pass — the panel and the editor both want the index fresh, and two concurrent
 * syncs of the same study would fight over the same IndexedDB rows. `staleTime`
 * is what keeps navigating between documents of a study from re-running it.
 *
 * The returned `progress` is the LIVE count, which the query's own `data` cannot
 * be: a pass over a study that has never been indexed here runs for minutes, and
 * `data` only exists once it is over.
 */
export function useLocalIndexSync(
  projectId: string | null | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { data: profile } = useUserProfile();
  const decrypt = useDecryptData();
  const queryClient = useQueryClient();
  const userId = profile?.id;
  const [progress, setProgress] = useState<SyncProgress | null>(null);

  // A different study is a different pass; carrying the previous one's counters
  // over would show the panel a total that belongs to somebody else's corpus.
  // Adjusted during render rather than in an effect, so no frame is ever painted
  // with the mismatch.
  const scope = `${userId ?? "anon"}:${studyKey(projectId)}`;
  const [progressScope, setProgressScope] = useState(scope);
  if (progressScope !== scope) {
    setProgressScope(scope);
    setProgress(null);
  }

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
    queryFn: async ({ signal }): Promise<SyncResult> => {
      const params = new URLSearchParams();
      if (projectId !== undefined) params.set("study", projectId ?? "none");
      const response = await fetchGateway(
        `/api/codings/manifest${params.size ? `?${params}` : ""}`,
      );
      if (!response.ok) throw new Error("Failed to fetch the coding manifest");
      const { documents } = (await response.json()) as {
        documents: CodingManifestEntry[];
      };

      let announced = 0;
      return syncStudyIndex({
        userId: userId!,
        projectId,
        manifest: documents,
        fetchDocument: (id) => fetchAndDecryptDocument(id, decrypt),
        // Leaving the study aborts the pass rather than letting it finish writing
        // rows nobody is looking at — TanStack signals this on unmount and on a
        // key change.
        signal,
        onProgress: (current) => {
          setProgress(current);
          if (current.done - announced < REFRESH_EVERY_DOCUMENTS) return;
          announced = current.done;
          invalidateLocalPhrases(queryClient, userId, projectId);
        },
      });
    },
  });

  // The final refresh. Reindexing changed nothing readers can see until they
  // re-read; invalidating here rather than inside the engine keeps that engine free
  // of React.
  const synced = query.data;
  useEffect(() => {
    if (!synced || synced.upToDate) return;
    invalidateLocalPhrases(queryClient, userId, projectId);
  }, [synced, queryClient, userId, projectId]);

  return { ...query, progress };
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
  // Being told to slow down is not the same as being unable to read the document:
  // the engine backs off and comes back, rather than recording a hole in the index.
  for (const response of [documentResponse, codingsResponse]) {
    if (response.status === 429)
      throw new SyncThrottledError(retryAfterOf(response));
  }
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

  const { codings } = (await codingsResponse.json()) as {
    codings: CodingDTO[];
  };
  return {
    title: detail.title ?? "",
    projectId: detail.projectId ?? null,
    segments,
    codings: codings.map(toCodingRef),
  };
}

/** `Retry-After` in milliseconds, when the server bothered to say. */
function retryAfterOf(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/**
 * Run the panel's question against the local index.
 *
 * The pass walks the study in batches and keeps a count per group plus the first
 * `perGroup` references of each — never the study (see query-store.browser.ts).
 * What comes back therefore NAMES the rows; {@link usePhraseRows} fetches the ones
 * being drawn.
 *
 * Keyed on the whole request, so every distinct question is its own cache entry and
 * going back to one is instant. `placeholderData` keeps the previous answer on
 * screen while the next is computed: a filter change should visibly narrow a list,
 * not blank it and refill it.
 */
export function useStudyQuery(
  request: Omit<StudyQuery, "signal"> | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { data: profile } = useUserProfile();
  const userId = profile?.id;

  return useQuery<PhraseStreamResult>({
    queryKey: [
      ...localPhrasesQueryKey(userId, request?.projectId),
      request,
    ] as const,
    enabled: enabled && !!userId && isLocalDbAvailable() && !!request,
    // Never stale on its own: every way the rows can change invalidates this
    // prefix explicitly — the background pass as it goes, the open document as it
    // is coded. A timer on top of that would only re-walk a study to get the same
    // answer back.
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    placeholderData: (previous) => previous,
    queryFn: ({ signal }) => queryStudy(userId!, { ...request!, signal }),
  });
}

/**
 * The text and chips of the passages currently on screen.
 *
 * A page at a time, by primary key. This is the read that used to be the whole
 * study: sixty rows instead of two hundred thousand, and it grows with the scroll
 * rather than with the corpus.
 */
export function usePhraseRows(ids: readonly string[]) {
  const { data: profile } = useUserProfile();
  const userId = profile?.id;

  return useQuery<HydratedPhrases>({
    // The ids themselves are the key: scrolling extends the list, so the next page
    // is a different question, and the previous answer stays cached for the way
    // back up.
    queryKey: [PHRASE_ROWS_KEY, userId ?? "anon", ids.join("|")],
    enabled: !!userId && isLocalDbAvailable() && ids.length > 0,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    placeholderData: (previous) => previous,
    queryFn: () => readPhraseRows(userId!, ids),
  });
}

/**
 * Rewrite the open document's rows from what the editor holds right now.
 *
 * The background sync is driven by `updatedAt`, which does not move when a code is
 * applied — and even when it does, only after the save leader flushes. The panel is
 * supposed to be watching the passage being coded, so the editor pushes its own rows
 * directly.
 *
 * Two filters keep that from being expensive. The call is DEBOUNCED, so a run of
 * codes costs one rewrite; and the derived index is compared with the last one
 * written, so the projection changes that dominate — someone typing during the
 * transcription phase — cost no transaction at all.
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
    codings: CodingDTO[];
  } | null>(null);
  /** Signature of the index last written, so an identical one is not written twice. */
  const written = useRef<string | null>(null);

  // A different document reuses this hook (client-side navigation between two
  // interviews), and its index has nothing to do with the last one written.
  useEffect(() => {
    written.current = null;
  }, [documentId]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (input: {
      segments: FetchedDocument["segments"];
      codings: CodingDTO[];
    }) => {
      pending.current = input;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const next = pending.current;
        pending.current = null;
        if (!next || !userId || !enabled || !isLocalDbAvailable()) return;

        const index = buildPhraseIndex({
          documentId,
          projectId,
          segments: next.segments,
          codings: next.codings.map(toCodingRef),
        });
        const signature = phraseIndexSignature(index);
        if (signature === written.current) return;
        written.current = signature;

        // The stamp is computed from the same codings the manifest counts, so it
        // is byte-identical to the one the server would report for this document —
        // which is what stops the next background pass re-downloading it.
        const latest = next.codings.reduce<string | null>(
          (max, coding) =>
            !max || coding.createdAt > max ? coding.createdAt : max,
          null,
        );

        void writeDocumentIndex({
          userId,
          documentId,
          projectId,
          title,
          index,
          stamp: serverUpdatedAt
            ? {
                updatedAt: serverUpdatedAt,
                signature: codingSignature({
                  codings: next.codings.length,
                  codingLatest: latest,
                }),
              }
            : null,
        })
          .then(() => invalidateLocalPhrases(queryClient, userId, projectId))
          .catch((error) => {
            // The rows on disk are now unknown; forget what we thought we wrote so
            // the next change tries again instead of being skipped as a duplicate.
            written.current = null;
            console.warn("[local-index] live reindex failed", error);
          });
      }, LIVE_REINDEX_DEBOUNCE_MS);
    },
    [
      userId,
      enabled,
      documentId,
      projectId,
      title,
      serverUpdatedAt,
      queryClient,
    ],
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
      void queryClient.invalidateQueries({ queryKey: [PHRASE_ROWS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ["local-index-sync"] });
      void queryClient.invalidateQueries({ queryKey: ["local-index-status"] });
    },
  });
}
