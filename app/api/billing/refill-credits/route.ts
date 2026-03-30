import { NextRequest, NextResponse } from "next/server";
import { refillUserCredits } from "@/lib/credits-refill-service";

// This endpoint can be called manually or by external cron services if needed
// The cron job runs automatically in production via lib/cron-jobs.ts
export async function POST(request: NextRequest) {
  try {
    // Simple API key authentication for manual triggers
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "change-this-in-production";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await refillUserCredits();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in credits refill:", error);
    return NextResponse.json(
      { error: "Failed to refill credits" },
      { status: 500 },
    );
  }
}
