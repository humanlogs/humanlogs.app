"use client";

import type { CodeRef, SpeakerCodeRef } from "@/lib/codebooks/codebook";
import {
  encodeSpeakerCache,
  isEncryptedEntity,
  parseSpeakers,
  sameSpeakers,
  type SpeakerSummary,
} from "@/lib/transcriptions/speakers";
import {
  EncryptionUtils,
  type EncryptedDataEntity,
} from "@/lib/encryption/encryption-entities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { browserCrypto } from "../lib/encryption/encryption-entities.browser";
import { fetchGateway } from "./fetch";
import {
  DecryptedWithRaw,
  useDecryptData,
  useEncryptionStatus,
} from "./use-encryption";

type Transcription = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isTutorial?: boolean;
  projectId?: string;
  speakerCount?: number;
  speakerNames?: (string | null)[];
  /**
   * The document's speakers, from the roster cache — decrypted here, without
   * touching the transcript itself. Undefined only when the cache was never
   * written (a document from before it existed) or when this device has no key
   * for it.
   */
  speakers?: SpeakerSummary[];
  isEncrypted?: boolean;
  mediaType?: "audio" | "text";
  /** Codes applied to the document; opaque ids resolved against the codebooks. */
  codes?: CodeRef[];
  /** Codes applied to the document's speakers. */
  speakerCodes?: SpeakerCodeRef[];
  state: "PENDING" | "COMPLETED" | "ERROR";
  errorMessage?: string | null;
  isOwner?: boolean;
  role?: "owner" | "read" | "read+listen" | "write" | null;
  shared?: SharedUser[];
};

export type SharedUser = {
  userId: string;
  role: "read" | "read+listen" | "write";
};

