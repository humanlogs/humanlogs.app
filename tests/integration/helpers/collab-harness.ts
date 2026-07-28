import { createServer, type Server as HTTPServer } from "http";
import type { AddressInfo } from "net";
import { io as ioClient, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import { initSocketServer } from "@/lib/sockets/socket-server";
import { createSocketToken } from "@/lib/auth/utils";
import {
  YjsCollabProvider,
  type YjsCodec,
} from "@/lib/sockets/yjs-collab-provider";
import {
  createRoomGrant,
  type RoomRole,
} from "@/lib/sockets/room-grant";
import { checkAccess } from "@/lib/transcriptions/access";
import {
  getFixtureTranscription,
  registerTranscription,
  registerUser,
  type FixtureShare,
} from "./prisma-mock";

/**
 * Harness for the collaboration integration tests: a REAL Socket.io server
 * (the app's own `initSocketServer`) on an ephemeral port, REAL socket.io-client
 * connections carrying REAL JWT socket tokens, and REAL Y.Docs driven by the
 * app's `YjsCollabProvider`.
 *
 * Nothing about the protocol is faked, so these tests fail whenever the relay
 * contract (roles, state hand-off, room isolation, E2E opacity) changes.
 */

export type CollabServer = {
  url: string;
  http: HTTPServer;
  close: () => Promise<void>;
};

export async function startCollabServer(): Promise<CollabServer> {
  const http = createServer();
  initSocketServer(http);
  await new Promise<void>((resolve) => http.listen(0, resolve));
  const { port } = http.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    http,
    close: () =>
      new Promise<void>((resolve) => {
        http.closeAllConnections?.();
        http.close(() => resolve());
      }),
  };
}

/**
 * Mint a room grant exactly as the API does: read the transcription, check the
 * caller's access, sign what it finds. Null when there is nothing to grant —
 * which is how an unauthorized client ends up joining empty-handed and refused.
 *
 * This stands in for `GET /api/transcriptions/:id`, the only part of the flow
 * these tests cannot run for real (it needs an HTTP layer and a database). The
 * rule it applies is the app's own `checkAccess`, not a copy of it.
 */
export async function mintRoomGrant(
  userId: string,
  transcriptionId: string,
  opts: { ttlSeconds?: number } = {},
): Promise<string | null> {
  const transcription = getFixtureTranscription(transcriptionId);
  if (!transcription) return null;
  const access = checkAccess(transcription, userId);
  if (!access.hasAccess) return null;
  const { token } = await createRoomGrant({
    userId,
    transcriptionId,
    role: (access.isOwner ? "owner" : access.role) as RoomRole,
    ttlSeconds: opts.ttlSeconds,
  });
  return token;
}

/** Connect a raw authenticated socket (no Yjs provider attached). */
export async function connectSocket(
  server: CollabServer,
  userId: string,
  opts: { token?: string } = {},
): Promise<Socket> {
  const token = opts.token ?? (await createSocketToken(userId));
  const socket = ioClient(server.url, {
    path: "/api/socket",
    transports: ["websocket"],
    auth: { token },
    // Tests must fail fast rather than hang on a broken handshake.
    timeout: 5000,
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.on("connect", () => resolve());
    socket.on("connect_error", reject);
  });
  return socket;
}

export type CollabClient = {
  userId: string;
  socket: Socket;
  doc: Y.Doc;
  awareness: Awareness;
  provider: YjsCollabProvider;
  /** Resolves once this client has content (seeded locally or synced from a peer). */
  ready: Promise<void>;
  role: "seed" | "sync" | null;
  seeded: boolean;
  synced: boolean;
  /** Paragraph texts of the shared XmlFragment, in order. */
  paragraphs: () => string[];
  /** Type `text` at the end of the (single) paragraph. */
  append: (text: string) => void;
  destroy: () => Promise<void>;
};

/**
 * Join a transcription room as a collaborating client.
 *
 * `seedContent` mirrors what the editor does when the server designates it as the
 * seeding authority: write the initial transcript into the empty fragment. Late
 * joiners never call it — they pull full state from the authority instead.
 */
