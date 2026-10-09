import { expect, test } from "@playwright/test";
import {
  createUser,
  createTranscription,
  openEditor,
  shareTranscription,
  signIn,
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
});
