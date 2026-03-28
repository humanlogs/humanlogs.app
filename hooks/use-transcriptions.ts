"use client";

import {
  EncryptionUtils,
  type EncryptedDataEntity,
} from "@/lib/encryption-entities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { browserCrypto } from "../lib/encryption-entities.browser";
import { useDecryptData } from "./use-encryption";

type Transcription = {
  id: string;
  title: string;
  updatedAt: string;
  projectId?: string;
  state: "PENDING" | "COMPLETED" | "ERROR";
  errorMessage?: string | null;
};

export type TranscriptionDetail = {
  id: string;
  title: string;
  audioFileName: string;
  audioFileSize: number;
  audioFileKey: string;
  audioFileEncryption?: string;
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

// Module-level variables for global polling
let pollingInterval: NodeJS.Timeout | null = null;
let activeSubscribers = 0;

// Fetch transcriptions
export function useTranscriptions() {
  const queryClient = useQueryClient();
  const decrypt = useDecryptData();

  const query = useQuery({
    queryKey: ["transcriptions"],
    queryFn: async () => {
      const response = await fetch("/api/transcriptions");
      if (!response.ok) {
        throw new Error("Failed to fetch transcriptions");
      }
      return Promise.all<Transcription>(
        (await response.json()).map(decrypt<Transcription>),
      );
    },
  });

  // Track active subscribers
  useEffect(() => {
    activeSubscribers++;
    return () => {
      activeSubscribers--;
      // Clear interval only if no active subscribers
      if (activeSubscribers === 0 && pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };
  }, []);

  // Manage polling based on pending transcriptions
  useEffect(() => {
    const hasPending = query.data?.some((t) => t.state === "PENDING");

    if (hasPending && !pollingInterval) {
      // Start polling every 10 seconds
      pollingInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["transcriptions"] });
      }, 10000);
    } else if (!hasPending && pollingInterval) {
      // Stop polling when no pending transcriptions
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  }, [query.data, queryClient]);

  return query;
}

// Fetch single transcription
export function useTranscription(id: string) {
  const decrypt = useDecryptData();
  return useQuery({
    queryKey: ["transcriptions", id],
    queryFn: async () => {
      const response = await fetch(`/api/transcriptions/${id}`);
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
      return await decrypt<TranscriptionDetail>(await response.json());
    },
    enabled: !!id,
  });
}

// Fetch transcription history
export function useTranscriptionHistory(transcriptionId: string) {
  return useQuery({
    queryKey: ["transcription-history", transcriptionId],
    queryFn: async () => {
      if (!transcriptionId) return [];
      const response = await fetch(
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
      const response = await fetch(
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
export function useSaveTranscription(transcriptionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      words: TranscriptionSegment[];
      speakers: { id: string; name?: string }[];
    }) => {
      //Get the current transcription to calculate changes and get encryption entity
      const currentTranscription =
        queryClient.getQueryData<TranscriptionDetail>([
          "transcriptions",
          transcriptionId,
        ]);

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
      const currentData = currentTranscription?.transcription as any;
      if (currentData?.privateKeys && currentData?.payload) {
        // Encrypt the new transcription data using the existing entity template
        const encryptedEntity = currentData as EncryptedDataEntity;
        transcriptionData = await new EncryptionUtils(browserCrypto).encrypt(
          encryptedEntity,
          {
            words: data.words,
            speakers: data.speakers,
          },
        );
      }

      const response = await fetch(`/api/transcriptions/${transcriptionId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcription: transcriptionData,
          changeStats,
        }),
      });

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
      const response = await fetch(
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
