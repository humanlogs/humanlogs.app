"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGateway } from "./fetch";

type Project = {
  id: string;
  name: string;
};

export type DataResidency = "eu" | "us";

export type AvailableSttProviders = {
  eu: boolean;
  us: boolean;
  whisper: boolean;
  default: DataResidency;
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
  profession?: string | null;
  monthlyUsage?: string | null;
  dataResidency: DataResidency;
  referralBonusCredits: number;
  availableSttProviders: AvailableSttProviders;
};

export type ReferralSummary = {
  referrals: Array<{
    id: string;
    email: string;
    status: "INVITED" | "REGISTERED";
    createdAt: string;
    registeredAt: string | null;
  }>;
  total: number;
  registeredCount: number;
  bonusCredits: number;
  bonusPerReferral: number;
  maxReferrals: number;
  remainingSlots: number;
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

// Update user profile (language, onboarding profile, data residency, ...)
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updateData: Partial<
        Pick<
          UserProfile,
          | "language"
          | "isWelcomeDone"
          | "profession"
          | "monthlyUsage"
          | "dataResidency"
        >
      >,
    ) => {
      const response = await fetchGateway("/api/user", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error("Failed to update user profile");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// Fetch referral summary
export function useReferrals() {
  return useQuery({
    queryKey: ["referrals"],
    queryFn: async () => {
      const response = await fetchGateway("/api/user/referrals");
      if (!response.ok) {
        throw new Error("Failed to fetch referrals");
      }
      return response.json() as Promise<ReferralSummary>;
    },
  });
}

// Add referral emails (sends invitations and updates the summary)
export function useAddReferrals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emails: string[]) => {
      const response = await fetchGateway("/api/user/referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emails }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to add referrals");
      }

      return response.json() as Promise<ReferralSummary>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["referrals"], data);
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
    },
  });
}

// Remove a pending referral invitation
export function useRemoveReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (referralId: string) => {
      const response = await fetchGateway(
        `/api/user/referrals?id=${encodeURIComponent(referralId)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to remove referral");
      }

      return response.json() as Promise<ReferralSummary>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["referrals"], data);
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
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
  paying: {
    oneTime: number;
    subscribed: number;
    total: number;
  };
  landing: {
    totalUniqueVisitors: number;
    visitorsByDay: Record<string, number>;
    byPage: Array<{
      page: string;
      uniqueVisitors: number;
    }>;
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
