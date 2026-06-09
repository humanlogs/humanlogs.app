import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { sendEmail } from "./email/mailer";
import { getReferralInviteEmailTemplate } from "./email/email-templates-account";

/** Either the global client or a transaction client. */
type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

/**
 * Referral program.
 *
 * A user can invite people by email (up to MAX_REFERRALS). When an invited
 * email actually registers a new account, the referrer earns
 * REFERRAL_BONUS_CREDITS extra credits per month (1 credit = 1 minute of
 * transcription). The bonus is granted immediately for the current month and
 * is re-applied every month by the credits refill service
 * (see lib/billing/credits-refill-service.ts).
 */

export const REFERRAL_BONUS_CREDITS = 15;
export const MAX_REFERRALS = 10;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://humanlogs.app"
  );
}

export type ReferralSummary = {
  referrals: Array<{
    id: string;
    email: string;
    status: "INVITED" | "REGISTERED";
    createdAt: string;
    registeredAt: string | null;
  }>;
  total: number;
  registeredCount: number;
  bonusCredits: number;
  bonusPerReferral: number;
  maxReferrals: number;
  remainingSlots: number;
};

export async function getReferralSummary(
  referrerId: string,
): Promise<ReferralSummary> {
  const referrals = await prisma.referral.findMany({
    where: { referrerId },
    orderBy: { createdAt: "asc" },
  });

  const registeredCount = referrals.filter(
    (r) => r.status === "REGISTERED",
  ).length;

  return {
    referrals: referrals.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      registeredAt: r.registeredAt ? r.registeredAt.toISOString() : null,
    })),
    total: referrals.length,
    registeredCount,
    bonusCredits: Math.min(registeredCount, MAX_REFERRALS) * REFERRAL_BONUS_CREDITS,
    bonusPerReferral: REFERRAL_BONUS_CREDITS,
    maxReferrals: MAX_REFERRALS,
    remainingSlots: Math.max(0, MAX_REFERRALS - referrals.length),
  };
}

function normalizeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const email = (raw || "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

/**
 * Add referral invitations for a user and send invite emails.
 * Caps the total number of referrals at MAX_REFERRALS. Duplicate or already
 * invited emails are skipped. The referrer only earns credits once an invited
 * email registers (handled by processReferralOnSignup).
 */
export async function addReferralEmails(
  referrer: { id: string; email: string; name?: string | null },
  emails: string[],
): Promise<ReferralSummary> {
  const normalized = normalizeEmails(emails).filter(
    (email) => email !== referrer.email.toLowerCase(),
  );

  const existing = await prisma.referral.findMany({
    where: { referrerId: referrer.id },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((r) => r.email));

  // Skip addresses that already belong to a registered account — they can never
  // convert into a "new sign-up" bonus, and we shouldn't spam existing users.
  const existingUsers = await prisma.user.findMany({
    where: { email: { in: normalized } },
    select: { email: true },
  });
  const registeredEmails = new Set(
    existingUsers.map((u) => u.email.toLowerCase()),
  );

  const availableSlots = Math.max(0, MAX_REFERRALS - existing.length);
  const toAdd = normalized
    .filter((email) => !existingEmails.has(email) && !registeredEmails.has(email))
    .slice(0, availableSlots);

  // Strip control characters from the display name to avoid email header /
  // HTML injection when it is embedded in invitations sent to third parties.
  const inviterName = (referrer.name || referrer.email)
    .replace(/[\r\n]+/g, " ")
    .trim();

  for (const email of toAdd) {
    await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        email,
        status: "INVITED",
      },
    });

    // Send the invitation email (fail silently, mailer already no-ops when unconfigured)
    try {
      const template = getReferralInviteEmailTemplate({
        inviterName,
        signupUrl: `${appUrl()}/app/login`,
      });
      await sendEmail({
        to: email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    } catch (error) {
      console.error(`[Referral] Failed to send invite to ${email}:`, error);
    }
  }

  return getReferralSummary(referrer.id);
}

/**
 * Called when a brand new user registers. If their email matches any pending
 * invitation, mark it as registered and grant the referrer their monthly bonus
 * credits (capped at MAX_REFERRALS registered referrals).
 */
export async function processReferralOnSignup(newUser: {
  id: string;
  email: string;
}): Promise<void> {
  try {
    const email = newUser.email.toLowerCase();
    const pending = await prisma.referral.findMany({
      where: { email, status: "INVITED" },
    });

    for (const referral of pending) {
      // Don't credit self-referrals
      if (referral.referrerId === newUser.id) continue;

      await prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: "REGISTERED",
          registeredUserId: newUser.id,
          registeredAt: new Date(),
        },
      });

      const registeredCount = await prisma.referral.count({
        where: { referrerId: referral.referrerId, status: "REGISTERED" },
      });

      // Only grant the bonus for the first MAX_REFERRALS registered referrals
      if (registeredCount <= MAX_REFERRALS) {
        await prisma.user.update({
          where: { id: referral.referrerId },
          data: {
            credits: { increment: REFERRAL_BONUS_CREDITS },
            referralBonusCredits: { increment: REFERRAL_BONUS_CREDITS },
          },
        });
      }
    }
  } catch (error) {
    console.error("[Referral] Failed to process referral on signup:", error);
  }
}

/**
 * Recompute and persist a referrer's monthly bonus from their current number of
 * registered referrals (capped at MAX_REFERRALS). Keeps referralBonusCredits
 * authoritative regardless of how counts changed.
 */
export async function recomputeReferralBonus(
  referrerId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const registeredCount = await client.referral.count({
    where: { referrerId, status: "REGISTERED" },
  });
  await client.user.update({
    where: { id: referrerId },
    data: {
      referralBonusCredits:
        Math.min(registeredCount, MAX_REFERRALS) * REFERRAL_BONUS_CREDITS,
    },
  });
}

/**
 * When a user deletes their account, drop the referral rows that recorded them
 * as a registered referral and recompute each affected referrer's monthly bonus
 * so it no longer counts a user who no longer exists. Intended to run inside the
 * account-deletion transaction.
 */
export async function reconcileReferralsForDeletedUser(
  userId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const affected = await client.referral.findMany({
    where: { registeredUserId: userId },
    select: { referrerId: true },
  });
  if (affected.length === 0) return;

  const referrerIds = [...new Set(affected.map((r) => r.referrerId))];

  await client.referral.deleteMany({ where: { registeredUserId: userId } });

  for (const referrerId of referrerIds) {
    await recomputeReferralBonus(referrerId, client);
  }
}

/**
 * Remove a pending (INVITED) invitation owned by the user, freeing a slot.
 * Registered referrals cannot be removed (the bonus has already been earned).
 * Returns the refreshed summary, or null if the referral was not found / not
 * owned / already registered.
 */
export async function removeReferral(
  referrerId: string,
  referralId: string,
): Promise<ReferralSummary | null> {
  const referral = await prisma.referral.findUnique({
    where: { id: referralId },
  });

  if (
    !referral ||
    referral.referrerId !== referrerId ||
    referral.status !== "INVITED"
  ) {
    return null;
  }

  await prisma.referral.delete({ where: { id: referralId } });
  return getReferralSummary(referrerId);
}
