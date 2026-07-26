"use client";

import {
  EncryptionUtils,
  type EncryptedDataEntity,
} from "@/lib/encryption/encryption-entities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  mediaType?: "audio" | "text";
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
      return Promise.all<Transcription>(
        (await response.json()).map(decrypt<Transcription>),
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
      try {
        return await decrypt<TranscriptionDetail>(await response.json());
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
        if (!cancelled)
          setState({ aesKey: k, isEncrypted: true, ready: true });
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

      const response = await fetchGateway(
        `/api/transcriptions/${transcriptionId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transcription: transcriptionData,
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
