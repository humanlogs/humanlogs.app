import { NextRequest, NextResponse } from "next/server";
import { withAdminRateLimit } from "@/lib/admin-middleware";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function parseIntParam(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Paginated list of newsletter subscribers plus aggregate stats, for the
 * admin dashboard. Supports a free-text `search` on the email address.
 */
export const GET = withAdminRateLimit(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const search = (searchParams.get("search") ?? "").trim().slice(0, 254);
    const page = Math.max(1, parseIntParam(searchParams.get("page"), 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseIntParam(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
      ),
    );

    const where = search
      ? { email: { contains: search, mode: "insensitive" as const } }
      : {};

    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      matching,
      total,
      subscribers,
      last30DaysCount,
      last7DaysCount,
      bySourceRaw,
      byLocaleRaw,
      createdLast30Days,
      totalUsers,
    ] = await Promise.all([
      prisma.newsletterSubscription.count({ where }),
      prisma.newsletterSubscription.count(),
      prisma.newsletterSubscription.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          locale: true,
          source: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.newsletterSubscription.count({
        where: { createdAt: { gte: last30Days } },
      }),
      prisma.newsletterSubscription.count({
        where: { createdAt: { gte: last7Days } },
      }),
      prisma.newsletterSubscription.groupBy({
        by: ["source"],
        _count: { id: true },
      }),
      prisma.newsletterSubscription.groupBy({
        by: ["locale"],
        _count: { id: true },
      }),
      prisma.newsletterSubscription.findMany({
        where: { createdAt: { gte: last30Days } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count(),
    ]);

    // Flag subscribers who also have an account, so the admin can tell
    // prospects apart from existing customers at a glance.
    const emails = subscribers.map((s) => s.email);
    const existingUsers = emails.length
      ? await prisma.user.findMany({
          where: { email: { in: emails } },
          select: { email: true },
        })
      : [];
    const userEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const byDay: Record<string, number> = {};
    createdLast30Days.forEach((s) => {
      const day = s.createdAt.toISOString().split("T")[0];
      byDay[day] = (byDay[day] || 0) + 1;
    });

    const toRecord = (rows: Array<{ _count: { id: number } }>, key: string) =>
      rows.reduce<Record<string, number>>((acc, row) => {
        acc[String((row as any)[key] ?? "unknown")] = row._count.id;
        return acc;
      }, {});

    return NextResponse.json({
      subscribers: subscribers.map((s) => ({
        ...s,
        isUser: userEmails.has(s.email.toLowerCase()),
      })),
      page,
      pageSize,
      matching,
      stats: {
        total,
        last30Days: last30DaysCount,
        last7Days: last7DaysCount,
        bySource: toRecord(bySourceRaw, "source"),
        byLocale: toRecord(byLocaleRaw, "locale"),
        byDay,
        totalUsers,
      },
    });
  } catch (error) {
    console.error("Error fetching newsletter subscribers:", error);
    return NextResponse.json(
      { error: "Failed to fetch newsletter subscribers" },
      { status: 500 },
    );
  }
});