export type TranscriptionDetail = {
  id: string;
  title: string;
  audioFileName: string;
  audioFileSize: number;
  audioFileKey: string;
  audioFileEncryption?: string;
  mediaType?: "audio" | "text";
  language: string;
  vocabulary: string[];
  speakerCount: number;
  state: "PENDING" | "COMPLETED" | "ERROR";
  errorMessage?: string | null;
  transcription?: TranscriptionContent;
  projectId?: string;
  projectName?: string;
  /** The roster cache, decrypted; compare it with the content to spot drift. */
  speakers?: SpeakerSummary[];
  codes?: CodeRef[];
  speakerCodes?: SpeakerCodeRef[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  isTutorial?: boolean;
  shared?: SharedUser[];
  isOwner?: boolean;
  role?: "owner" | "read" | "read+listen" | "write" | null;
  userId?: string;
};

export type TranscriptionContent = {
  speakers: { id: string; name?: string }[];
  words: TranscriptionSegment[];
};

export type TranscriptionSegment = {
  type: "spacing" | "word";
  text: string;
  start?: number;
  end?: number;
  speakerId?: string;
  modifiers?: ("b" | "i" | "u" | "s")[];
  // Comment thread ids anchored on this token (the `commentId` of any `comment`
  // marks covering it). Note bodies live in the Comment table; this only records
  // which range is anchored so it survives save → reseed and is versioned with the
  // transcript. A token normally has at most one (a mark type is unique per position).
  comments?: string[];
};

export type HistoryEntry = {
  id: string;
  updatedAt: string;
  updatedBy: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  additions: number;
  removals: number;
  changed: number;
};

export type VersionData = {
  current: {
    words: TranscriptionSegment[];
    [key: string]: unknown;
  };
  previous: {
    words: TranscriptionSegment[];
    [key: string]: unknown;
  } | null;
};

/**
 * The roster cache as the UI wants it: a plain list of speakers.
 *
 * Decrypting it is deliberately allowed to fail. It is a cache, and its
 * accessors can legitimately lag behind the document's (a collaborator added
 * after it was written, a device without the key): losing the names must cost
 * a fallback, never the whole list of documents.
 */
async function decodeSpeakerCache(
  value: unknown,
  decrypt: <T>(data: EncryptedDataEntity) => Promise<DecryptedWithRaw<T>>,
): Promise<SpeakerSummary[] | undefined> {
  if (!value) return undefined;
  if (!isEncryptedEntity(value)) return parseSpeakers(value) ?? undefined;
  try {
    return parseSpeakers(await decrypt(value)) ?? undefined;
  } catch {
    return undefined;
  }
}

// Fetch transcriptions
export function useTranscriptions() {
  const decrypt = useDecryptData();

  const query = useQuery({
    queryKey: ["transcriptions"],
    queryFn: async () => {
      const response = await fetchGateway("/api/transcriptions");
      if (!response.ok) {
        throw new Error("Failed to fetch transcriptions");
      }
      const items = (await response.json()) as Array<
        Record<string, unknown> & { speakers?: unknown }
      >;
      // The roster is pulled out before the generic pass: it is the one
      // encrypted field of a list item, and it must not be able to fail it.
      return Promise.all<Transcription>(
        items.map(async ({ speakers, ...rest }) => ({
          ...(await decrypt<Transcription>(rest as never)),
          speakers: await decodeSpeakerCache(speakers, decrypt),
        })),
      );
    },
  });

  usePendingTranscriptionsPolling(
    query.data?.some((t) => t.state === "PENDING") ?? false,
  );

  return query;
}

// Fetch single transcription
export function useTranscription(id: string) {
  const decrypt = useDecryptData();

  const query = useQuery({
    queryKey: ["transcriptions", id],
    queryFn: async () => {
      const response = await fetchGateway(`/api/transcriptions/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Transcription not found");
        }
        if (response.status === 403) {
          throw new Error(
            "You don't have permission to view this transcription",
          );
        }
        throw new Error("Failed to fetch transcription");
      }
      const raw = (await response.json()) as Record<string, unknown> & {
        speakers?: unknown;
      };
      const { speakers, ...rest } = raw;
      try {
        const decoded = await decrypt<TranscriptionDetail>(rest as never);
        return {
          ...decoded,
          speakers: await decodeSpeakerCache(speakers, decrypt),
          // `_raw` keeps the payload as it was served — the share dialog
          // re-wraps the stored entities from it, roster included.
          _raw: raw,
        } as DecryptedWithRaw<TranscriptionDetail>;
      } catch (error) {
        console.error("Decryption error", error);
        throw new Error("error_encrypted");
      }
    },
    enabled: !!id,
  });

  usePendingTranscriptionsPolling(query.data?.state === "PENDING");

  return query;
}

let pollingSubscribers = 0;
let pollingInterval: NodeJS.Timeout | null = null;
export function usePendingTranscriptionsPolling(active = false) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (active) {
      pollingSubscribers++;
    } else {
      pollingSubscribers = Math.max(0, pollingSubscribers - 1);
    }

    if (!pollingInterval) {
      pollingInterval = setInterval(() => {
        if (pollingSubscribers > 0) {
          console.log("Polling for pending transcriptions...");
          queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
        } else {
          if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
          }
        }
      }, 30000);
    }

    return () => {
      if (active) {
        pollingSubscribers = Math.max(0, pollingSubscribers - 1);
      }
    };
  }, [active]);
}

// Fetch transcription history
export function useTranscriptionHistory(transcriptionId: string) {
  return useQuery({
    queryKey: ["transcription-history", transcriptionId],
    queryFn: async () => {
      if (!transcriptionId) return [];
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/history`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch history");
      }
      return response.json() as Promise<HistoryEntry[]>;
    },
    enabled: !!transcriptionId,
  });
}

// Fetch specific version
export function useTranscriptionVersion(
  transcriptionId: string,
  versionId: string,
) {
  const decrypt = useDecryptData();
  return useQuery({
    queryKey: ["transcription-version", transcriptionId, versionId],
    queryFn: async () => {
      if (!transcriptionId || !versionId) return null;
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/history/${versionId}`,
      );
      if (!response.ok) throw new Error("Failed to fetch version");
      return decrypt<VersionData>(await response.json());
    },
    enabled: !!transcriptionId && !!versionId,
  });
}

// Calculate changes between current and previous word arrays
export function calculateWordChanges(
  currentWords: TranscriptionSegment[],
  previousWords: TranscriptionSegment[],
): { additions: number; removals: number; changed: number } {
  // Use word.start as unique identifier for accurate diffing
  const currentMap = new Map<number, TranscriptionSegment>();
  const previousMap = new Map<number, TranscriptionSegment>();

  for (const word of currentWords) {
    if (word.start !== undefined) {
      currentMap.set(word.start, word);
    }
  }

  for (const word of previousWords) {
    if (word.start !== undefined) {
      previousMap.set(word.start, word);
    }
  }

  let additions = 0;
  let removals = 0;
  let changed = 0;

  // Check all current words
  for (const [start, currentWord] of currentMap) {
    if (!previousMap.has(start)) {
      // start present in current but not in previous → addition
      additions++;
    } else {
      // start present in both, check if text changed
      const previousWord = previousMap.get(start);
      if (currentWord.text !== previousWord?.text) {
        changed++;
      }
    }
  }

  // Check for removals (in previous but not in current)
  for (const start of previousMap.keys()) {
    if (!currentMap.has(start)) {
      removals++;
    }
  }

  return { additions, removals, changed };
}

// Save transcription mutation
/**
 * Resolve the transcription's stable session AES key for the collab transport,
 * WITHOUT decrypting the payload. Returns:
 *  - `{ isEncrypted: false, aesKey: null, ready: true }` for plaintext transcriptions,
 *  - `{ isEncrypted: true, aesKey, ready: true }` once the key is unwrapped,
 *  - `{ ready: false }` while loading (the collab provider must not start yet, so E2E
 *    content is never relayed in the clear).
 */
export function useTranscriptionAesKey(transcriptionId: string): {
  aesKey: string | null;
  isEncrypted: boolean;
  ready: boolean;
} {
  const { data: transcription } = useTranscription(transcriptionId);
  const { data: encState } = useEncryptionStatus();
  const [state, setState] = useState<{
    aesKey: string | null;
    isEncrypted: boolean;
    ready: boolean;
  }>({ aesKey: null, isEncrypted: false, ready: false });

  useEffect(() => {
    if (!transcription) return; // query not loaded yet → not ready
    const rawEntity = (
      transcription as unknown as {
        _raw?: { transcription?: EncryptedDataEntity };
      }
    )._raw?.transcription;
    const isEncrypted = !!rawEntity?.privateKeys?.length;

    if (!isEncrypted) {
      // Result of an async decryption; there is no synchronous value to derive.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ aesKey: null, isEncrypted: false, ready: true });
      return;
    }
    const privateKey = encState?.privateKey;
    const publicKey = encState?.publicKey;
    if (!privateKey || !publicKey) {
      setState({ aesKey: null, isEncrypted: true, ready: false });
      return;
    }

    let cancelled = false;
    new EncryptionUtils(browserCrypto)
      .resolveAesKey(rawEntity as EncryptedDataEntity, privateKey, publicKey)
      .then((k) => {
        if (!cancelled) setState({ aesKey: k, isEncrypted: true, ready: true });
      })
      .catch(() => {
        if (!cancelled)
          setState({ aesKey: null, isEncrypted: true, ready: false });
      });
    return () => {
      cancelled = true;
    };
  }, [transcription, encState?.privateKey, encState?.publicKey]);

  return state;
}

export function useSaveTranscription(
  transcriptionId: string,
  // In collab, the stable session AES key. When provided, encrypted saves REUSE it
  // (keeping `privateKeys` untouched) instead of rotating — otherwise late joiners,
  // who resolve the key from the stored entity, would get a key the current peers no
  // longer use. Non-collab saves (undefined) keep rotating (supports revocation).
  sessionAesKey?: string | null,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      words: TranscriptionSegment[];
      speakers: { id: string; name?: string }[];
    }) => {
      //Get the current transcription to calculate changes and get encryption entity
      const currentTranscription = queryClient.getQueryData<
        DecryptedWithRaw<TranscriptionDetail>
      >(["transcriptions", transcriptionId]);

      // Calculate change stats
      let changeStats = { additions: 0, removals: 0, changed: 0 };
      if (currentTranscription?.transcription?.words) {
        changeStats = calculateWordChanges(
          data.words,
          currentTranscription.transcription.words,
        );
      }

      // Prepare transcription data
      let transcriptionData: unknown = {
        words: data.words,
        speakers: data.speakers,
      };

      // Handle encryption if current transcription is encrypted
      // TODO not super elegant to retreive the original encryption status like that, could easily lead to a mistake stopping encryption
      const currentData = (currentTranscription?._raw as any)
        ?.transcription as EncryptedDataEntity;
      if (currentData?.privateKeys && currentData?.payload) {
        const utils = new EncryptionUtils(browserCrypto);
        if (sessionAesKey) {
          // Collab: reuse the stable session key. `privateKeys` already wrap it, so
          // every collaborator (and any late joiner resolving the key from the stored
          // entity) keeps decrypting. No key rotation, no re-wrap.
          transcriptionData = {
            version: "v1",
            privateKeys: currentData.privateKeys,
            payload: await utils.encryptWithAESKeySync(
              JSON.stringify({ words: data.words, speakers: data.speakers }),
              sessionAesKey,
            ),
          };
        } else {
          // Non-collab: rotate the AES key and re-wrap for all authorized users.
          transcriptionData = await utils.encrypt(currentData, {
            words: data.words,
            speakers: data.speakers,
          });
        }
      }

      // The roster cache travels with the content it summarizes, encrypted for
      // the same accessors. The server can derive it from a plaintext save on
      // its own, but not from an encrypted one — this is what keeps it fresh
      // for E2E documents.
      const speakers = await encodeSpeakerCache(
        data.speakers,
        currentData,
        new EncryptionUtils(browserCrypto),
      );

      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcription: transcriptionData,
            ...(speakers ? { speakers } : {}),
            changeStats,
          }),
        },
      );

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Failed to save transcription");
      }

      return responseData;
    },
    onSuccess: (data) => {
      // Invalidate and refetch transcription queries
      queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transcriptions"],
      });
      return data;
    },
  });
}

/**
 * Refreshes the roster cache of a document that is open, when it does not match
 * the transcript.
 *
 * The cache is written by whoever can read the content: the server on a
 * plaintext write, the editor on every save. That leaves two gaps — documents
 * that predate the cache, and E2E documents reverted or shared since — and this
 * closes them silently the first time someone with a key and write access opens
 * the document. It runs at most once per mount; there is nothing to retry,
 * since the next opening would do it again anyway.
 */
export function useSpeakerCacheSync(
  transcriptionId: string,
  canWrite: boolean,
) {
  const queryClient = useQueryClient();
  const { data: transcription } = useTranscription(transcriptionId);
  // A ref rather than state: this guard gates one fire-and-forget request, and
  // has nothing to show for itself in the render.
  const synced = useRef(false);

  useEffect(() => {
    if (synced.current || !canWrite || !transcription) return;

    const actual = parseSpeakers(transcription.transcription);
    // No readable content (no key on this device, or nothing transcribed yet):
    // there is nothing to refresh the cache from.
    if (!actual || sameSpeakers(actual, transcription.speakers)) return;

    synced.current = true;
    const raw = transcription._raw as { transcription?: EncryptedDataEntity };

    void (async () => {
      try {
        const speakers = await encodeSpeakerCache(
          actual,
          raw?.transcription,
          new EncryptionUtils(browserCrypto),
        );
        if (!speakers) return;
        const response = await fetchGateway(
          `/api/transcriptions/${transcriptionId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ speakers }),
          },
        );
        if (!response.ok) return;
        // The list groups and codes on these names; it is now out of date.
        queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      } catch (error) {
        // A stale cache costs a lazy load, never a broken document.
        console.error("Failed to refresh the speaker cache", error);
      }
    })();
  }, [canWrite, transcription, transcriptionId, queryClient]);
}

