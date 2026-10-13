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

  await page.goto(`/app/project/${study.id}/coding`);

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
  await page.getByRole("button", { name: "Text / document" }).click();
  const pill = page
    .locator("form:visible")
    .getByRole("button", { name: "Cadre" });
  await expect(pill).toHaveAttribute("aria-pressed", "false");
  await pill.click();
  await expect(pill).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/study-coding-board-import.png",
    fullPage: true,
  });
});
