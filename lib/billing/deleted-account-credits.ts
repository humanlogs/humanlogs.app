import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { authConfig, securityConfig } from "../config";

/** Either the global client or a transaction client. */
type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

/**
 * Anti-abuse for the free credit balance.
 *
 * Deleting an account wipes every row belonging to the user, so signing up
 * again with the same address used to hand out a brand new free balance. That
 * loop can be repeated forever. To close it we keep one row per deleted
 * account containing an HMAC-SHA256 of the normalized email plus the credit
 * state at deletion time. When the same address registers again we restore that
 * state instead of the `credits`/`creditsUsed` defaults.
 *
 * Only the hash is stored — the address itself is never retained, and rows are
 * purged after `security.deletedAccountRetentionDays` (see the cron job).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Providers where "a.b@" and "ab@" reach the same inbox. */
const DOT_INSENSITIVE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Collapse the trivial aliases of an address so that `u+1@gmail.com`,
 * `u.s.e.r@gmail.com` and `user@gmail.com` all hash to the same value.
 * Sub-addressing ("+tag") is honoured by every major provider, dot-insensitivity
 * only by Google — hence the domain list.
 */
export function normalizeEmailForHash(email: string): string {
  const trimmed = (email || "").trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (DOT_INSENSITIVE_DOMAINS.has(domain)) local = local.replace(/\./g, "");

  return `${local}@${domain}`;
}

/**
 * One-way, keyed hash of an email address. The pepper makes the stored hashes
 * useless to anyone who only gets the database (a plain SHA-256 of an email is
 * trivially brute-forced from a mailing list).
 */
export function hashEmail(email: string): string {
  const secret =
    securityConfig.emailHashSecret ||
    authConfig.sessionSecret ||
    "humanlogs-email-hash";

  return crypto
    .createHmac("sha256", secret)
    .update(normalizeEmailForHash(email))
    .digest("hex");
}

/**
 * Remember the credit state of an account being deleted. Meant to run inside
 * the account-deletion transaction, before the user row disappears. Deleting
 * twice keeps the latest balance and bumps `deletionCount`.
 */
export async function recordDeletedAccountCredits(
  user: { email: string; credits: number; creditsUsed: number },
  client: PrismaClientLike = prisma,
): Promise<void> {
  const emailHash = hashEmail(user.email);
  const credits = Math.max(0, user.credits ?? 0);
  const creditsUsed = Math.max(0, user.creditsUsed ?? 0);
  const now = new Date();

  await client.deletedAccount.upsert({
    where: { emailHash },
    update: {
      credits,
      creditsUsed,
      lastDeletedAt: now,
      deletionCount: { increment: 1 },
    },
    create: {
      emailHash,
      credits,
      creditsUsed,
      firstDeletedAt: now,
      lastDeletedAt: now,
    },
  });
}

/**
 * True when this address already had an account here and deleted it.
 *
 * Such a sign-up is a returning user, not an acquisition: it must not pay out
 * a referral bonus, otherwise the same delete-and-register loop farms referral
 * credits instead of free credits.
 */
export async function isReturningAddress(
  email: string,
  client: PrismaClientLike = prisma,
): Promise<boolean> {
  const record = await client.deletedAccount.findUnique({
    where: { emailHash: hashEmail(email) },
    select: { id: true },
  });

  return record !== null;
}

/**
 * Called right after a brand new user row is created. If that address deleted
 * an account before, put back the balance it left with instead of the default
 * free allotment. Returns true when a previous account was matched.
 *
 * Never throws: a failure here must not break sign-up.
 */
export async function restoreCreditsForReturningUser(user: {
  id: string;
  email: string;
}): Promise<boolean> {
  try {
    const record = await prisma.deletedAccount.findUnique({
      where: { emailHash: hashEmail(user.email) },
    });

    if (!record) return false;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: record.credits,
        creditsUsed: record.creditsUsed,
      },
    });

    console.log(
      `[Credits] Returning account (deletions: ${record.deletionCount}) — restored ${record.credits} credits instead of a fresh balance`,
    );
    return true;
  } catch (error) {
    console.error(
      "[Credits] Failed to restore credits for returning user:",
      error,
    );
    return false;
  }
}

/**
 * Drop deleted-account records older than the retention window so we don't keep
 * a permanent trace of people who left. A retention of 0 disables the purge.
 */
export async function purgeExpiredDeletedAccounts() {
  const retentionDays = securityConfig.deletedAccountRetentionDays;

  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return { success: true, deleted: 0, retentionDays, skipped: true };
  }

  const cutoff = new Date(Date.now() - retentionDays * DAY_MS);
  const { count } = await prisma.deletedAccount.deleteMany({
    where: { lastDeletedAt: { lt: cutoff } },
  });

  return { success: true, deleted: count, retentionDays, skipped: false };
}
