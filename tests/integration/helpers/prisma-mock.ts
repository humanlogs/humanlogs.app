/**
 * In-memory stand-in for the two Prisma reads the socket server performs:
 * the user behind a socket token, and the transcription a client wants to join.
 *
 * The collaboration tests are about the protocol, not about SQL — but they must
 * still exercise the REAL authorization code, so this fixture stores owners and
 * share lists exactly as the database does (a JSON array on the transcription).
 */

export type FixtureUser = { id: string; email: string; name: string };
export type FixtureShare = {
  userId: string;
  role: "read" | "read+listen" | "write";
};
export type FixtureTranscription = {
  id: string;
  userId: string;
  shared: FixtureShare[];
};

const users = new Map<string, FixtureUser>();
const transcriptions = new Map<string, FixtureTranscription>();

/** Every user id the tests use resolves to a valid account by default. */
export function registerUser(id: string): FixtureUser {
  const existing = users.get(id);
  if (existing) return existing;
  const user = { id, email: `${id}@example.test`, name: id };
  users.set(id, user);
  return user;
}

export function registerTranscription(
  transcription: FixtureTranscription,
): FixtureTranscription {
  transcriptions.set(transcription.id, transcription);
  return transcription;
}

export function updateShares(id: string, shared: FixtureShare[]) {
  const transcription = transcriptions.get(id);
  if (transcription) transcription.shared = shared;
}

export function resetFixtures() {
  users.clear();
  transcriptions.clear();
}

export const fakePrisma = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      users.get(where.id) ?? null,
  },
  transcription: {
    findUnique: async ({ where }: { where: { id: string } }) =>
      transcriptions.get(where.id) ?? null,
  },
};
