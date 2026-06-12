import { NextResponse } from "next/server";
import { withAdminRateLimit } from "@/lib/admin-middleware";
import { getAppStats } from "@/lib/stats/app-stats";

export const GET = withAdminRateLimit(async () => {
  try {
    const stats = await getAppStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin statistics" },
      { status: 500 },
    );
  }
});
