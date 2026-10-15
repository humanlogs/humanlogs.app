import { expect, test } from "@playwright/test";
import { baseURL } from "./config";
import {
  createTranscription,
  createUser,
  signIn,
  testPrisma,
} from "./fixtures";

/**
 * The study coding board: one click on a cell codes a document, the other view
 * reads the same code back per codebook, and a person's code lands on every
 * interview they appear in.
 */
test("codes documents and people from the study coding board", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ baseURL });
  const user = await createUser(ctx.request, "Coder");
  await testPrisma().user.update({
    where: { id: user.id },
    data: { betaFeatures: true },
  });
  await ctx.close();

  const page = await signIn(browser, user);
  const request = page.context().request;

  const study = await (
    await request.post(`${baseURL}/api/projects`, {
      data: { name: "Terrain" },
    })
  ).json();

  // In clear: the user has no encryption key, like a fresh account.
  const codebook = await (
    await request.post(`${baseURL}/api/codebooks`, {
      data: {
        content: {
          name: "Profil",
          codes: [
            { id: "c-cadre", label: "Cadre", color: "blue" },
            { id: "c-ouvrier", label: "Ouvrier", color: "rose" },
          ],
        },
        allStudies: false,
        studyIds: [study.id],
        target: "speaker",
      },
    })
  ).json();

  // A second grid, so the side-by-side view is offered.
  await request.post(`${baseURL}/api/codebooks`, {
    data: {
      content: {
        name: "Terrain",
        codes: [
          { id: "c-urbain", label: "Urbain", color: "teal" },
          { id: "c-rural", label: "Rural", color: "amber" },
        ],
      },
      allStudies: false,
      studyIds: [study.id],
      target: "speaker",
    },
  });

  const first = await createTranscription(request, {
    title: "Entretien A",
    filename: "a.csv",
    text: "Speaker,Text\nMarie,Bonjour\nPaul,Salut",
  });
  const second = await createTranscription(request, {
    title: "Entretien B",
    filename: "b.csv",
    text: "Speaker,Text\nMarie,Encore moi",
  });
  for (const id of [first, second]) {
    await request.patch(`${baseURL}/api/transcriptions/${id}`, {
      data: { projectId: study.id },
    });
  }

  // The dev server can answer 404 while it compiles a route for the first
  // time: navigate until the board is there.
  await expect(async () => {
    await page.goto(`/app/project/${study.id}/coding`);
    await page.getByRole("tab", { name: "Profil" }).click({ timeout: 10_000 });
    await expect(
      page.getByRole("checkbox", { name: "Cadre — Entretien A" }),
    ).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 90_000 });

  // A document: one cell, one code.
  const documentCell = page.getByRole("checkbox", {
    name: "Cadre — Entretien A",
  });
  await expect(documentCell).toHaveAttribute("aria-checked", "false");
  await documentCell.click();
  await expect(documentCell).toHaveAttribute("aria-checked", "true");

  // A person: Marie is in both interviews, one row codes both.
  const personCell = page.getByRole("checkbox", { name: "Ouvrier — Marie" });
  await personCell.click();
  await expect(personCell).toHaveAttribute("aria-checked", "true");

  await expect
    .poll(async () => {
      const rows = await testPrisma().transcription.findMany({
        where: { id: { in: [first, second] } },
        select: { id: true, codes: true, speakerCodes: true },
      });
      const a = rows.find((r) => r.id === first);
      const b = rows.find((r) => r.id === second);
      return {
        aCodes: a?.codes,
        aSpeakers: (a?.speakerCodes as Array<{ codeId: string }>)?.map(
          (r) => r.codeId,
        ),
        bSpeakers: (b?.speakerCodes as Array<{ codeId: string }>)?.map(
          (r) => r.codeId,
        ),
      };
    })
    .toEqual({
      aCodes: [{ codebookId: codebook.id, codeId: "c-cadre" }],
      aSpeakers: ["c-ouvrier"],
      bSpeakers: ["c-ouvrier"],
    });

  await page.screenshot({
    path: "test-results/study-coding-board-codebook.png",
    fullPage: true,
  });

  // The other view: one column per codebook, the codes as chips.
  await page
    .getByRole("tab", { name: /All codebooks|Tous les codebooks/ })
    .click();
  await expect(
    page.getByRole("row", { name: /Entretien A/ }).getByText("Cadre"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/study-coding-board-all.png",
    fullPage: true,
  });

  // Coding on the way in: the import form offers the study's codes.
  await page.goto(`/app/new?projectId=${study.id}`);

  // Audio: each file carries its own codes.
  const wav = silentWav();
  // One file at a time: headless Chromium reads the duration of the second of
  // a batch unreliably, and the form appends either way.
  const fileInput = page.locator('input[type="file"]').first();
  for (const name of ["one.wav", "two.wav"]) {
    await fileInput.setInputFiles({ name, mimeType: "audio/wav", buffer: wav });
    await expect(
      page.getByText(name.replace(".wav", ""), { exact: true }),
    ).toBeVisible();
  }
  // Each file has its own menu; only what is picked shows on it.
  const triggers = page.getByLabel(/Document codes|Codes du document/);
  await expect(triggers).toHaveCount(2);
  await triggers.first().click();
  await page.getByRole("button", { name: "Ouvrier" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(triggers.first()).toContainText("Ouvrier");
  await expect(triggers.nth(1)).not.toContainText("Ouvrier");
  await page.screenshot({
    path: "test-results/study-coding-board-audio.png",
    fullPage: true,
  });
});

/** One second of silence, 8 kHz mono — the smallest file the form accepts. */
function silentWav(): Buffer {
  const samples = 8000;
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24);
  buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}
