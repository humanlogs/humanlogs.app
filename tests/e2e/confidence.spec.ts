import { expect, test } from "@playwright/test";
import { baseURL } from "./config";
import { createUser, openEditor, signIn, testPrisma } from "./fixtures";

/**
 * Doubtful words in a real browser: the STT engine's low-confidence words come in
 * underlined, the toolbar hides and shows them, clicking one offers to validate it,
 * and correcting one clears it — and what is cleared stays cleared after a reload.
 *
 * The unit suite covers the mark, the clearing rule and the projection; this checks
 * the wiring through seed, editor, bubble, toolbar and autosave.
 */

// Word-level JSON, as an STT export: two words below the threshold.
const WORDS = [
  ["Bonjour", 0.98],
  ["et", 0.97],
  ["merci", 0.2],
  ["pour", 0.95],
  ["cet", 0.9],
  ["entretain", 0.1],
  ["aujourd'hui", 0.96],
] as const;

const TRANSCRIPT = JSON.stringify({
  words: WORDS.map(([text, confidence], i) => ({
    text,
    type: "word",
    start: i,
    end: i + 0.8,
    speaker_id: "speaker_0",
    confidence,
  })),
});

test("doubtful words are underlined until validated or corrected", async ({
  browser,
  request,
}) => {
  const user = await createUser(request, "Doubt");
  const page = await signIn(browser, user);

  const response = await page.request.post(
    `${baseURL}/api/transcriptions/import`,
    {
      multipart: {
        title: "Confidence",
        language: "fr",
        file: {
          name: "confidence.json",
          mimeType: "application/json",
          buffer: Buffer.from(TRANSCRIPT, "utf8"),
        },
      },
    },
  );
  expect(response.ok(), await response.text()).toBe(true);
  const { transcriptionId } = await response.json();

  const editor = await openEditor(page, transcriptionId);
  const doubtful = editor.locator(".hl-confidence");
  await expect(doubtful).toHaveText(["merci", "entretain"]);

  // Hidden and shown again from the toolbar — a view setting, the marks stay.
  const toggle = page.getByRole("button", { name: /doubtful words/i });
  await toggle.click();
  await expect(page.locator(".hide-confidence")).toHaveCount(1);
  await expect(doubtful).toHaveCount(2);
  await toggle.click();
  await expect(page.locator(".hide-confidence")).toHaveCount(0);

  // Click into "merci" and validate it.
  await doubtful.filter({ hasText: "merci" }).click();
  const validate = page.getByRole("button", { name: /validate/i });
  await expect(validate).toBeVisible();
  await validate.click();
  await expect(doubtful).toHaveText(["entretain"]);
  await expect(editor).toContainText("merci");

  // Correct "entretain": typing anywhere inside it is enough.
  await doubtful.filter({ hasText: "entretain" }).click();
  await page.keyboard.type("X");
  await expect(editor).toContainText("X");
  await expect(doubtful).toHaveCount(0);

  // Saved without them (autosave is debounced), so a reload keeps them gone.
  await expect
    .poll(
      async () => {
        const row = await testPrisma().transcription.findUnique({
          where: { id: transcriptionId },
          select: { transcription: true },
        });
        const payload = row?.transcription as {
          words?: { text: string; confidence?: number }[];
        };
        const words = payload?.words ?? [];
        return {
          edited: words.some((w) => w.text.includes("X")),
          doubtful: words.filter((w) => w.confidence !== undefined).length,
        };
      },
      { timeout: 45_000, intervals: [1000] },
    )
    .toEqual({ edited: true, doubtful: 0 });
});