/**
 * Codes applied to a document (`codes`) or to its speakers (`speakerCodes`).
 * The mutation replaces the whole list — the server stores it as one JSON
 * array, and a document has a handful of codes, so sending the new state is
 * simpler (and free of merge questions) than sending a patch.
 *
 * Both caches are written on the spot rather than waiting for a refetch: these
 * drive checkboxes in a menu, where a delayed tick reads as a lost click, and
 * the coding board reads the *list* while the editor reads the *detail*.
 */
function useDocumentCodesMutation<T extends CodeRef>(
  transcriptionId: string,
  field: "codes" | "speakerCodes",
) {
  const queryClient = useQueryClient();
  const detailKey = ["transcriptions", transcriptionId];
  const listKey = ["transcriptions"];

  return useMutation({
    mutationFn: async (value: T[]) => {
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save codes");
      }
      return data;
    },
    onMutate: async (value) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: listKey }),
      ]);

      const previousDetail =
        queryClient.getQueryData<DecryptedWithRaw<TranscriptionDetail>>(
          detailKey,
        );
      const previousList = queryClient.getQueryData<Transcription[]>(listKey);

      if (previousDetail) {
        queryClient.setQueryData(detailKey, {
          ...previousDetail,
          [field]: value,
        });
      }
      if (previousList) {
        queryClient.setQueryData(
          listKey,
          previousList.map((doc) =>
            doc.id === transcriptionId ? { ...doc, [field]: value } : doc,
          ),
        );
      }

      return { previousDetail, previousList };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(detailKey, context.previousDetail);
      }
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: detailKey });
      // The sidebar groups on these, so its list is stale too.
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}

