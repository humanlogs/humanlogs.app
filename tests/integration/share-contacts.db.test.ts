import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "../db/pglite-server";

/**
 * Who the share dialog may suggest: the people you already share documents
 * with, and nobody else. Getting this too wide hands out email addresses — the
 * reason there is no search over all users in the first place — so the boundary
 * is asserted against a real PostgreSQL, the JSONB operators being raw SQL.
 *
 * `lib/transcriptions/access` is imported after `DATABASE_URL` points at the
 * throwaway database, because the app's Prisma singleton reads it at load.
 */

let db: TestDatabase;
let prisma: import("@prisma/client").PrismaClient;
let access: typeof import("@/lib/transcriptions/access");

let userSeq = 0;

async function makeUser() {
  const email = `contact-${++userSeq}@example.test`;
  return prisma.user.create({
    data: { auth0Id: `local|${email}`, email, name: email },
  });
}

async function makeDocument(
  userId: string,
  shared: unknown,
  updatedAt = new Date(),
) {
  return prisma.transcription.create({
    data: {
      userId,
      title: `doc-${Math.round(Math.random() * 1e9)}`,
      audioFileKey: "audio/x",
      audioFileName: "x.mp3",
      audioFileSize: 1,
      language: "fr",
      vocabulary: [],
      state: "COMPLETED",
      shared: shared as never,
      updatedAt,
    },
  });
}

const contactsOf = async (userId: string) =>
  (await access.findShareContacts(userId)).map((c) => c.userId);

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.url;

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
  });

  access = await import("@/lib/transcriptions/access");
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

beforeEach(async () => {
  await prisma.transcription.deleteMany();
  await prisma.user.deleteMany();
});

describe("findShareContacts", () => {
  it("returns the people I shared with and the people who shared with me", async () => {
    const me = await makeUser();
    const guest = await makeUser();
    const host = await makeUser();

    await makeDocument(me.id, [{ userId: guest.id, role: "read" }]);
    await makeDocument(host.id, [{ userId: me.id, role: "write" }]);

    expect((await contactsOf(me.id)).sort()).toEqual(
      [guest.id, host.id].sort(),
    );
  });

  it("includes the other collaborators of a document shared with me", async () => {
    const me = await makeUser();
    const host = await makeUser();
    const colleague = await makeUser();

    await makeDocument(host.id, [
      { userId: me.id, role: "read" },
      { userId: colleague.id, role: "write" },
    ]);

    expect((await contactsOf(me.id)).sort()).toEqual(
      [host.id, colleague.id].sort(),
    );
  });

  it("never suggests someone I share nothing with, nor myself", async () => {
    const me = await makeUser();
    const stranger = await makeUser();
    const strangersGuest = await makeUser();

    // A document between two other people, and one of mine shared with nobody.
    await makeDocument(stranger.id, [
      { userId: strangersGuest.id, role: "read" },
    ]);
    await makeDocument(me.id, null);
    await makeDocument(me.id, []);

    expect(await contactsOf(me.id)).toEqual([]);
    expect(await contactsOf(stranger.id)).toEqual([strangersGuest.id]);
  });

  it("orders by the most recent shared document and lists each person once", async () => {
    const me = await makeUser();
    const old = await makeUser();
    const recent = await makeUser();

    await makeDocument(
      me.id,
      [{ userId: old.id, role: "read" }],
      new Date("2025-01-01"),
    );
    await makeDocument(
      me.id,
      [{ userId: recent.id, role: "read" }],
      new Date("2026-01-01"),
    );
    await makeDocument(
      me.id,
      [{ userId: old.id, role: "write" }],
      new Date("2025-06-01"),
    );

    expect(await contactsOf(me.id)).toEqual([recent.id, old.id]);
  });

  it("counts the documents shared with each person, as a plain number", async () => {
    const me = await makeUser();
    const guest = await makeUser();
    const host = await makeUser();

    await makeDocument(me.id, [{ userId: guest.id, role: "read" }]);
    await makeDocument(me.id, [{ userId: guest.id, role: "write" }]);
    await makeDocument(host.id, [
      { userId: me.id, role: "read" },
      { userId: guest.id, role: "read" },
    ]);

    const counts = Object.fromEntries(
      (await access.findShareContacts(me.id)).map((c) => [
        c.userId,
        c.documents,
      ]),
    );
    // A bigint here would fail to serialise in the route's JSON response.
    expect(counts).toEqual({ [guest.id]: 3, [host.id]: 1 });
  });

  it("tolerates a malformed shared value instead of failing the query", async () => {
    const me = await makeUser();
    const guest = await makeUser();

    await makeDocument(me.id, { userId: guest.id }); // an object, not an array
    await makeDocument(me.id, ["not-an-entry", { role: "read" }]);
    await makeDocument(me.id, [{ userId: guest.id, role: "read" }]);

    expect(await contactsOf(me.id)).toEqual([guest.id]);
  });
});

describe("sharesDocumentWith", () => {
  it("agrees with findShareContacts, person by person", async () => {
    const me = await makeUser();
    const guest = await makeUser();
    const host = await makeUser();
    const colleague = await makeUser();
    const stranger = await makeUser();
    const strangersGuest = await makeUser();

    await makeDocument(me.id, [{ userId: guest.id, role: "read" }]);
    await makeDocument(host.id, [
      { userId: me.id, role: "read" },
      { userId: colleague.id, role: "write" },
    ]);
    await makeDocument(stranger.id, [
      { userId: strangersGuest.id, role: "read" },
    ]);

    const contacts = new Set(await contactsOf(me.id));
    for (const other of [guest, host, colleague, stranger, strangersGuest]) {
      expect(await access.sharesDocumentWith(me.id, other.id)).toBe(
        contacts.has(other.id),
      );
    }
    expect(contacts).toEqual(new Set([guest.id, host.id, colleague.id]));
  });

  it("is symmetric, and always true for yourself", async () => {
    const me = await makeUser();
    const guest = await makeUser();
    await makeDocument(me.id, [{ userId: guest.id, role: "read" }]);

    expect(await access.sharesDocumentWith(guest.id, me.id)).toBe(true);
    expect(await access.sharesDocumentWith(me.id, me.id)).toBe(true);
  });
});
