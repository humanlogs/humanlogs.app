import { expect, test, type Page } from "@playwright/test";
import {
  createTranscription,
  createUser,
  openEditor,
  signIn,
} from "./fixtures";

/**
 * The word-processor round trip, in a real browser: copy the transcript out,
 * fix a few things in Word, select everything and paste it back.
 *
 * What comes back from Word is plain prose — no `data-speaker-id`, no comment
 * anchors, and with Word's own typography. A plain paste replaces the whole
 * document with it, which silently collapses every speaker onto `speaker_0`.
 * `handlePaste` (see `utils/paste-merge.ts`) instead applies only the real diff.
 *
 * The unit suite covers the planner itself; this checks the wiring — that a
 * `Cmd+A` selection is recognized, that the merge fires on a real paste event,
 * and that the paragraphs keep their identity.
 */

// Three turns, two speakers, 38 words — a real transcript as far as the merge's
// "this is not a snippet" gate is concerned.
const TURNS = [
  "Bonjour et merci d'avoir accepté cet entretien pour notre étude sur le télétravail",
  "Merci à vous je travaille depuis chez moi depuis deux ans et demi maintenant et franchement",
  "Est-ce que vous pouvez me décrire une journée type s'il vous plaît",
];

const TRANSCRIPT_CSV = [
  "Speaker,Text",
  ...TURNS.map(
    (text, i) => `${i % 2 === 0 ? "Enquêteur" : "Participant"},"${text}"`,
  ),
].join("\n");

/** What Word puts on the clipboard: styled prose, and none of our attributes. */
const wordHtml = (paragraphs: string[]): string =>
  paragraphs
    .map(
      (text) =>
        `<p class="MsoNormal"><span style="font-size:11.0pt;font-family:Calibri">` +
        `${text.replace(/'/g, "’")}</span><o:p></o:p></p>`,
    )
    .join("");

/** Paragraph identity as the document holds it, straight from the DOM. */
const paragraphs = (page: Page) =>
  page.locator(".ProseMirror > p").evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: (node.textContent ?? "").replace(/\s+/g, " ").trim(),
      speakerId: node.getAttribute("data-speaker-id"),
    })),
  );

/** Fire a real paste event carrying `text/html`, as Word's clipboard would. */
async function pasteHtml(page: Page, html: string) {
  const editor = page.locator(".ProseMirror").first();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await editor.evaluate((node, clipboardHtml) => {
    const data = new DataTransfer();
    data.setData("text/html", clipboardHtml);
    node.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, html);
}

test("pasting an edited copy back from Word keeps the speakers and rewrites only what changed", async ({
  browser,
  request,
}) => {
  const user = await createUser(request, "Chercheuse");
  await request.post("/api/local-auth/login", {
    data: { email: user.email, password: user.password },
  });
  const transcriptionId = await createTranscription(request, {
    title: "Entretien télétravail",
    text: TRANSCRIPT_CSV,
    filename: "entretien.csv",
  });

  const page = await signIn(browser, user);
  await openEditor(page, transcriptionId);

  const before = await paragraphs(page);
  expect(before).toHaveLength(3);
  // Two distinct speakers is the property the naive paste destroys.
  expect(new Set(before.map((p) => p.speakerId)).size).toBe(2);

  // Back from Word: one corrected word in the first turn, the rest untouched
  // (but re-typographed by Word's autocorrect).
  const edited = [...TURNS];
  edited[0] = TURNS[0].replace("télétravail", "téléconsultation");
  await pasteHtml(page, wordHtml(edited));

  await expect(page.locator(".ProseMirror")).toContainText("téléconsultation");

  const after = await paragraphs(page);
  expect(after.map((p) => p.text)).toEqual(edited);
  // Same paragraphs, same speakers: nothing but the corrected word moved.
  expect(after.map((p) => p.speakerId)).toEqual(before.map((p) => p.speakerId));
  await expect(page.locator("[data-sonner-toast]")).toBeVisible();

  await page.close();
});

test("pasting an unmodified copy back changes nothing at all", async ({
  browser,
  request,
}) => {
  const user = await createUser(request, "Chercheur");
  await request.post("/api/local-auth/login", {
    data: { email: user.email, password: user.password },
  });
  const transcriptionId = await createTranscription(request, {
    title: "Entretien inchangé",
    text: TRANSCRIPT_CSV,
    filename: "entretien.csv",
  });

  const page = await signIn(browser, user);
  await openEditor(page, transcriptionId);

  const before = await paragraphs(page);
  await pasteHtml(page, wordHtml(TURNS));
  await expect(page.locator("[data-sonner-toast]")).toBeVisible();

  // Word's curly apostrophes are not edits: the document must be untouched, so
  // that no timestamp, comment anchor or remote caret is disturbed either.
  expect(await paragraphs(page)).toEqual(before);

  await page.close();
});
