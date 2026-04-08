"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGateway } from "./fetch";

type Project = {
  id: string;
  name: string;
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
  isWelcomeDone: boolean;
  isBillingEnabled: boolean;
  isAdmin: boolean;
};
// Fetch projects
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await fetchGateway("/api/projects");
      if (!response.ok) {
        throw new Error("Failed to fetch projects");
      }
      return response.json() as Promise<Project[]>;
    },
  });
}

// Fetch user profile
export function useUserProfile() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const response = await fetchGateway("/api/user");
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
      updateData: Partial<Pick<UserProfile, "language" | "isWelcomeDone">>,
    ) => {
      const response = await fetchGateway("/api/user", {
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

// Admin stats types and hook
export type AdminStats = {
  users: {
    total: number;
    byDay: Record<string, number>;
    active: {
      last24h: number;
      last48h: number;
      last7d: number;
      last30d: number;
    };
  };
  transcriptions: {
    byStatus: Record<string, number>;
    byDay: Record<string, number>;
  };
  credits: {
    totalInStock: number;
    totalUsed: number;
    totalRefill: number;
    usedPerDay: Record<string, number>;
  };
  feedback: {
    recent: Array<{
      id: string;
      type: string;
      rating: number | null;
      message: string | null;
      createdAt: string;
      user: {
        email: string;
        name: string | null;
      };
    }>;
    stats: Array<{
      type: string;
      rating: number | null;
      _count: {
        id: number;
      };
    }>;
    averageRating: number;
  };
};

// Fetch admin statistics
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const response = await fetchGateway("/api/admin/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch admin statistics");
      }
      return response.json() as Promise<AdminStats>;
    },
  });
}
