import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "../db/pglite-server";

/**
 * What happens to codebooks when a study disappears, and when a collaborator
 * loses a document.
 *
 * Both behaviours are pure database choreography — link rows, cascades, and a
 * JSONB rewrite of the wrapped keys — so they are exercised against a real
 * PostgreSQL rather than a fixture. `lib/codebooks/server` is imported *after*
 * `DATABASE_URL` is pointed at the throwaway database, because the app's Prisma
 * singleton reads it at module load.
 */

let db: TestDatabase;
let prisma: import("@prisma/client").PrismaClient;
let server: typeof import("@/lib/codebooks/server");

let userSeq = 0;

async function makeUser(publicKey?: string) {
  const email = `user-${++userSeq}@example.test`;
  return prisma.user.create({
    data: { auth0Id: `local|${email}`, email, name: email, publicKey },
  });
}

async function makeProject(userId: string, name: string) {
  return prisma.project.create({ data: { userId, name } });
}

async function makeDocument(
  userId: string,
  projectId: string | null,
  shared: unknown[] | null,
) {
  return prisma.transcription.create({
    data: {
      userId,
      projectId,
      title: `doc-${Math.round(Math.random() * 1e9)}`,
      audioFileKey: "audio/x",
      audioFileName: "x.mp3",
      audioFileSize: 1,
      language: "fr",
      vocabulary: [],
      state: "COMPLETED",
      shared: shared as never,
    },
  });
}

async function makeCodebook(
  userId: string,
  options: {
    studyIds?: string[];
    allStudies?: boolean;
    content?: unknown;
  } = {},
) {
  return prisma.codebook.create({
    data: {
      userId,
      allStudies: options.allStudies ?? false,
      content: (options.content ?? { name: "cb", codes: [] }) as never,
      studies: {
        create: (options.studyIds ?? []).map((projectId) => ({ projectId })),
      },
    },
  });
}

/** An encrypted entity shape with one wrapped key per user. */
const encryptedFor = (userIds: string[]) => ({
  version: "v1",
  payload: "ciphertext",
  privateKeys: userIds.map((userId) => ({
    userId,
    publicKey: `pk-${userId}`,
    aesKeyEncrypted: `wrapped-for-${userId}`,
    metadata: {},
  })),
});

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.DATABASE_URL = db.url;

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: db.url }),
  });

  server = await import("@/lib/codebooks/server");
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
});

beforeEach(async () => {
  await prisma.codebookStudy.deleteMany();
  await prisma.codebook.deleteMany();
  await prisma.transcription.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
});

describe("settleCodebooksForDeletedProject", () => {
  it("only detaches a codebook that covers other studies", async () => {
    const user = await makeUser();
    const doomed = await makeProject(user.id, "doomed");
    const kept = await makeProject(user.id, "kept");
    const codebook = await makeCodebook(user.id, {
      studyIds: [doomed.id, kept.id],
    });

    await server.settleCodebooksForDeletedProject(user.id, doomed.id, {
      targetProjectId: null,
    });

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
      include: { studies: true },
    });
    expect(after).not.toBeNull();
    expect(after!.studies.map((s) => s.projectId)).toEqual([kept.id]);
  });

  it("leaves an all-studies codebook alone beyond the link", async () => {
    const user = await makeUser();
    const doomed = await makeProject(user.id, "doomed");
    const codebook = await makeCodebook(user.id, {
      allStudies: true,
      studyIds: [doomed.id],
    });

    await server.settleCodebooksForDeletedProject(user.id, doomed.id, {
      targetProjectId: null,
    });

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
      include: { studies: true },
    });
    expect(after?.allStudies).toBe(true);
    expect(after?.studies).toEqual([]);
  });

  it("follows the documents when they move to another study", async () => {
    const user = await makeUser();
    const doomed = await makeProject(user.id, "doomed");
    const target = await makeProject(user.id, "target");
    const codebook = await makeCodebook(user.id, { studyIds: [doomed.id] });

    await server.settleCodebooksForDeletedProject(user.id, doomed.id, {
      targetProjectId: target.id,
    });

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
      include: { studies: true },
    });
    expect(after!.studies.map((s) => s.projectId)).toEqual([target.id]);
  });

  it("deletes every study-only codebook when nothing receives them", async () => {
    const user = await makeUser();
    const doomed = await makeProject(user.id, "doomed");
    const first = await makeCodebook(user.id, { studyIds: [doomed.id] });
    const second = await makeCodebook(user.id, { studyIds: [doomed.id] });

    await server.settleCodebooksForDeletedProject(user.id, doomed.id, {
      targetProjectId: null,
    });

    expect(await prisma.codebook.findUnique({ where: { id: first.id } })).toBeNull();
    expect(await prisma.codebook.findUnique({ where: { id: second.id } })).toBeNull();
  });

  it("never touches another user's codebooks", async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const project = await makeProject(owner.id, "shared-name");
    const theirs = await makeCodebook(stranger.id, { allStudies: true });

    await server.settleCodebooksForDeletedProject(owner.id, project.id, {
      targetProjectId: null,
    });

    expect(
      await prisma.codebook.findUnique({ where: { id: theirs.id } }),
    ).not.toBeNull();
  });
});

