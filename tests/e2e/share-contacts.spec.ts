import { expect, test } from "@playwright/test";
import { baseURL } from "./config";
import {
  createUser,
  createTranscription,
  openEditor,
  shareTranscription,
  signIn,
  testPrisma,
} from "./fixtures";

/**
 * The share dialog suggests the people you already share with — and only them,
 * since nobody gets to browse other accounts' email addresses. The boundary
 * itself is asserted in `tests/integration/share-contacts.db.test.ts`; this
 * checks the wiring: suggestions appear, filter, pick, and drop out once added.
 */
test("the share dialog suggests people you already share with", async ({
  browser,
  request,
}) => {
  const owner = await createUser(request, "Owner");
  const colleague = await createUser(request, "Colleague");
  const stranger = await createUser(request, "Stranger");

  const page = await signIn(browser, owner);
  const first = await createTranscription(page.request, {
    title: "First interview",
    text: "Bonjour et merci.",
  });
  await shareTranscription(page.request, first, colleague.email, "read");
  const second = await createTranscription(page.request, {
    title: "Second interview",
    text: "Une autre fois.",
  });

  await openEditor(page, second);
  await page.getByRole("button", { name: "Share transcription" }).click();

  const field = page.getByRole("combobox");
  await field.focus();
  const suggestions = page.getByRole("listbox");
  await expect(
    suggestions.getByRole("option", { name: new RegExp(colleague.email) }),
  ).toBeVisible();
  await expect(suggestions).not.toContainText(stranger.email);

  // Filtering on a name that matches nobody closes the list.
  await field.fill("nobody-matches-this");
  await expect(suggestions).toBeHidden();

  await field.fill("colleague");
  await field.press("Enter"); // picks the highlighted suggestion
  await expect(field).toHaveValue(colleague.email);

  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText(`Shared with ${colleague.email}`)).toBeVisible();

  // Already on this document: no longer offered.
  await field.focus();
  await expect(suggestions).toBeHidden();

  // A profile — email included — is readable only for someone you share with.
  const profile = (id: string) => page.request.get(`${baseURL}/api/user/${id}`);
  expect((await profile(colleague.id)).status()).toBe(200);
  expect((await profile(owner.id)).status()).toBe(200);
  expect((await profile(stranger.id)).status()).toBe(404);
});

test("the account page lists collaborators and the study recaps who has what", async ({
  browser,
  request,
}) => {
  const owner = await createUser(request, "Lead");
  const colleague = await createUser(request, "Analyst");

  const page = await signIn(browser, owner);
  const study = await testPrisma().project.create({
    data: { userId: owner.id, name: "Fieldwork" },
  });
  const ids: string[] = [];
  for (const title of ["Interview A", "Interview B"]) {
    const id = await createTranscription(page.request, {
      title,
      text: "Bonjour.",
    });
    await testPrisma().transcription.update({
      where: { id },
      data: { projectId: study.id },
    });
    ids.push(id);
  }

  // Nothing shared yet: no recap at the bottom of the study.
  await page.goto(`/app/project/${study.id}`);
  await expect(
    page.getByRole("link", { name: /Interview A/ }).first(),
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("study-sharing-summary")).toHaveCount(0);

  await shareTranscription(page.request, ids[0], colleague.email, "read");

  await page.reload();
  const recap = page.getByTestId("study-sharing-summary");
  await expect(recap).toContainText(colleague.email, { timeout: 30_000 });
  await expect(recap).toContainText("1 of 2 documents");
  await expect(recap).toContainText("Interview A");

  await page.goto("/app/account");
  await expect(page.getByText("Collaborators", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(colleague.email)).toBeVisible();
  await expect(page.getByText("1 shared document")).toBeVisible();
});
