import { prisma } from "@/lib/prisma";

/**
 * Gather aggregated application statistics (users, transcriptions, credits,
 * feedback, paying customers, landing page visits).
 *
 * This is shared between the admin dashboard endpoint
 * (`app/api/admin/stats`, session + admin gated) and the token-protected
 * marketing stats export (`app/api/stats`). Keep it side-effect free so both
 * callers can serialize the result straight to JSON.
 */
export async function getAppStats() {
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

  // 4. Transcripts created per day in the last 30 days (broken down by status)
  const transcriptsCreatedLast30Days = await prisma.transcription.findMany({
    where: {
      createdAt: {
        gte: last30Days,
      },
    },
    select: {
      createdAt: true,
      state: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Total per day (kept for backward compatibility with the stats export)
  const transcriptsByDay: Record<string, number> = {};
  // Per-status breakdown per day, used by the stacked bar chart on the admin
  // dashboard (green = completed, red = error, orange = pending).
  const transcriptsByDayByStatus: Record<
    string,
    { completed: number; error: number; pending: number }
  > = {};
  transcriptsCreatedLast30Days.forEach((transcript) => {
    const day = transcript.createdAt.toISOString().split("T")[0];
    transcriptsByDay[day] = (transcriptsByDay[day] || 0) + 1;
    if (!transcriptsByDayByStatus[day]) {
      transcriptsByDayByStatus[day] = { completed: 0, error: 0, pending: 0 };
    }
    if (transcript.state === "COMPLETED") {
      transcriptsByDayByStatus[day].completed += 1;
    } else if (transcript.state === "ERROR") {
      transcriptsByDayByStatus[day].error += 1;
    } else {
      transcriptsByDayByStatus[day].pending += 1;
    }
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

  // 10. Customer profile breakdowns (onboarding data)
  const professionGroups = await prisma.user.groupBy({
    by: ["profession"],
    _count: { id: true },
    where: { profession: { not: null } },
  });
  const byProfession = professionGroups.reduce(
    (acc, g) => {
      if (g.profession) acc[g.profession] = g._count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  const monthlyUsageGroups = await prisma.user.groupBy({
    by: ["monthlyUsage"],
    _count: { id: true },
    where: { monthlyUsage: { not: null } },
  });
  const byMonthlyUsage = monthlyUsageGroups.reduce(
    (acc, g) => {
      if (g.monthlyUsage) acc[g.monthlyUsage] = g._count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  const dataResidencyGroups = await prisma.user.groupBy({
    by: ["dataResidency"],
    _count: { id: true },
  });
  const byDataResidency = dataResidencyGroups.reduce(
    (acc, g) => {
      acc[g.dataResidency] = g._count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  const welcomeDoneCount = await prisma.user.count({
    where: { isWelcomeDone: true },
  });

  // Onboarding funnel: how many users reached (as their furthest point) each
  // step of the welcome flow. Lets us see exactly where people drop off.
  const onboardingStepGroups = await prisma.user.groupBy({
    by: ["onboardingStep"],
    _count: { id: true },
  });
  const byOnboardingStep = onboardingStepGroups.reduce(
    (acc, g) => {
      acc[g.onboardingStep] = g._count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  // 10b. Ten most recently registered users with their usage (transcriptions,
  // editor revisions) and onboarding profile, to gauge new-user engagement.
  const latestUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      isWelcomeDone: true,
      onboardingStep: true,
      profession: true,
      monthlyUsage: true,
      dataResidency: true,
      plan: true,
      creditsUsed: true,
    },
  });
  const latestUserIds = latestUsers.map((u) => u.id);

  // Transcription counts per recent user
  const transcriptionCountsByUser = await prisma.transcription.groupBy({
    by: ["userId"],
    where: { userId: { in: latestUserIds } },
    _count: { id: true },
  });
  const transcriptionCountMap = transcriptionCountsByUser.reduce(
    (acc, g) => {
      acc[g.userId] = g._count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Revision counts per recent user (each TranscriptionHistory row = one saved revision)
  const revisionCountsByUser = await prisma.transcriptionHistory.groupBy({
    by: ["userId"],
    where: { userId: { in: latestUserIds } },
    _count: { id: true },
  });
  const revisionCountMap = revisionCountsByUser.reduce(
    (acc, g) => {
      acc[g.userId] = g._count.id;
      return acc;
    },
    {} as Record<string, number>,
  );

  const recentUsers = latestUsers.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt,
    plan: u.plan,
    isWelcomeDone: u.isWelcomeDone,
    onboardingStep: u.onboardingStep,
    profession: u.profession,
    monthlyUsage: u.monthlyUsage,
    dataResidency: u.dataResidency,
    transcriptionCount: transcriptionCountMap[u.id] || 0,
    revisionCount: revisionCountMap[u.id] || 0,
    // 1 credit = 1 minute of transcription, so creditsUsed is the total
    // minutes this user has consumed.
    minutesUsed: u.creditsUsed,
  }));

  // 10c. Latest paying customers. "Paying" mirrors the counters above:
  // subscribers (plan != "free") plus one-time buyers (free plan but topped up
  // beyond their refill allowance). We pre-narrow to users who at least started
  // a Stripe checkout, then keep only those who actually paid, and order by the
  // most recent payment (falling back to updatedAt for payments made before
  // lastPaymentAt was tracked).
  const payingCandidates = await prisma.user.findMany({
    where: {
      OR: [{ plan: { not: "free" } }, { stripeCustomerId: { not: null } }],
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      plan: true,
      credits: true,
      creditsUsed: true,
      creditsRefill: true,
      subscriptionStatus: true,
      lastPaymentAt: true,
    },
  });

  const recentPayingCustomers = payingCandidates
    .filter((u) => u.plan !== "free" || u.credits > u.creditsRefill)
    .map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      plan: u.plan,
      type: u.plan !== "free" ? "subscription" : "one-time",
      subscriptionStatus: u.subscriptionStatus,
      credits: u.credits,
      minutesUsed: u.creditsUsed,
      createdAt: u.createdAt,
      // Best-known payment date: the tracked payment timestamp, else the last
      // activity date as a proxy for older payers.
      paidAt: u.lastPaymentAt ?? u.updatedAt,
      hasPaymentDate: u.lastPaymentAt !== null,
    }))
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
    .slice(0, 10);

  // 10d. Referral program overview.
  const totalInvites = await prisma.referral.count();
  const totalRegistered = await prisma.referral.count({
    where: { status: "REGISTERED" },
  });
  const referralBonusAgg = await prisma.user.aggregate({
    _sum: { referralBonusCredits: true },
  });

  // Per-referrer breakdown (invited vs. registered) to surface the top
  // advocates.
  const referralGroups = await prisma.referral.groupBy({
    by: ["referrerId", "status"],
    _count: { id: true },
  });
  const referrerTotals: Record<
    string,
    { invited: number; registered: number }
  > = {};
  referralGroups.forEach((g) => {
    if (!referrerTotals[g.referrerId]) {
      referrerTotals[g.referrerId] = { invited: 0, registered: 0 };
    }
    if (g.status === "REGISTERED") {
      referrerTotals[g.referrerId].registered += g._count.id;
    } else {
      referrerTotals[g.referrerId].invited += g._count.id;
    }
  });

  const topReferrerIds = Object.entries(referrerTotals)
    .sort((a, b) => {
      // Most conversions first, then most invitations sent.
      if (b[1].registered !== a[1].registered) {
        return b[1].registered - a[1].registered;
      }
      return b[1].invited - a[1].invited;
    })
    .slice(0, 10)
    .map(([id]) => id);

  const topReferrerUsers = await prisma.user.findMany({
    where: { id: { in: topReferrerIds } },
    select: { id: true, email: true, name: true, referralBonusCredits: true },
  });
  const topReferrerUserMap = topReferrerUsers.reduce(
    (acc, u) => {
      acc[u.id] = u;
      return acc;
    },
    {} as Record<string, (typeof topReferrerUsers)[number]>,
  );

  const topReferrers = topReferrerIds
    .map((id) => {
      const user = topReferrerUserMap[id];
      if (!user) return null;
      const totals = referrerTotals[id];
      return {
        id,
        email: user.email,
        name: user.name,
        invited: totals.invited + totals.registered,
        registered: totals.registered,
        bonusCredits: user.referralBonusCredits,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // 11. Landing page visits
  const totalUniqueVisitors = await prisma.landingPageVisit.groupBy({
    by: ["ipHash"],
    _count: {
      ipHash: true,
    },
  });

  // Visits per day in the last 30 days (all pages combined)
  const visitsLast30Days = await prisma.landingPageVisit.findMany({
    where: {
      visitDate: {
        gte: last30Days.toISOString().split("T")[0],
      },
    },
    select: {
      visitDate: true,
      ipHash: true,
      page: true,
    },
  });

  // Group unique IPs by day (across all pages)
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

  // Group by page (unique visitors per page)
  const visitorsByPage: Record<string, Set<string>> = {};
  visitsLast30Days.forEach((visit) => {
    if (!visitorsByPage[visit.page]) {
      visitorsByPage[visit.page] = new Set();
    }
    visitorsByPage[visit.page].add(visit.ipHash);
  });

  // Convert to array with counts
  const pageStats = Object.entries(visitorsByPage)
    .map(([page, ips]) => ({
      page,
      uniqueVisitors: ips.size,
    }))
    .sort((a, b) => b.uniqueVisitors - a.uniqueVisitors);

  return {
    users: {
      total: totalUsers,
      byDay: usersByDay,
      active: {
        last24h: activeUsersLast24h,
        last48h: activeUsersLast48h,
        last7d: activeUsersLast7d,
        last30d: activeUsersLast30d,
      },
      byProfession,
      byMonthlyUsage,
      byDataResidency,
      welcomeDoneCount,
      byOnboardingStep,
      recent: recentUsers,
    },
    transcriptions: {
      byStatus: transcriptsByStatus,
      byDay: transcriptsByDay,
      byDayByStatus: transcriptsByDayByStatus,
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
      recent: recentPayingCustomers,
    },
    referrals: {
      totalInvites,
      totalRegistered,
      conversionRate:
        totalInvites > 0 ? totalRegistered / totalInvites : 0,
      totalBonusCredits: referralBonusAgg._sum.referralBonusCredits || 0,
      topReferrers,
    },
    landing: {
      totalUniqueVisitors: totalUniqueVisitors.length,
      visitorsByDay: visitorsByDay,
      byPage: pageStats,
    },
  };
}
