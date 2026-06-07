import { prisma } from "../prisma";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function refillUserCredits() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  // Find active subscribers who are due for a refill
  const usersNeedingRefill = await prisma.user.findMany({
    where: {
      subscriptionStatus: "active",
      OR: [{ lastCreditsRefill: { lt: thirtyDaysAgo } }, { lastCreditsRefill: null }],
    },
    select: {
      id: true,
      credits: true,
      creditsRefill: true,
      referralBonusCredits: true,
      lastCreditsRefill: true,
    },
  });

  // Subscribers get their plan allotment plus any referral bonus.
  // Only refill if current credits are below the target amount.
  const subscribersToUpdate = usersNeedingRefill.filter(
    (user) => user.credits < user.creditsRefill + user.referralBonusCredits,
  );

  const subscriberUpdates = await Promise.all(
    subscribersToUpdate.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          credits: user.creditsRefill + user.referralBonusCredits,
          lastCreditsRefill: now,
        },
      }),
    ),
  );

  // Free users (no active subscription) with a referral bonus get that bonus
  // added on top of their balance every month. We match an explicit null OR
  // not-"active" because SQL three-valued logic would otherwise drop the many
  // free users whose subscriptionStatus is NULL.
  const freeUsersWithReferralBonus = await prisma.user.findMany({
    where: {
      referralBonusCredits: { gt: 0 },
      AND: [
        {
          OR: [
            { subscriptionStatus: null },
            { subscriptionStatus: { not: "active" } },
          ],
        },
        {
          OR: [
            { lastCreditsRefill: { lt: thirtyDaysAgo } },
            { lastCreditsRefill: null },
          ],
        },
      ],
    },
    select: {
      id: true,
      referralBonusCredits: true,
    },
  });

  const freeUpdates = await Promise.all(
    freeUsersWithReferralBonus.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: {
          credits: { increment: user.referralBonusCredits },
          lastCreditsRefill: now,
        },
      }),
    ),
  );

  const refilled = subscriberUpdates.length + freeUpdates.length;
  return {
    success: true,
    refilled,
    subscribersRefilled: subscriberUpdates.length,
    referralBonusRefilled: freeUpdates.length,
    eligible: usersNeedingRefill.length + freeUsersWithReferralBonus.length,
    message: `Refilled credits for ${refilled} users (${subscriberUpdates.length} subscribers, ${freeUpdates.length} referral-bonus)`,
  };
}
