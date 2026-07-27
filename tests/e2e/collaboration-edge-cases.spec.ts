import { expect, test, type Page } from "@playwright/test";
import { io as ioClient } from "socket.io-client";
import { baseURL } from "./config";
import {
  createTranscription,
  createUser,
  openEditor,
  shareTranscription,
  signIn,
  testPrisma,
} from "./fixtures";

/**
 * The awkward half of collaboration, in real browsers: someone closing the tab
 * mid-sentence, a tunnel between two keystrokes, two people typing into the same
 * word, undo after a colleague's edit.
 *
 * These are the situations users actually hit and nobody rehearses.
 */

const TRANSCRIPT = "Bonjour tout le monde. Ceci est un entretien de test.";

async function setup(
  request: import("@playwright/test").APIRequestContext,
  role: "read" | "read+listen" | "write" = "write",
) {
  const owner = await createUser(request, "Owner");
  const collaborator = await createUser(request, "Collab");
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

/** Transcript text as the user reads it, without the peers' caret labels. */
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

const typeAtEnd = async (page: Page, text: string) => {
  await page.locator(".ProseMirror").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
};

const storedWords = async (transcriptionId: string) => {
  const row = await testPrisma().transcription.findUnique({
    where: { id: transcriptionId },
    select: { transcription: true },
  });
  const payload = row?.transcription as { words?: { text: string }[] };
  return (payload?.words ?? []).map((w) => w.text).join(" ");
};

test.describe("collaboration edge cases", () => {
  test("the save leader closing their tab does not lose the other's work", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    await openEditor(ownerPage, transcriptionId);
    const collaboratorPage = await signIn(browser, collaborator);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    await typeAtEnd(collaboratorPage, " AVANT_FERMETURE");
    await expect(ownerPage.locator(".ProseMirror").first()).toContainText(
      "AVANT_FERMETURE",
    );

    // The owner — the save leader — closes the tab. The collaborator must be
    // promoted and take over persistence, or every later edit is lost.
    await ownerPage.context().close();

    await typeAtEnd(collaboratorPage, " APRES_FERMETURE");
    await expect(collaboratorEditor).toContainText("APRES_FERMETURE");

    await expect
      .poll(() => storedWords(transcriptionId), {
        timeout: 60_000,
        intervals: [1000],
      })
      .toContain("APRES_FERMETURE");
    expect(await storedWords(transcriptionId)).toContain("AVANT_FERMETURE");
  });

  test("undo cannot swallow the transcript it was loaded with", async ({
    browser,
    request,
  }) => {
    // Filling the empty document on load is a local edit like any other, so the
    // collaborative undo stack used to hold it as one enormous step: a few Ctrl+Z
    // too many and the whole interview vanished — then got saved that way.
    const { owner, transcriptionId } = await setup(request);
    const ownerPage = await signIn(browser, owner);
    const editor = await openEditor(ownerPage, transcriptionId);
    await expect(editor).toContainText("Bonjour tout le monde");

    await typeAtEnd(ownerPage, " UN DEUX TROIS");
    await expect(editor).toContainText("UN DEUX TROIS");

    // Undo far past the user's own edits, into where the load used to sit.
    for (let i = 0; i < 12; i++) {
      await ownerPage.keyboard.press("ControlOrMeta+z");
      await ownerPage.waitForTimeout(60);
    }

    await expect(editor).toContainText("Bonjour tout le monde");
    expect(await editorText(ownerPage)).toContain("Ceci est un entretien");

    // …and the database is not emptied behind it either.
    await ownerPage.waitForTimeout(8000);
    expect(await storedWords(transcriptionId)).toContain("entretien");
  });

  test("a reload keeps edits that were never saved", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    await openEditor(ownerPage, transcriptionId);
    const collaboratorPage = await signIn(browser, collaborator);
    await openEditor(collaboratorPage, transcriptionId);

    await typeAtEnd(ownerPage, " TEXTE_VOLATILE");
    await expect(collaboratorPage.locator(".ProseMirror").first()).toContainText(
      "TEXTE_VOLATILE",
    );

    // Reloading rebuilds the document from a peer, not from the older database
    // copy — otherwise the reload would silently roll everyone back.
    await collaboratorPage.reload();
    const reloaded = await openEditor(collaboratorPage, transcriptionId);
    await expect(reloaded).toContainText("TEXTE_VOLATILE");
  });

  test("edits made offline reach the others after reconnecting", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    const collaboratorPage = await signIn(browser, collaborator);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    await collaboratorPage.context().setOffline(true);
    await typeAtEnd(collaboratorPage, " HORS_LIGNE");
    await typeAtEnd(ownerPage, " EN_LIGNE");
    await expect(collaboratorEditor).toContainText("HORS_LIGNE");
    await expect(collaboratorEditor).not.toContainText("EN_LIGNE");

    await collaboratorPage.context().setOffline(false);

    // Both sides must end up with both edits.
    await expect(ownerEditor).toContainText("HORS_LIGNE", { timeout: 30_000 });
    await expect(collaboratorEditor).toContainText("EN_LIGNE", {
      timeout: 30_000,
    });
    await expect
      .poll(() => editorText(collaboratorPage), { timeout: 30_000 })
      .toBe(await editorText(ownerPage));
  });

  test("undo does not revert the other participant's edit", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    const ownerEditor = await openEditor(ownerPage, transcriptionId);
    const collaboratorPage = await signIn(browser, collaborator);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    await typeAtEnd(ownerPage, " ECRIT_PAR_PROPRIO");
    await expect(collaboratorEditor).toContainText("ECRIT_PAR_PROPRIO");

    await typeAtEnd(collaboratorPage, " ECRIT_PAR_INVITE");
    await expect(ownerEditor).toContainText("ECRIT_PAR_INVITE");

    // Ctrl+Z on the collaborator's side must undo THEIR insertion only. Undoing
    // someone else's typing is the classic collaborative-undo bug.
    await collaboratorPage.keyboard.press("ControlOrMeta+z");

    await expect(collaboratorEditor).not.toContainText("ECRIT_PAR_INVITE");
    await expect(collaboratorEditor).toContainText("ECRIT_PAR_PROPRIO");
    await expect(ownerEditor).toContainText("ECRIT_PAR_PROPRIO");
    await expect(ownerEditor).not.toContainText("ECRIT_PAR_INVITE");
  });

  test("three participants converge on the same text", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);
    const third = await createUser(request, "Third");
    await request.post("/api/local-auth/login", {
      data: { email: owner.email, password: owner.password },
    });
    await shareTranscription(request, transcriptionId, third.email, "write");

    const pages = [];
    for (const user of [owner, collaborator, third]) {
      const page = await signIn(browser, user);
      await openEditor(page, transcriptionId);
      pages.push(page);
    }

    await Promise.all([
      typeAtEnd(pages[0], " UN"),
      typeAtEnd(pages[1], " DEUX"),
      typeAtEnd(pages[2], " TROIS"),
    ]);

    for (const page of pages) {
      for (const word of ["UN", "DEUX", "TROIS"]) {
        await expect(page.locator(".ProseMirror").first()).toContainText(word, {
          timeout: 30_000,
        });
      }
    }
    const reference = await editorText(pages[0]);
    for (const page of pages.slice(1)) {
      await expect.poll(() => editorText(page), { timeout: 30_000 }).toBe(
        reference,
      );
    }
  });

  test("renaming a speaker shows up for the other participant", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request);

    const ownerPage = await signIn(browser, owner);
    await openEditor(ownerPage, transcriptionId);
    const collaboratorPage = await signIn(browser, collaborator);
    await openEditor(collaboratorPage, transcriptionId);

    // Speaker names live in a Y.Map, not in the text, so they have their own
    // sync path — one that a text-only test would never touch.
    const renamed = await ownerPage.evaluate(() => {
      const api = (window as unknown as { editorAPI?: any }).editorAPI;
      if (!api) return null;
      const speakers = api.getSpeakers();
      if (!speakers.length) return null;
      api.setSpeakers([
        { ...speakers[0], name: "INTERVIEWEUR_RENOMME" },
        ...speakers.slice(1),
      ]);
      return speakers[0].id as string;
    });
    expect(renamed, "the editor API should expose at least one speaker").toBeTruthy();

    await expect
      .poll(
        () =>
          collaboratorPage.evaluate(() => {
            const api = (window as unknown as { editorAPI?: any }).editorAPI;
            return (api?.getSpeakers() ?? []).map((s: any) => s.name);
          }),
        { timeout: 30_000 },
      )
      .toContain("INTERVIEWEUR_RENOMME");
  });

  test("a read-only participant follows the writer live", async ({
    browser,
    request,
  }) => {
    const { owner, collaborator, transcriptionId } = await setup(request, "read");

    const ownerPage = await signIn(browser, owner);
    await openEditor(ownerPage, transcriptionId);
    const collaboratorPage = await signIn(browser, collaborator);
    const collaboratorEditor = await openEditor(
      collaboratorPage,
      transcriptionId,
    );

    // A reviewer who cannot type still sees the writing happen, and sees where
    // the writer is working.
    await typeAtEnd(ownerPage, " ECRIT_EN_DIRECT");
    await expect(collaboratorEditor).toContainText("ECRIT_EN_DIRECT");
    await expect(
      collaboratorPage.locator(".collaboration-cursor__label"),
    ).toContainText(owner.name, { timeout: 30_000 });

    // NOTE: the reverse does not hold today. A read-only participant publishes
    // their presence (the server relays it — see the integration suite), but the
    // editor draws no caret for them because a non-editable ProseMirror has no
    // selection to broadcast. If reviewers should be visible in the text, that is
    // a product change, not a regression: assert it here when it lands.
  });

  test("a stranger cannot reach the live document over the socket", async ({
    browser,
    request,
  }) => {
    const { owner, transcriptionId } = await setup(request);
    const stranger = await createUser(request, "Stranger");

    const ownerPage = await signIn(browser, owner);
    await openEditor(ownerPage, transcriptionId);
    await typeAtEnd(ownerPage, " SECRET_EN_DIRECT");

    // The REST API answers 403 — but the collaboration socket is a second door,
    // and a transcription id is not a secret. Here the attacker skips the UI and
    // speaks the protocol directly, with their own perfectly valid credentials.
    const strangerPage = await signIn(browser, stranger);
    const profile = await strangerPage.request
      .get("/api/user")
      .then((r) => r.json());
    expect(profile.socketToken, "the API should hand out a socket token").toBeTruthy();

    const socket = ioClient(baseURL, {
      path: "/api/socket",
      transports: ["websocket"],
      auth: { token: profile.socketToken },
      reconnection: false,
    });
    const leaked: unknown[] = [];
    const denials: unknown[] = [];
    socket.on("yjs:state", (d) => leaked.push(d));
    socket.on("yjs:msg", (d) => leaked.push(d));
    socket.on("transcription:denied", (d) => denials.push(d));

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => resolve());
      socket.on("connect_error", reject);
    });
    socket.emit("yjs:join", { transcriptionId });
    socket.emit("yjs:state-request", { transcriptionId });
    socket.emit("transcription:join", transcriptionId);

    // Keep listening while the owner keeps typing.
    await typeAtEnd(ownerPage, " ENCORE_PLUS_SECRET");
    await new Promise((r) => setTimeout(r, 2000));
    socket.disconnect();

    expect(leaked).toEqual([]);
    expect(denials.length).toBeGreaterThan(0);

    const response = await strangerPage.request.get(
      `/api/transcriptions/${transcriptionId}`,
    );
    expect(response.status()).toBe(403);
  });
});
