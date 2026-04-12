import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

type HistoryEntry = {
  id: string;
  updatedAt: Date;
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

// Merge a group of history entries, keeping the most recent and summing stats
function mergeHistoryGroup(group: HistoryEntry[]): HistoryEntry {
  if (group.length === 1) {
    return group[0];
  }

  // Keep the most recent entry (first in group since sorted desc)
  const mostRecent = group[0];

  // Sum up all the stats
  const totalAdditions = group.reduce((sum, e) => sum + e.additions, 0);
  const totalRemovals = group.reduce((sum, e) => sum + e.removals, 0);
  const totalChanged = group.reduce((sum, e) => sum + e.changed, 0);

  return {
    ...mostRecent,
    additions: totalAdditions,
    removals: totalRemovals,
    changed: totalChanged,
  };
}

export const GET = withAuthRateLimit(
  async (request, user, { params }: RouteParams) => {
    try {
      const { id } = await params;

      // Fetch the transcription to verify ownership
      const transcription = await prisma.transcription.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!transcription) {
        return NextResponse.json(
          { error: "Transcription not found" },
          { status: 404 },
        );
      }

      if (transcription.userId !== user.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      // Fetch history entries for this transcription with stats
      const history = await prisma.transcriptionHistory.findMany({
        where: {
          transcriptionId: id,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          updatedAt: true,
          updatedBy: true,
          userId: true,
          additions: true,
          removals: true,
          changed: true,
        },
      });

      // Fetch all users that appear in history
      const userIds = [
        ...new Set(history.map((h: { userId: string }) => h.userId)),
      ] as string[];
      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      // Create a map of users by ID
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Map history entries with user data
      const historyWithStats: HistoryEntry[] = history.map((entry) => {
        const userData = userMap.get(entry.userId) || {
          id: entry.userId,
          name: null,
          email: "Unknown User",
        };

        return {
          id: entry.id,
          updatedAt: entry.updatedAt,
          updatedBy: entry.updatedBy,
          user: userData,
          additions: entry.additions,
          removals: entry.removals,
          changed: entry.changed,
        };
      });

      // Group history entries based on age:
      // - Recent (<1 day): group every 5 minutes
      // - Mid (1-7 days): group every 15 minutes
      // - Old (>7 days): group every 30 minutes
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentHistory: HistoryEntry[] = [];
      const midHistory: HistoryEntry[] = [];
      const oldHistory: HistoryEntry[] = [];

      // Separate history by age
      for (const entry of historyWithStats) {
        if (entry.updatedAt > oneDayAgo) {
          recentHistory.push(entry);
        } else if (entry.updatedAt > sevenDaysAgo) {
          midHistory.push(entry);
        } else {
          oldHistory.push(entry);
        }
      }

      // Helper function to group entries within a time window
      const groupByTimeWindow = (
        entries: HistoryEntry[],
        windowMs: number,
      ): HistoryEntry[] => {
        const grouped: HistoryEntry[] = [];
        let currentGroup: HistoryEntry[] = [];

        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];

          // Don't group significant changes (>100 words added or removed)
          const isSignificantChange =
            entry.additions > 100 || entry.removals > 100;

          if (currentGroup.length === 0) {
            currentGroup.push(entry);
          } else {
            const lastEntry = currentGroup[currentGroup.length - 1];
            const timeDiff =
              lastEntry.updatedAt.getTime() - entry.updatedAt.getTime();

            // Group only if within time window AND neither entry is significant
            const lastIsSignificant =
              lastEntry.additions > 100 || lastEntry.removals > 100;

            if (
              timeDiff <= windowMs &&
              !isSignificantChange &&
              !lastIsSignificant
            ) {
              currentGroup.push(entry);
            } else {
              grouped.push(mergeHistoryGroup(currentGroup));
              currentGroup = [entry];
            }
          }
        }

        if (currentGroup.length > 0) {
          grouped.push(mergeHistoryGroup(currentGroup));
        }

        return grouped;
      };

      // Group each category with appropriate time window
      const groupedRecentHistory = groupByTimeWindow(
        recentHistory,
        5 * 60 * 1000,
      ); // 5 minutes
      const groupedMidHistory = groupByTimeWindow(midHistory, 15 * 60 * 1000); // 15 minutes
      const groupedOldHistory = groupByTimeWindow(oldHistory, 30 * 60 * 1000); // 30 minutes

      // Combine all grouped history
      const finalHistory = [
        ...groupedRecentHistory.map((e) => ({
          ...e,
          updatedAt: e.updatedAt.toISOString(),
        })),
        ...groupedMidHistory.map((e) => ({
          ...e,
          updatedAt: e.updatedAt.toISOString(),
        })),
        ...groupedOldHistory.map((e) => ({
          ...e,
          updatedAt: e.updatedAt.toISOString(),
        })),
      ];

      return NextResponse.json(finalHistory);
    } catch (error) {
      console.error("Error fetching transcription history:", error);
      return NextResponse.json(
        { error: "Failed to fetch history" },
        { status: 500 },
      );
    }
  },
);