/** Codes applied to the document as a whole. */
export function useUpdateDocumentCodes(transcriptionId: string) {
  return useDocumentCodesMutation<CodeRef>(transcriptionId, "codes");
}

/** Codes applied to the individual speakers of a document. */
export function useUpdateSpeakerCodes(transcriptionId: string) {
  return useDocumentCodesMutation<SpeakerCodeRef>(
    transcriptionId,
    "speakerCodes",
  );
}

// Revert transcription mutation
export function useRevertTranscription(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      if (!transcriptionId) throw new Error("No transcription ID");
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/revert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ versionId }),
        },
      );
      if (!response.ok) throw new Error("Failed to revert");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transcription-history", transcriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transcriptions"],
      });
    },
  });
}

// Share transcription mutation
export function useShareTranscription(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      email: string;
      role: "read" | "read+listen" | "write";
      encryptedData?: any;
    }) => {
      if (!transcriptionId) throw new Error("No transcription ID");
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/share`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || "Failed to share transcription");
      }
      return responseData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transcriptions"],
      });
    },
  });
}

// Remove share mutation
export function useRemoveShare(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!transcriptionId) throw new Error("No transcription ID");
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/share?userId=${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) throw new Error("Failed to remove share");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transcriptions"],
      });
    },
  });
}

// Transfer ownership mutation
export function useTransferOwnership(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newOwnerId: string) => {
      if (!transcriptionId) throw new Error("No transcription ID");
      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}/transfer-ownership`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newOwnerId }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to transfer ownership");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["transcriptions", transcriptionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["transcriptions"],
      });
    },
  });
}
