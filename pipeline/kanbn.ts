/**
 * kan.bn API client.
 *
 * Thin HTTP wrapper used by Claude (via the kanbn skill) and by CLI scripts.
 *
 * Env vars:
 *   KAN_API_TOKEN  — Bearer token (required)
 *   KAN_BASE_URL   — default https://kan.bn
 */

const BASE_URL = (process.env["KAN_BASE_URL"] ?? "https://kan.bn").replace(/\/$/, "");
const TOKEN = process.env["KAN_API_TOKEN"];

// ---------------------------------------------------------------------------
// Core HTTP helper
// ---------------------------------------------------------------------------

export async function kanRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  if (!TOKEN) throw new Error("KAN_API_TOKEN is not set");

  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`kan.bn ${method} ${path} → ${res.status}: ${text}`);

  try { return JSON.parse(text) as T; } catch { return text as unknown as T; }
}

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

export interface KanCard {
  publicId: string;
  title: string;
  description: string | null;
}

export interface KanBoard {
  publicId: string;
  name: string;
  lists: Array<{
    publicId: string;
    name: string;
    index: number;
    cards: KanCard[];
  }>;
}

/** List all workspaces. The API returns `[{ role, workspace: {...} }]`. */
export async function listWorkspaces() {
  const raw = await kanRequest<
    Array<{ role: string; workspace: { publicId: string; name: string; slug: string } }>
  >("GET", "/workspaces");
  return raw.map((w) => w.workspace);
}

/** List all boards in a workspace. */
export async function listBoards(workspacePublicId: string) {
  return kanRequest<Array<{ publicId: string; name: string; slug: string }>>(
    "GET", `/workspaces/${workspacePublicId}/boards`
  );
}

/** Get a board with all its lists and cards. */
export async function getBoard(boardPublicId: string): Promise<KanBoard> {
  return kanRequest<KanBoard>("GET", `/boards/${boardPublicId}`);
}

/** Get a single card (full detail, including description). */
export async function getCard(cardPublicId: string): Promise<KanCard> {
  return kanRequest<KanCard>("GET", `/cards/${cardPublicId}`);
}

/** Create a card. Returns the new card's publicId.
 *
 * The API requires labelPublicIds, memberPublicIds and position on create,
 * so we always send them (empty arrays + a default position). */
export async function createCard(payload: {
  listPublicId: string;
  title: string;
  description?: string;
  position?: "start" | "end";
}): Promise<string> {
  const { position = "end", ...rest } = payload;
  const card = await kanRequest<{ publicId: string }>("POST", "/cards", {
    ...rest,
    labelPublicIds: [],
    memberPublicIds: [],
    position,
  });
  return card.publicId;
}

/** Replace a card's description and/or move it to another list. */
export async function updateCard(
  cardPublicId: string,
  payload: { description?: string; title?: string; listPublicId?: string }
): Promise<void> {
  await kanRequest("PUT", `/cards/${cardPublicId}`, payload);
}
