import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This endpoint should be called by a cron job daily/monthly
// It refills credits for users whose subscription is active and last refill was more than 30 days ago
export async function POST(request: NextRequest) {
  try {
    // Simple API key authentication for cron job
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET || "change-this-in-production";

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Find users with active subscriptions who need a refill
    const usersNeedingRefill = await prisma.user.findMany({
      where: {
        subscriptionStatus: "active",
        OR: [
          {
            lastCreditsRefill: {
              lt: thirtyDaysAgo,
            },
          },
          {
            lastCreditsRefill: null,
          },
        ],
      },
      select: {
        id: true,
        credits: true,
        creditsRefill: true,
        lastCreditsRefill: true,
      },
    });

    // Only refill if current credits are below refill amount
    const usersToUpdate = usersNeedingRefill.filter(
      (user) => user.credits < user.creditsRefill,
    );

    const updates = await Promise.all(
      usersToUpdate.map((user) =>
        prisma.user.update({
          where: { id: user.id },
          data: {
            credits: user.creditsRefill,
            lastCreditsRefill: now,
          },
        }),
      ),
    );

    return NextResponse.json({
      success: true,
      refilled: updates.length,
      eligible: usersNeedingRefill.length,
      message: `Refilled credits for ${updates.length} users (${usersNeedingRefill.length} eligible)`,
    });
  } catch (error) {
    console.error("Error in credits refill cron:", error);
    return NextResponse.json(
      { error: "Failed to refill credits" },
      { status: 500 },
    );
  }
}