export async function joinCollab(
  server: CollabServer,
  transcriptionId: string,
  userId: string,
  opts: { codec: YjsCodec; seedContent?: string[]; socket?: Socket } = {
    codec: undefined as unknown as YjsCodec,
  },
): Promise<CollabClient> {
  const socket = opts.socket ?? (await connectSocket(server, userId));
  const doc = new Y.Doc();
  const awareness = new Awareness(doc);

  let resolveReady: () => void;
  const ready = new Promise<void>((r) => (resolveReady = r));

  const client: Partial<CollabClient> & { role: "seed" | "sync" | null } = {
    role: null,
    seeded: false,
    synced: false,
  };

  const provider = new YjsCollabProvider(socket, transcriptionId, doc, opts.codec, {
    // Per-client, because several users share one process here (see mintRoomGrant).
    grant: () => mintRoomGrant(userId, transcriptionId),
    onSeed: () => {
      client.role = "seed";
      client.seeded = true;
      const frag = doc.getXmlFragment("default");
      if (frag.length === 0) {
        doc.transact(() => {
          for (const text of opts.seedContent ?? []) {
            const p = new Y.XmlElement("paragraph");
            p.setAttribute("speakerId", "speaker_0");
            p.insert(0, [new Y.XmlText(text)]);
            frag.insert(frag.length, [p]);
          }
        }, "seed");
      }
      resolveReady();
    },
    onSynced: () => {
      client.synced = true;
      resolveReady();
    },
    onRole: () => {},
    awareness,
  });

  // The server answers `yjs:join` with a role; a "sync" client then pulls state.
  socket.on("yjs:role", (data: { transcriptionId: string; role: string }) => {
    if (data.transcriptionId === transcriptionId && data.role === "sync") {
      client.role = "sync";
    }
  });

  const full = Object.assign(client, {
    userId,
    socket,
    doc,
    awareness,
    provider,
    ready,
    paragraphs: () =>
      doc
        .getXmlFragment("default")
        .toArray()
        .map((n) => (n as Y.XmlElement).toString())
        .map((s) => s.replace(/<[^>]*>/g, "")),
    append: (text: string) => {
      const frag = doc.getXmlFragment("default");
      const p = frag.get(frag.length - 1) as Y.XmlElement;
      const t = p.get(0) as Y.XmlText;
      t.insert(t.length, text);
    },
    // Mirrors the editor's unmount path. In the app the socket is a long-lived
    // singleton that outlives the provider, so the farewell awareness packet is
    // always flushed; here we own the socket, and closing it in the same tick as
    // the emit would discard the buffered packet. One tick of grace models the
    // real client instead of testing an artefact of the harness.
    destroy: async () => {
      await provider.destroy();
      await sleep(25);
      socket.disconnect();
      doc.destroy();
    },
  }) as CollabClient;

  return full;
}

/** Poll until `predicate` holds, or fail after `timeout` ms. */
export async function waitFor(
  predicate: () => boolean,
  { timeout = 5000, interval = 20, label = "condition" } = {},
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(interval);
  }
  throw new Error(`Timed out after ${timeout}ms waiting for ${label}`);
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Wait for the room to go quiet — no relayed message for `quiet` ms. */
export async function settle(clients: CollabClient[], quiet = 250) {
  const states = () => clients.map((c) => Y.encodeStateVector(c.doc).join(","));
  let previous = states().join("|");
  for (let i = 0; i < 40; i++) {
    await sleep(quiet / 2);
    const current = states().join("|");
    if (current === previous) return;
    previous = current;
  }
}

/**
 * The regular cast. Registering them as real accounts is what lets the socket
 * server authenticate their tokens; the transcription fixtures below decide what
 * each of them is actually allowed to do.
 */
export const TEST_USERS = [
  "user-alice",
  "user-bob",
  "user-carol",
  "user-eve",
  "user-mallory",
] as const;

export function registerTestUsers(ids: readonly string[] = TEST_USERS) {
  for (const id of ids) registerUser(id);
}

let counter = 0;

/**
 * A fresh transcription per test (so the server's room map never leaks state),
 * registered in the fixture database because the server now authorizes every
 * room join against the owner / shared list.
 *
 * By default the whole cast has write access — tests about *permissions* pass an
 * explicit owner and share list instead.
 */
export const nextTranscriptionId = (opts?: {
  owner?: string;
  shared?: FixtureShare[];
}): string => {
  const id = `transcription-${process.pid}-${++counter}`;
  registerTranscription({
    id,
    userId: opts?.owner ?? "user-alice",
    shared:
      opts?.shared ??
      TEST_USERS.filter((u) => u !== (opts?.owner ?? "user-alice")).map(
        (userId) => ({ userId, role: "write" as const }),
      ),
  });
  return id;
};
