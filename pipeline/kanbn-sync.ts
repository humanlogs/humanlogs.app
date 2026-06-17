/**
 * kan.bn sync — copies the git-versioned report and social posts onto the board.
 *
 * This is the ONLY thing that talks to kan.bn. Claude (via the kanbn skill)
 * never calls the API directly — it edits files in git:
 *
 *   pipeline/reports/cassou.app.md   → the single living report card
 *   pipeline/social/*.md             → one card per social proposal
 *
 * A GitHub Action runs this on push (the CI runner can reach kan.bn; the
 * Claude Code remote environment cannot, because kan.bn is not in its egress
 * allowlist). Run locally with:
 *
 *   KAN_API_TOKEN=kan_... npm run kanbn:sync
 *
 * The sync is idempotent and stateless — no kanbn-config.json needed:
 *   - Report: find (or create) the single report card, replace its description.
 *   - Social: create one card per file, skipping any whose title already
 *     exists on the board (title is the stable identity).
 *
 * Expected kan.bn structure (auto-discovered by name):
 *   Board "Reports" → list "cassou.app"  (living report card)
 *   Board "Social"  → first list         (social proposals)
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  listWorkspaces, listBoards, getBoard, getCard, createCard, updateCard,
  type KanBoard,
} from "./kanbn.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

// The landing page this repo syncs. Both kan.bn boards (Reports and Social)
// have one list per page, named after the page (e.g. "cassou.app"). KAN_PAGE
// selects which list to target and which report file to read, so the exact
// same code replicates across landing pages — only this value changes.
const PAGE = (process.env["KAN_PAGE"] ?? "cassou.app").trim();
const REPORT_FILE = join(__dirname, "reports", `${PAGE}.md`);
const SOCIAL_DIR = join(__dirname, "social");
const REPORT_CARD_TITLE = process.env["KAN_REPORT_CARD_TITLE"]?.trim() || `Rapport SEO — ${PAGE}`;

// ---------------------------------------------------------------------------
// Tiny frontmatter parser (avoids a dependency for a handful of scalar keys)
// ---------------------------------------------------------------------------

interface SocialPost {
  file: string;
  platform: string;          // "linkedin" | "reddit"
  keyword: string;
  date: string;              // YYYY-MM-DD
  subreddit?: string;        // reddit only
  body: string;
}

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw.trim() };
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    data[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return { data, body: match[2].trim() };
}

function socialTitle(p: SocialPost): string {
  if (p.platform === "reddit") {
    const sub = p.subreddit ?? "vinted";
    return `[Reddit/r/${sub}] ${p.keyword} — ${p.date}`;
  }
  return `[LinkedIn] ${p.keyword} — ${p.date}`;
}

function loadSocialPosts(): SocialPost[] {
  if (!existsSync(SOCIAL_DIR)) return [];
  return readdirSync(SOCIAL_DIR)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((file) => {
      const { data, body } = parseFrontmatter(readFileSync(join(SOCIAL_DIR, file), "utf8"));
      if (!data.platform || !data.keyword || !data.date) {
        throw new Error(`social/${file}: frontmatter must include platform, keyword, date`);
      }
      return {
        file, platform: data.platform.toLowerCase(), keyword: data.keyword,
        date: data.date, subreddit: data.subreddit, body,
      };
    });
}

// ---------------------------------------------------------------------------
// Board discovery
// ---------------------------------------------------------------------------

async function discover() {
  const workspaces = await listWorkspaces();
  const ws = workspaces[0];
  if (!ws) throw new Error("No workspace found");

  const boards = await listBoards(ws.publicId);
  const reportsBoard = boards.find((b) => /report/i.test(b.name));
  const socialBoard = boards.find((b) => /social/i.test(b.name));
  if (!reportsBoard) throw new Error('Board "Reports" not found — create it on kan.bn first');
  if (!socialBoard) throw new Error('Board "Social" not found — create it on kan.bn first');

  const rFull: KanBoard = await getBoard(reportsBoard.publicId);
  const sFull: KanBoard = await getBoard(socialBoard.publicId);

  const rLists = rFull.lists.slice().sort((a, b) => a.index - b.index);
  const sLists = sFull.lists.slice().sort((a, b) => a.index - b.index);

  // Pick the list named after this page (fallback: first list).
  const matchesPage = (name: string) => name.toLowerCase().includes(PAGE.toLowerCase());
  const reportList = rLists.find((l) => matchesPage(l.name)) ?? rLists[0];
  const socialList = sLists.find((l) => matchesPage(l.name)) ?? sLists[0];
  if (!reportList) throw new Error("No list found in Reports board");
  if (!socialList) throw new Error("No list found in Social board");

  return { reportList, socialList };
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

async function syncReport(reportList: KanBoard["lists"][number]) {
  if (!existsSync(REPORT_FILE)) {
    console.log("• Report: no pipeline/reports/cassou.app.md — skipping.");
    return;
  }
  const description = readFileSync(REPORT_FILE, "utf8").trim();

  let cardId = reportList.cards.find((c) =>
    c.title === REPORT_CARD_TITLE || /rapport/i.test(c.title) || /cassou\.app/i.test(c.title)
  )?.publicId;

  if (!cardId) {
    cardId = await createCard({
      listPublicId: reportList.publicId,
      title: REPORT_CARD_TITLE,
      description,
      position: "start",
    });
    console.log(`• Report: created card ${cardId}`);
    return;
  }

  // Skip the PUT when nothing changed, to keep the board activity log quiet.
  const current = await getCard(cardId);
  if ((current.description ?? "").trim() === description) {
    console.log(`• Report: card ${cardId} already up to date.`);
    return;
  }
  await updateCard(cardId, { description });
  console.log(`• Report: updated card ${cardId}`);
}

async function syncSocial(socialList: KanBoard["lists"][number]) {
  const posts = loadSocialPosts();
  if (posts.length === 0) {
    console.log("• Social: no posts in pipeline/social/.");
    return;
  }
  const existing = new Set(socialList.cards.map((c) => c.title));
  for (const post of posts) {
    const title = socialTitle(post);
    if (existing.has(title)) {
      console.log(`• Social: "${title}" already on board — skipping (${post.file}).`);
      continue;
    }
    const id = await createCard({
      listPublicId: socialList.publicId,
      title,
      description: post.body,
      position: "end",
    });
    existing.add(title);
    console.log(`• Social: created "${title}" → ${id} (${post.file})`);
  }
}

async function main() {
  console.log(`Page: ${PAGE}`);
  const { reportList, socialList } = await discover();
  console.log(`Reports list: "${reportList.name}" (${reportList.publicId})`);
  console.log(`Social list:  "${socialList.name}" (${socialList.publicId})\n`);
  await syncReport(reportList);
  await syncSocial(socialList);
  console.log("\nSync done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
