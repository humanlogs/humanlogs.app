import { expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { baseURL, testDatabaseUrl } from "./config";

/**
 * Fixtures for the end-to-end suite.
 *
 * Accounts and transcripts are created through the app's own public API
 * (register / import / share) so the setup path is itself covered; only the bits
 * a user cannot do from the UI — skipping onboarding, granting credits — go
 * straight to the database.
 */

let prismaSingleton: PrismaClient | null = null;

/** Prisma client bound to the ephemeral test database started by `serve.ts`. */
export function testPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl() }),
    });
  }
  return prismaSingleton;
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  name: string;
};

let uniqueCounter = 0;
const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${uniqueCounter++}`;

/**
 * Register a user through the real signup endpoint, then mark onboarding as done
 * so tests land straight in the app instead of the welcome flow.
 */
export async function createUser(
  request: APIRequestContext,
  name: string,
): Promise<TestUser> {
  const email = `${unique(name.toLowerCase())}@example.test`;
  const password = "correct-horse-battery-staple";

  const response = await request.post(`${baseURL}/api/local-auth/register`, {
    data: { email, password, name },
  });
  expect(
    response.ok(),
    `registration failed: ${response.status()} ${await response.text()}`,
  ).toBe(true);

  const user = await testPrisma().user.update({
    where: { email },
    data: { isWelcomeDone: true, onboardingStep: "done" },
  });

  return { id: user.id, email, password, name };
}

/**
 * Import a plain-text transcript through the app's import endpoint — the
 * lightest real path to a COMPLETED transcription (no audio, no STT provider).
 */
export async function createTranscription(
  request: APIRequestContext,
  { title, text }: { title: string; text: string },
): Promise<string> {
  const response = await request.post(`${baseURL}/api/transcriptions/import`, {
    multipart: {
      title,
      language: "fr",
      file: {
        name: `${title}.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(text, "utf8"),
      },
    },
  });
  expect(
    response.ok(),
    `import failed: ${response.status()} ${await response.text()}`,
  ).toBe(true);

  const body = await response.json();
  expect(
    body.transcriptionId,
    `no transcription id in ${JSON.stringify(body)}`,
  ).toBeTruthy();
  return body.transcriptionId as string;
}

/** Share a transcription with another user, as the owner would from the UI. */
export async function shareTranscription(
  request: APIRequestContext,
  transcriptionId: string,
  email: string,
  role: "read" | "read+listen" | "write" = "write",
): Promise<void> {
  const response = await request.post(
    `${baseURL}/api/transcriptions/${transcriptionId}/share`,
    { data: { email, role } },
  );
  expect(
    response.ok(),
    `share failed: ${response.status()} ${await response.text()}`,
  ).toBe(true);
}

/**
 * A browser context logged in as `user`, isolated from every other context —
 * which is what lets one test drive two collaborators at once.
 */
export async function signIn(browser: Browser, user: TestUser): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  const response = await context.request.post(`${baseURL}/api/local-auth/login`, {
    data: { email: user.email, password: user.password },
  });
  expect(
    response.ok(),
    `login failed: ${response.status()} ${await response.text()}`,
  ).toBe(true);
  return context.newPage();
}

/** The transcript editor surface, once it has loaded its content. */
export async function openEditor(page: Page, transcriptionId: string) {
  await page.goto(`/app/transcription/${transcriptionId}`);
  const editor = page.locator(".ProseMirror").first();
  await expect(editor).toBeVisible({ timeout: 60_000 });
  // The document is seeded (or pulled from a peer) asynchronously.
  await expect(editor).not.toBeEmpty({ timeout: 30_000 });
  return editor;
}
