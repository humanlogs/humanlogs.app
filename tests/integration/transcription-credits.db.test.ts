import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "../db/pglite-server";

/**
 * Refunding a failed transcription moves real money-equivalent state, and the
 * two code paths that trigger it — status polling and the provider webhook —
 * routinely resolve the same job within milliseconds of each other. So the
 * guarantee under test is not "a refund happens" but "exactly one refund
 * happens", which only a real database with real concurrent transactions can
 * demonstrate.
 *
 * `lib/billing/transcription-credits` is imported *after* `DATABASE_URL` is
 * pointed at the throwaway database, because the app's Prisma singleton reads
 * it at module load.
 */

let db: TestDatabase;
let prisma: import("@prisma/client").PrismaClient;
let credits: typeof import("@/lib/billing/transcription-credits");

let userSeq = 0;

async function makeUser(balance: number, used: number) {
  const email = `user-${++userSeq}@example.test`;
  return prisma.user.create({
    data: {
      auth0Id: `local|${email}`,
      email,
      name: email,
      credits: balance,
      creditsUsed: used,
    },
  });
}

async function makeTranscription(
  userId: string,
  creditsCharged: number,
  state: "PENDING" | "ERROR" | "COMPLETED" = "PENDING",
) {
  return prisma.transcription.create({
    data: {
      userId,
      title: "interview",
      audioFileKey: "audio/x",
      audioFileName: "x.opus",
      audioFileSize: 1024,
      language: "en",
      vocabulary: [],
      state,
      creditsCharged,
    },
  });
}

const balanceOf = async (userId: string) =>
  prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true, creditsUsed: true },
  });

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.url;

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
  });

  credits = await import("@/lib/billing/transcription-credits");
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

beforeEach(async () => {
  await prisma.transcription.deleteMany();
  await prisma.user.deleteMany();
});

describe("refundTranscriptionCredits", () => {
  it("returns the charge and winds back the usage counter", async () => {
    // A 38-minute interview charged against a 100-credit balance.
    const user = await makeUser(62, 38);
    const t = await makeTranscription(user.id, 38);

    const result = await credits.refundTranscriptionCredits(t.id, "test");

    expect(result).toEqual({ refunded: true, credits: 38 });
    expect(await balanceOf(user.id)).toEqual({ credits: 100, creditsUsed: 0 });
  });

  it("clears the charge so the row cannot be refunded twice", async () => {
    const user = await makeUser(62, 38);
    const t = await makeTranscription(user.id, 38);

    await credits.refundTranscriptionCredits(t.id, "first");
    const second = await credits.refundTranscriptionCredits(t.id, "second");

    expect(second).toEqual({ refunded: false, credits: 0 });
    expect(await balanceOf(user.id)).toEqual({ credits: 100, creditsUsed: 0 });

    const row = await prisma.transcription.findUniqueOrThrow({
      where: { id: t.id },
      select: { creditsCharged: true },
    });
    expect(row.creditsCharged).toBe(0);
  });

  it("refunds once when polling and the webhook race", async () => {
    const user = await makeUser(0, 120);
    const t = await makeTranscription(user.id, 120);

    // Both resolvers fire at the same time on the same failed job.
    const results = await Promise.all([
      credits.refundTranscriptionCredits(t.id, "polling"),
      credits.refundTranscriptionCredits(t.id, "webhook"),
      credits.refundTranscriptionCredits(t.id, "cleanup"),
    ]);

    expect(results.filter((r) => r.refunded)).toHaveLength(1);
    expect(await balanceOf(user.id)).toEqual({ credits: 120, creditsUsed: 0 });
  });

  it("never drives the lifetime usage counter negative", async () => {
    // A row charged before this accounting existed can carry more than the
    // counter has ever recorded.
    const user = await makeUser(10, 5);
    const t = await makeTranscription(user.id, 40);

    await credits.refundTranscriptionCredits(t.id, "test");

    expect(await balanceOf(user.id)).toEqual({ credits: 50, creditsUsed: 0 });
  });

  it("does nothing for a row that carries no charge", async () => {
    // Every transcription created before the migration defaults to 0.
    const user = await makeUser(100, 0);
    const t = await makeTranscription(user.id, 0);

    const result = await credits.refundTranscriptionCredits(t.id, "test");

    expect(result).toEqual({ refunded: false, credits: 0 });
    expect(await balanceOf(user.id)).toEqual({ credits: 100, creditsUsed: 0 });
  });

  it("does nothing for a transcription that no longer exists", async () => {
    const result = await credits.refundTranscriptionCredits(
      "00000000-0000-0000-0000-000000000000",
      "test",
    );

    expect(result).toEqual({ refunded: false, credits: 0 });
  });

  it("keeps each owner's refund on their own balance", async () => {
    const alice = await makeUser(0, 60);
    const bob = await makeUser(500, 10);
    const t = await makeTranscription(alice.id, 60);

    await credits.refundTranscriptionCredits(t.id, "test");

    expect(await balanceOf(alice.id)).toEqual({ credits: 60, creditsUsed: 0 });
    expect(await balanceOf(bob.id)).toEqual({ credits: 500, creditsUsed: 10 });
  });
});

describe("refundBatchCredits", () => {
  it("returns a whole batch charge when no row survived to carry it", async () => {
    const user = await makeUser(20, 80);

    await credits.refundBatchCredits(user.id, 80, "test");

    expect(await balanceOf(user.id)).toEqual({ credits: 100, creditsUsed: 0 });
  });

  it("ignores a zero or negative amount", async () => {
    const user = await makeUser(100, 0);

    await credits.refundBatchCredits(user.id, 0, "test");

    expect(await balanceOf(user.id)).toEqual({ credits: 100, creditsUsed: 0 });
  });
});
