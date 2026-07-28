"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchGateway } from "./fetch";

export type Project = {
  id: string;
  name: string;
  iconType?: "icon" | "emoji" | "image" | null;
  icon?: string | null;
  color?: string | null;
  hasImage?: boolean;
  updatedAt?: string;
};

export type DataResidency = "eu" | "us";

export type OnboardingStep =
  // Current flow
  | "role"
  | "engage"
  | "provisioning"
  | "security"
  | "done"
  // Legacy values kept for back-compat with already-stored data
  | "profile"
  | "referral"
  | "ready";

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
  createdAt: string;
  credits: number;
  creditsRefill: number;
  creditsUsed: number;
  plan: string;
  isWelcomeDone: boolean;
  onboardingStep: OnboardingStep;
  isBillingEnabled: boolean;
  isAdmin: boolean;
  profession?: string | null;
  monthlyUsage?: string | null;
  dataResidency: DataResidency;
  /** Opt-in to features still in beta (codebooks). */
  betaFeatures: boolean;
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
      const projects = (await response.json()) as Project[];
      // Studies are listed alphabetically everywhere (sidebar, home, pickers).
      return projects.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
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

/**
 * Whether the current user opted into beta features (toggle in /app/account).
 * Defaults to false while the profile is still loading, so beta surfaces never
 * flash in for users who don't have them.
 */
export function useBetaFeatures(): boolean {
  const { data: userProfile } = useUserProfile();
  return userProfile?.betaFeatures === true;
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
          | "onboardingStep"
          | "profession"
          | "monthlyUsage"
          | "dataResidency"
          | "betaFeatures"
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
    byProfession: Record<string, number>;
    byMonthlyUsage: Record<string, number>;
    byDataResidency: Record<string, number>;
    welcomeDoneCount: number;
    byOnboardingStep: Record<string, number>;
    recent: Array<{
      id: string;
      email: string;
      name: string | null;
      createdAt: string;
      plan: string;
      isWelcomeDone: boolean;
      onboardingStep: string;
      profession: string | null;
      monthlyUsage: string | null;
      dataResidency: string | null;
      transcriptionCount: number;
      revisionCount: number;
      minutesUsed: number;
    }>;
  };
  transcriptions: {
    byStatus: Record<string, number>;
    byDay: Record<string, number>;
    byDayByStatus: Record<
      string,
      { completed: number; error: number; pending: number }
    >;
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
    recent: Array<{
      id: string;
      email: string;
      name: string | null;
      plan: string;
      type: "subscription" | "one-time";
      subscriptionStatus: string | null;
      credits: number;
      minutesUsed: number;
      createdAt: string;
      paidAt: string;
      hasPaymentDate: boolean;
    }>;
  };
  referrals: {
    totalInvites: number;
    totalRegistered: number;
    conversionRate: number;
    totalBonusCredits: number;
    topReferrers: Array<{
      id: string;
      email: string;
      name: string | null;
      invited: number;
      registered: number;
      bonusCredits: number;
    }>;
  };
  landing: {
    totalUniqueVisitors: number;
    visitorsByDay: Record<string, number>;
    byPage: Array<{
      page: string;
      uniqueVisitors: number;
    }>;
  };
  retention: {
    weeks: number;
    maxOffset: number;
    cohorts: Array<{
      weekStart: string;
      size: number;
      retention: number[];
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

// Newsletter subscribers (admin)
export type NewsletterSubscriber = {
  id: string;
  email: string;
  locale: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  /** True when this address also belongs to a registered account. */
  isUser: boolean;
};

export type NewsletterSubscribers = {
  subscribers: NewsletterSubscriber[];
  page: number;
  pageSize: number;
  /** Number of subscribers matching the current search. */
  matching: number;
  stats: {
    total: number;
    last30Days: number;
    last7Days: number;
    bySource: Record<string, number>;
    byLocale: Record<string, number>;
    byDay: Record<string, number>;
    totalUsers: number;
  };
};

export function useNewsletterSubscribers({
  search = "",
  page = 1,
  pageSize = 50,
  enabled = true,
}: {
  search?: string;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: ["admin", "newsletter", { search, page, pageSize }],
    enabled,
    // Keep the previous page visible while the next one loads, so the table
    // doesn't collapse on every keystroke.
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);

      const response = await fetchGateway(`/api/admin/newsletter?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch newsletter subscribers");
      }
      return response.json() as Promise<NewsletterSubscribers>;
    },
  });
}

export type EmailExportType = "newsletter" | "users" | "all";
export type EmailExportFormat = "csv" | "txt";

/**
 * Download the admin email export as a file. Goes through `fetchGateway` (not
 * a plain link) so 401/429 responses are handled like every other API call and
 * failures surface as an error instead of a broken download.
 */
export async function downloadEmailExport(
  type: EmailExportType,
  format: EmailExportFormat = "csv",
) {
  const response = await fetchGateway(
    `/api/admin/emails/export?type=${type}&format=${format}`,
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Failed to export emails");
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ??
    `humanlogs-emails-${type}.${format}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return {
    filename,
    count: Number(response.headers.get("X-Email-Count") ?? 0),
  };
}
