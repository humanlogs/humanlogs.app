import { NextResponse } from "next/server";
import { withAdminRateLimit } from "@/lib/admin-middleware";
import { getAppStats } from "@/lib/stats/app-stats";
import { getRetentionCohorts } from "@/lib/stats/retention-stats";

export const GET = withAdminRateLimit(async () => {
  try {
    // Retention is admin-only and deliberately kept out of getAppStats() so it
    // never leaks into the public marketing stats export.
    const [stats, retention] = await Promise.all([
      getAppStats(),
      getRetentionCohorts(),
    ]);
    return NextResponse.json({ ...stats, retention });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin statistics" },
      { status: 500 },
    );
  }
});
