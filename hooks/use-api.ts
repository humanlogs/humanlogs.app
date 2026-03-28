"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

type Project = {
  id: string;
  name: string;
};

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

export type UserProfile = {
  id: string;
  email: string;
  name?: string;
  language: string;
  credits: number;
  creditsRefill: number;
  creditsUsed: number;
  plan: string;
  isWelcomeCompleted: boolean;
  isBillingEnabled: boolean;
};

// Module-level variables for global polling
let pollingInterval: NodeJS.Timeout | null = null;
let activeSubscribers = 0;

// Fetch projects
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetch("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      return response.json() as Promise<Project[]>;
    },
  });
}

// Fetch transcriptions
export function useTranscriptions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transcriptions"],
    queryFn: async () => {
      const response = await fetch("/api/transcriptions");
      if (!response.ok) {
        throw new Error("Failed to fetch transcriptions");
      }
      return response.json() as Promise<Transcription[]>;
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
      return response.json() as Promise<TranscriptionDetail>;
    },
    enabled: !!id,
  });
}

// Fetch user profile
export function useUserProfile() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetch("/api/user");
      if (!response.ok) {
        throw new Error("Failed to fetch user profile");
      }
      return response.json() as Promise<UserProfile>;
    },
  });
}

// Update user language
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updateData: Partial<Pick<UserProfile, "language" | "isWelcomeCompleted">>,
    ) => {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error("Failed to update language");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
