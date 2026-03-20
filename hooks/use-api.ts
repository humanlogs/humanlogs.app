"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Project = {
  id: string;
  name: string;
};

type Transcription = {
  id: string;
  title: string;
  updatedAt: string;
  projectId?: string;
  state: "PENDING" | "TRANSCRIBING" | "COMPLETED" | "ERROR";
  errorMessage?: string | null;
};

type UserProfile = {
  id: string;
  email: string;
  name?: string;
  language: string;
  credits: number;
  creditsRefill: number;
  plan: string;
};

// Fetch projects
export function useProjects() {
  return useQuery({
    queryKey: ["project"],
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
  return useQuery({
    queryKey: ["transcription"],
    queryFn: async () => {
      const response = await fetch("/api/transcriptions");
      if (!response.ok) {
        throw new Error("Failed to fetch transcriptions");
      }
      return response.json() as Promise<Transcription[]>;
    },
  });
}

// Fetch user profile
export function useUserProfile() {
  return useQuery({
    queryKey: ["user"],
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
export function useUpdateUserLanguage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (language: string) => {
      const response = await fetch("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ language }),
      });

      if (!response.ok) {
        throw new Error("Failed to update language");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });
}
