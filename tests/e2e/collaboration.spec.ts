import { expect, test, type Page } from "@playwright/test";
import {
  createTranscription,
  createUser,
  openEditor,
  shareTranscription,
  signIn,
  testPrisma,
  type TestUser,
} from "./fixtures";

/**
 * Two real browsers, one transcript.
 *
 * This is the layer the unit and protocol tests cannot reach: TipTap bound to
 * Y.js, remote carets, the read-only guard, and the save leader persisting to
 * Postgres — all through the app as a user meets it.
 */

const TRANSCRIPT = "Bonjour tout le monde. Ceci est un entretien de test.";

type Fixture = {
  owner: TestUser;
  collaborator: TestUser;
  transcriptionId: string;
};

/** Owner + collaborator sharing one transcript, created through the public API. */
async function setup(
  request: import("@playwright/test").APIRequestContext,
  role: "read" | "read+listen" | "write" = "write",
): Promise<Fixture> {
  const owner = await createUser(request, "Owner");
  const collaborator = await createUser(request, "Collab");

  // `request` holds the last registration's session cookie, so re-authenticate
  // explicitly as the owner before creating and sharing their transcript.
  await request.post("/api/local-auth/login", {
    data: { email: owner.email, password: owner.password },
  });

  const transcriptionId = await createTranscription(request, {
    title: "Entretien collaboratif",
    text: TRANSCRIPT,
  });
  await shareTranscription(request, transcriptionId, collaborator.email, role);

  return { owner, collaborator, transcriptionId };
}

/**
 * The transcript text as the user reads it. Remote carets are rendered *inside*
 * the document (a labelled span carrying the peer's name), and each participant
 * sees the other's — so they must be stripped before comparing two clients.
 */
const editorText = async (page: Page) =>
  (
    await page.locator(".ProseMirror").first().evaluate((node) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll(".collaboration-cursor__caret")
        .forEach((caret) => caret.remove());
      return clone.textContent ?? "";
    })
  ).replace(/\s+/g, " ");

test.describe("real-time collaboration", () => {
  test("a shared transcript is visible to both participants", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const collaboratorPage = await signIn(browser, collaborator);

    await openEditor(ownerPage, transcriptionId);
    await openEditor(collaboratorPage, transcriptionId);

    await expect(ownerPage.locator(".ProseMirror").first()).toContainText(
      "Bonjour tout le monde",
    );
    await expect(
      collaboratorPage.locator(".ProseMirror").first(),
    ).toContainText("Bonjour tout le monde");
  });

  test("what one participant types appears for the other", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const collaboratorPage = await signIn(browser, collaborator);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    await ownerEditor.click();
    await ownerPage.keyboard.press("End");
    await ownerPage.keyboard.type(" AJOUT_PROPRIETAIRE");
    await expect(collaboratorEditor).toContainText("AJOUT_PROPRIETAIRE");

    // …and back the other way, which also proves the peer is not read-only.
    await collaboratorEditor.click();
    await collaboratorPage.keyboard.press("End");
    await collaboratorPage.keyboard.type(" AJOUT_INVITE");
    await expect(ownerEditor).toContainText("AJOUT_INVITE");
  });

  test("concurrent typing converges to the same text", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const collaboratorPage = await signIn(browser, collaborator);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    await ownerEditor.click();
    await ownerPage.keyboard.press("End");
    await collaboratorEditor.click();
    await collaboratorPage.keyboard.press("End");

    // Interleave keystrokes so both clients hold local edits the other hasn't seen.
    await Promise.all([
      ownerPage.keyboard.type(" PROPRIO", { delay: 30 }),
      collaboratorPage.keyboard.type(" INVITE", { delay: 30 }),
    ]);

    await expect(ownerEditor).toContainText("PROPRIO");
    await expect(ownerEditor).toContainText("INVITE");
    await expect(collaboratorEditor).toContainText("PROPRIO");
    await expect(collaboratorEditor).toContainText("INVITE");

    // Convergence: both documents end up character-for-character identical.
    await expect
      .poll(async () => await editorText(collaboratorPage), { timeout: 20_000 })
      .toBe(await editorText(ownerPage));
  });

  test("a participant joining later receives edits that were never saved", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    await ownerEditor.click();
    await ownerPage.keyboard.press("End");
    await ownerPage.keyboard.type(" TEXTE_AVANT_ARRIVEE");

    // The late joiner must pull the live document from its peer, not the older
    // copy sitting in the database.
    const collaboratorPage = await signIn(browser, collaborator);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );
    await expect(collaboratorEditor).toContainText("TEXTE_AVANT_ARRIVEE");
  });

  test("each participant sees the other's caret", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const collaboratorPage = await signIn(browser, collaborator);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    await ownerEditor.click();
    await ownerPage.keyboard.press("End");
    await ownerPage.keyboard.type("x");
    await collaboratorEditor.click();
    await collaboratorPage.keyboard.press("Home");

    // Carets are rendered from awareness, labelled with the peer's name.
    await expect(
      collaboratorPage.locator(".collaboration-cursor__label"),
    ).toContainText(owner.name);
    await expect(
      ownerPage.locator(".collaboration-cursor__label"),
    ).toContainText(collaborator.name);
  });

  test("edits made together are persisted once", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const collaboratorPage = await signIn(browser, collaborator);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    await collaboratorEditor.click();
    await collaboratorPage.keyboard.press("End");
    await collaboratorPage.keyboard.type(" TEXTE_PERSISTE");
    await expect(ownerEditor).toContainText("TEXTE_PERSISTE");

    // Only the save leader writes, so the collaborator's edit reaches Postgres
    // through the owner's client. Autosave is debounced (3s).
    await expect
      .poll(
        async () => {
          const row = await testPrisma().transcription.findUnique({
            where: { id: transcriptionId },
            select: { transcription: true },
          });
          const payload = row?.transcription as { words?: { text: string }[] };
          return (payload?.words ?? []).map((w) => w.text).join(" ");
        },
        { timeout: 45_000, intervals: [1000] },
      )
      .toContain("TEXTE_PERSISTE");
  });

  test("a read-only participant cannot edit the transcript", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request, "read");

    const ownerPage = await signIn(browser, owner);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    const collaboratorPage = await signIn(browser, collaborator);
    const editor = await openEditor(collaboratorPage, transcriptionId);

    await expect(editor).toHaveAttribute("contenteditable", "false");

    const before = await editorText(collaboratorPage);
    await editor.click();
    // Typing and deleting both reach the document through document-level
    // shortcuts, which do not go through ProseMirror's own editable guard.
    await collaboratorPage.keyboard.type("TENTATIVE_INTERDITE");
    await collaboratorPage.keyboard.press("Backspace");
    await collaboratorPage.waitForTimeout(1000);

    expect(await editorText(collaboratorPage)).toBe(before);
    // …and nothing leaked to the other participant either.
    await expect(ownerEditor).not.toContainText("TENTATIVE_INTERDITE");
    expect(await editorText(ownerPage)).toBe(before);
  });

  test("a stranger cannot open the transcript at all", async ({
    browser,
    request,
  }) => {
    const { transcriptionId } = await setup(request);
    const stranger = await createUser(request, "Stranger");

    const strangerPage = await signIn(browser, stranger);
    const response = await strangerPage.request.get(
      `/api/transcriptions/${transcriptionId}`,
    );
    expect(response.status()).toBe(403);
  });
});
