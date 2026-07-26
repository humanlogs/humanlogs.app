import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { startTestDatabase, type TestDatabase } from "../db/pglite-server";

/**
 * "Transcriptions shared with me" is raw SQL — Prisma cannot express JSONB
 * containment — so it is invisible to the type checker and to every other test.
 * It also happens to be the query that decides whether a collaborator sees a
 * document at all.
 *
 * This runs against a REAL PostgreSQL (PGlite, in-process), because the operator
 * under test (`@>`) simply does not exist anywhere else.
 */

let db: TestDatabase;
let prisma: PrismaClient;

/** Mirrors `findTranscriptionsSharedWith`, bound to the test client. */
const sharedWith = (userId: string) =>
  prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Transcription"
    WHERE "shared" IS NOT NULL
      AND "shared"::jsonb @> ${JSON.stringify([{ userId }])}::jsonb
    ORDER BY "updatedAt" DESC
  `;

async function makeUser(email: string) {
  return prisma.user.create({
    data: { auth0Id: `local|${email}`, email, name: email.split("@")[0] },
  });
}

async function makeTranscription(
  userId: string,
  title: string,
  shared: unknown[] | null,
) {
  return prisma.transcription.create({
    data: {
      userId,
      title,
      audioFileKey: `audio/${title}`,
      audioFileName: `${title}.mp3`,
      audioFileSize: 1024,
      language: "fr",
      vocabulary: [],
      state: "COMPLETED",
      shared: shared as never,
      transcription: { words: [], speakers: [] },
    },
  });
}

beforeAll(async () => {
  db = await startTestDatabase();
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
  });
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

describe("shared transcriptions (JSONB containment)", () => {
  it("finds a transcription shared with a user, whatever their role", async () => {
    const owner = await makeUser("owner-roles@example.com");
    const guest = await makeUser("guest-roles@example.com");

    const ids = [];
    for (const role of ["read", "read+listen", "write"]) {
      const t = await makeTranscription(owner.id, `shared-${role}`, [
        { userId: guest.id, role },
      ]);
      ids.push(t.id);
    }

    const found = await sharedWith(guest.id);
    expect(found.map((t) => t.id).sort()).toEqual(ids.sort());
  });

  it("does not leak transcriptions shared with somebody else", async () => {
    const owner = await makeUser("owner-leak@example.com");
    const guest = await makeUser("guest-leak@example.com");
    const other = await makeUser("other-leak@example.com");

    await makeTranscription(owner.id, "for-other", [
      { userId: other.id, role: "write" },
    ]);

    expect(await sharedWith(guest.id)).toEqual([]);
  });

  it("ignores transcriptions that are not shared at all", async () => {
    const owner = await makeUser("owner-private@example.com");
    const guest = await makeUser("guest-private@example.com");

    await makeTranscription(owner.id, "private-null", null);
    await makeTranscription(owner.id, "private-empty", []);

    expect(await sharedWith(guest.id)).toEqual([]);
  });

  it("matches one entry inside a multi-collaborator share list", async () => {
    const owner = await makeUser("owner-many@example.com");
    const a = await makeUser("collab-a@example.com");
    const b = await makeUser("collab-b@example.com");
    const c = await makeUser("collab-c@example.com");

    const t = await makeTranscription(owner.id, "team-doc", [
      { userId: a.id, role: "read" },
      { userId: b.id, role: "write" },
      { userId: c.id, role: "read+listen" },
    ]);

    for (const user of [a, b, c]) {
      const found = await sharedWith(user.id);
      expect(found.map((f) => f.id)).toEqual([t.id]);
    }
  });

  it("stops matching once a collaborator is removed (revocation)", async () => {
    const owner = await makeUser("owner-revoke@example.com");
    const guest = await makeUser("guest-revoke@example.com");

    const t = await makeTranscription(owner.id, "revoked", [
      { userId: guest.id, role: "write" },
    ]);
    expect(await sharedWith(guest.id)).toHaveLength(1);

    await prisma.transcription.update({
      where: { id: t.id },
      data: { shared: [] },
    });
    expect(await sharedWith(guest.id)).toEqual([]);
  });

  it("does not match on a user id that is merely a prefix of another", async () => {
    // Containment compares JSON values, not substrings — worth pinning, since a
    // LIKE-based implementation would silently pass every other test here.
    const owner = await makeUser("owner-prefix@example.com");
    const guest = await makeUser("guest-prefix@example.com");

    await makeTranscription(owner.id, "prefix-doc", [
      { userId: `${guest.id}-extra`, role: "write" },
    ]);

    expect(await sharedWith(guest.id)).toEqual([]);
  });
});
