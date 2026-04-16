import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withAdminRateLimit } from "@/lib/admin-middleware";

export const GET = withAdminRateLimit(async (request, user) => {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last48Hours = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Total number of users
    const totalUsers = await prisma.user.count();

    // 2. Number of users created per day in the last 30 days
    const usersLast30Days = await prisma.user.findMany({
      where: {
        createdAt: {
          gte: last30Days,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Group by day
    const usersByDay: Record<string, number> = {};
    usersLast30Days.forEach((user) => {
      const day = user.createdAt.toISOString().split("T")[0];
      usersByDay[day] = (usersByDay[day] || 0) + 1;
    });

    // 3. Number of transcripts per status in the last 30d
    const transcriptsLast30Days = await prisma.transcription.groupBy({
      by: ["state"],
      where: {
        createdAt: {
          gte: last30Days,
        },
      },
      _count: {
        id: true,
      },
    });

    const transcriptsByStatus = transcriptsLast30Days.reduce(
      (acc, item) => {
        acc[item.state] = item._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // 4. Transcripts created per day in the last 30 days
    const transcriptsCreatedLast30Days = await prisma.transcription.findMany({
      where: {
        createdAt: {
          gte: last30Days,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const transcriptsByDay: Record<string, number> = {};
    transcriptsCreatedLast30Days.forEach((transcript) => {
      const day = transcript.createdAt.toISOString().split("T")[0];
      transcriptsByDay[day] = (transcriptsByDay[day] || 0) + 1;
    });

    // 5. Number of users connected in the last 24h, 48h, 7d, 30d
    // Note: This is based on updatedAt, which gets updated when they interact with the app
    const activeUsersLast24h = await prisma.user.count({
      where: {
        updatedAt: {
          gte: last24Hours,
        },
      },
    });

    const activeUsersLast48h = await prisma.user.count({
      where: {
        updatedAt: {
          gte: last48Hours,
        },
      },
    });

    const activeUsersLast7d = await prisma.user.count({
      where: {
        updatedAt: {
          gte: last7Days,
        },
      },
    });

    const activeUsersLast30d = await prisma.user.count({
      where: {
        updatedAt: {
          gte: last30Days,
        },
      },
    });

    // 6. Total number of credits - sum all users' credits
    const creditStats = await prisma.user.aggregate({
      _sum: {
        credits: true,
        creditsUsed: true,
        creditsRefill: true,
      },
    });

    // Calculate total credits "in stock" (available credits)
    const totalCreditsInStock = creditStats._sum.credits || 0;
    const totalCreditsUsed = creditStats._sum.creditsUsed || 0;
    const totalCreditsRefill = creditStats._sum.creditsRefill || 0;

    // 7. Credits used per day (simplified estimation based on transcriptions)
    // Since we don't have a direct cost field, we'll estimate based on audio file size
    // For now, we'll use creditsUsed from users and aggregate by their update patterns
    // A more accurate approach would be to track credits per transcription
    const transcriptionsWithDates = await prisma.transcription.findMany({
      where: {
        createdAt: {
          gte: last30Days,
        },
        state: "COMPLETED",
      },
      select: {
        createdAt: true,
        audioFileSize: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Estimate credits per transcription (rough: 1 credit per minute, ~1MB per minute of audio)
    const creditsPerDay: Record<string, number> = {};
    transcriptionsWithDates.forEach((transcript) => {
      const day = transcript.createdAt.toISOString().split("T")[0];
      // Rough estimate: 1MB = 1 minute = 1 credit
      const estimatedCredits = Math.ceil(
        transcript.audioFileSize / (1024 * 1024),
      );
      creditsPerDay[day] = (creditsPerDay[day] || 0) + estimatedCredits;
    });

    // 8. User feedbacks
    const feedbacks = await prisma.feedback.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100, // Limit to last 100 feedbacks
      select: {
        id: true,
        type: true,
        rating: true,
        message: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    // Also get feedback stats
    const feedbackStats = await prisma.feedback.groupBy({
      by: ["type", "rating"],
      _count: {
        id: true,
      },
    });

    const averageRating = await prisma.feedback.aggregate({
      where: {
        rating: {
          not: null,
        },
      },
      _avg: {
        rating: true,
      },
    });

    // 9. Paying customers
    // One-time purchases: plan == "free" && credits > creditsRefill (they bought credits)
    const freeUsers = await prisma.user.findMany({
      where: {
        plan: "free",
      },
      select: {
        credits: true,
        creditsRefill: true,
      },
    });

    const oneTimePurchaseCustomers = freeUsers.filter(
      (user) => user.credits > user.creditsRefill,
    ).length;

    // Subscribed: plan != "free"
    const subscribedCustomers = await prisma.user.count({
      where: {
        plan: {
          not: "free",
        },
      },
    });

    // 10. Landing page visits
    const totalUniqueVisitors = await prisma.landingPageVisit.groupBy({
      by: ["ipHash"],
      _count: {
        ipHash: true,
      },
    });

    // Visits per day in the last 30 days
    const visitsLast30Days = await prisma.landingPageVisit.findMany({
      where: {
        visitDate: {
          gte: last30Days.toISOString().split("T")[0],
        },
      },
      select: {
        visitDate: true,
        ipHash: true,
      },
    });

    // Group unique IPs by day
    const uniqueVisitorsByDay: Record<string, Set<string>> = {};
    visitsLast30Days.forEach((visit) => {
      if (!uniqueVisitorsByDay[visit.visitDate]) {
        uniqueVisitorsByDay[visit.visitDate] = new Set();
      }
      uniqueVisitorsByDay[visit.visitDate].add(visit.ipHash);
    });

    // Convert to counts
    const visitorsByDay: Record<string, number> = {};
    Object.entries(uniqueVisitorsByDay).forEach(([day, ips]) => {
      visitorsByDay[day] = ips.size;
    });

    return NextResponse.json({
      users: {
        total: totalUsers,
        byDay: usersByDay,
        active: {
          last24h: activeUsersLast24h,
          last48h: activeUsersLast48h,
          last7d: activeUsersLast7d,
          last30d: activeUsersLast30d,
        },
      },
      transcriptions: {
        byStatus: transcriptsByStatus,
        byDay: transcriptsByDay,
      },
      credits: {
        totalInStock: totalCreditsInStock,
        totalUsed: totalCreditsUsed,
        totalRefill: totalCreditsRefill,
        usedPerDay: creditsPerDay,
      },
      feedback: {
        recent: feedbacks,
        stats: feedbackStats,
        averageRating: averageRating._avg.rating || 0,
      },
      paying: {
        oneTime: oneTimePurchaseCustomers,
        subscribed: subscribedCustomers,
        total: oneTimePurchaseCustomers + subscribedCustomers,
      },
      landing: {
        totalUniqueVisitors: totalUniqueVisitors.length,
        visitorsByDay: visitorsByDay,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin statistics" },
      { status: 500 },
    );
  }
});
