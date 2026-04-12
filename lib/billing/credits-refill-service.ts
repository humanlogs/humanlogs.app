import { prisma } from "../prisma";

export async function refillUserCredits() {
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

  return {
    success: true,
    refilled: updates.length,
    eligible: usersNeedingRefill.length,
    message: `Refilled credits for ${updates.length} users (${usersNeedingRefill.length} eligible)`,
  };
}