describe("revokeCodebookAccess", () => {
  it("drops the wrapped key when the collaborator keeps no document of the study", async () => {
    const owner = await makeUser("pk-owner");
    const collaborator = await makeUser("pk-collab");
    const project = await makeProject(owner.id, "study");
    // The document they were removed from no longer lists them.
    await makeDocument(owner.id, project.id, []);
    const codebook = await makeCodebook(owner.id, {
      studyIds: [project.id],
      content: encryptedFor([owner.id, collaborator.id]),
    });

    await server.revokeCodebookAccess(owner.id, project.id, collaborator.id);

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
    });
    const keys = (after!.content as { privateKeys: { userId: string }[] })
      .privateKeys;
    expect(keys.map((k) => k.userId)).toEqual([owner.id]);
  });

  it("keeps access while another document of the study is still shared", async () => {
    const owner = await makeUser("pk-owner");
    const collaborator = await makeUser("pk-collab");
    const project = await makeProject(owner.id, "study");
    await makeDocument(owner.id, project.id, [
      { userId: collaborator.id, role: "read" },
    ]);
    const codebook = await makeCodebook(owner.id, {
      studyIds: [project.id],
      content: encryptedFor([owner.id, collaborator.id]),
    });

    await server.revokeCodebookAccess(owner.id, project.id, collaborator.id);

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
    });
    const keys = (after!.content as { privateKeys: { userId: string }[] })
      .privateKeys;
    expect(keys.map((k) => k.userId)).toContain(collaborator.id);
  });

  it("keeps an all-studies codebook while any document of the owner is shared", async () => {
    const owner = await makeUser("pk-owner");
    const collaborator = await makeUser("pk-collab");
    const project = await makeProject(owner.id, "study");
    const other = await makeProject(owner.id, "elsewhere");
    await makeDocument(owner.id, project.id, []);
    await makeDocument(owner.id, other.id, [
      { userId: collaborator.id, role: "read" },
    ]);
    const codebook = await makeCodebook(owner.id, {
      allStudies: true,
      content: encryptedFor([owner.id, collaborator.id]),
    });

    await server.revokeCodebookAccess(owner.id, project.id, collaborator.id);

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
    });
    const keys = (after!.content as { privateKeys: { userId: string }[] })
      .privateKeys;
    expect(keys.map((k) => k.userId)).toContain(collaborator.id);
  });

  it("leaves plaintext codebooks untouched", async () => {
    const owner = await makeUser();
    const collaborator = await makeUser();
    const project = await makeProject(owner.id, "study");
    const codebook = await makeCodebook(owner.id, {
      studyIds: [project.id],
      content: { name: "clear", codes: [{ id: "c1", label: "One" }] },
    });

    await server.revokeCodebookAccess(owner.id, project.id, collaborator.id);

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
    });
    expect(after!.content).toEqual({
      name: "clear",
      codes: [{ id: "c1", label: "One" }],
    });
  });

  it("never strips the last remaining key holder", async () => {
    const owner = await makeUser("pk-owner");
    const project = await makeProject(owner.id, "study");
    const codebook = await makeCodebook(owner.id, {
      studyIds: [project.id],
      content: encryptedFor([owner.id]),
    });

    await server.revokeCodebookAccess(owner.id, project.id, owner.id);

    const after = await prisma.codebook.findUnique({
      where: { id: codebook.id },
    });
    const keys = (after!.content as { privateKeys: { userId: string }[] })
      .privateKeys;
    expect(keys.map((k) => k.userId)).toEqual([owner.id]);
  });
});
