import { prisma } from "../prisma";
import { sendEmail } from "../email/mailer";
import { getCreditsRefillEmailTemplate } from "../email/email-templates-account";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://humanlogs.app";

/**
 * Notify a user that their monthly credits have been refilled.
 * Best-effort: a failure here must never roll back the credit top-up.
 */
async function sendCreditsRefillEmail(user: {
  email: string;
  language: string;
  credits: number;
}) {
  try {
    const template = await getCreditsRefillEmailTemplate({
      credits: user.credits,
      loginUrl: `${APP_URL}/app/login`,
      locale: user.language,
    });
    await sendEmail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (error) {
    console.error(
      `[Credits Refill] Failed to send refill email to ${user.email}:`,
      error,
    );
  }
}

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

  // Let users know their balance was topped up. Done after the DB writes and
  // sequentially so a slow/erroring mailer can't hold up the refill itself.
  for (const user of [...subscriberUpdates, ...freeUpdates]) {
    await sendCreditsRefillEmail(user);
  }

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
