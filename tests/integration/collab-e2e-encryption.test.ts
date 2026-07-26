import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        email: `${where.id}@example.com`,
        name: where.id,
      }),
    },
  },
}));

import { serverEncryption } from "@/lib/encryption/encryption-entities";
import { aesCodec, plaintextCodec } from "@/lib/sockets/yjs-collab-provider";
import {
  type CollabClient,
  type CollabServer,
  connectSocket,
  joinCollab,
  nextTranscriptionId,
  settle,
  startCollabServer,
  waitFor,
} from "./helpers/collab-harness";

/**
 * End-to-end encrypted collaboration. The relay is deliberately "blind": for an
 * encrypted transcription it must only ever carry ciphertext, and every peer
 * needs the transcription's session key to take part.
 *
 * These tests assert exactly that, on the wire, with a real server in between.
 */

let server: CollabServer;
const open: CollabClient[] = [];
const SECRET = "Le témoin décrit un souvenir très personnel";

const key = () => serverEncryption!.generateAESKeySync();

const join = async (
  transcriptionId: string,
  userId: string,
  aesKey: string,
  seedContent?: string[],
) => {
  const client = await joinCollab(server, transcriptionId, userId, {
    codec: aesCodec(aesKey),
    seedContent,
  });
  open.push(client);
  return client;
};

beforeAll(async () => {
  server = await startCollabServer();
});

afterEach(async () => {
  await Promise.all(open.splice(0).map((c) => c.destroy().catch(() => {})));
});

afterAll(async () => {
  await server.close();
});

describe("encrypted collaboration", () => {
  it("converges between two clients sharing the session key", async () => {
    const id = nextTranscriptionId();
    const k = key();
    const alice = await join(id, "user-alice", k, [SECRET]);
    await alice.ready;
    const bob = await join(id, "user-bob", k);
    await bob.ready;

    expect(bob.paragraphs()).toEqual([SECRET]);

    bob.append(" — suite");
    await waitFor(() => alice.paragraphs()[0] === `${SECRET} — suite`, {
      label: "alice to receive bob's encrypted edit",
    });
  });

  it("relays only ciphertext — the plaintext never crosses the server", async () => {
    const id = nextTranscriptionId();
    const k = key();
    const alice = await join(id, "user-alice", k, [SECRET]);
    await alice.ready;

    // A raw socket in the same room, capturing exactly what the server forwards.
    const wire: { t: string; enc: boolean; d: string }[] = [];
    const eavesdropper = await connectSocket(server, "user-eve");
    eavesdropper.on("yjs:msg", (data) => wire.push(data));
    eavesdropper.on("yjs:state", (data) =>
      wire.push({ t: "state", enc: data.enc, d: data.d }),
    );
    eavesdropper.emit("yjs:join", { transcriptionId: id });
    eavesdropper.emit("yjs:state-request", { transcriptionId: id });

    alice.append(" et un détail confidentiel");
    await waitFor(() => wire.length >= 2, {
      label: "the relay to forward doc traffic",
    });
    await settle([alice]);

    expect(wire.length).toBeGreaterThan(0);
    for (const msg of wire) {
      expect(msg.enc).toBe(true);
      // Neither the raw text nor its base64 form may appear in the payload.
      expect(msg.d).not.toContain(SECRET);
      expect(msg.d).not.toContain("confidentiel");
      expect(msg.d).not.toContain(Buffer.from(SECRET, "utf8").toString("base64"));
    }
    eavesdropper.disconnect();
  });

  it("leaves a peer holding the wrong key unable to read the document", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", key(), [SECRET]);
    await alice.ready;

    // Same room, different session key (e.g. access revoked, stale key).
    const intruder = await joinCollab(server, id, "user-mallory", {
      codec: aesCodec(key()),
    });
    open.push(intruder);
    alice.append(" suite");
    await settle([alice, intruder]);

    expect(intruder.paragraphs()).toEqual([]);
  });

  it("leaves a peer with no key at all unable to read the document", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", key(), [SECRET]);
    await alice.ready;

    const plaintextPeer = await joinCollab(server, id, "user-mallory", {
      codec: plaintextCodec,
    });
    open.push(plaintextPeer);
    alice.append(" suite");
    await settle([alice, plaintextPeer]);

    expect(plaintextPeer.paragraphs()).toEqual([]);
  });

  it("encrypts the full-state transfer served to a late joiner", async () => {
    const id = nextTranscriptionId();
    const k = key();
    const alice = await join(id, "user-alice", k, [SECRET]);
    await alice.ready;

    const seen: { enc: boolean; d: string }[] = [];
    const bobSocket = await connectSocket(server, "user-bob");
    bobSocket.on("yjs:state", (data) => seen.push(data));

    const bob = await joinCollab(server, id, "user-bob", {
      codec: aesCodec(k),
      socket: bobSocket,
    });
    open.push(bob);
    await bob.ready;

    expect(seen).toHaveLength(1);
    expect(seen[0].enc).toBe(true);
    expect(seen[0].d).not.toContain(SECRET);
    // …yet Bob, who holds the key, reads it fine.
    expect(bob.paragraphs()).toEqual([SECRET]);
  });

  it("keeps awareness (cursor) traffic encrypted too", async () => {
    const id = nextTranscriptionId();
    const k = key();
    const alice = await join(id, "user-alice", k, ["Bonjour"]);
    await alice.ready;

    const wire: { t: string; enc: boolean; d: string }[] = [];
    const eavesdropper = await connectSocket(server, "user-eve");
    eavesdropper.on("yjs:msg", (data) => wire.push(data));
    eavesdropper.emit("yjs:join", { transcriptionId: id });

    alice.awareness.setLocalStateField("user", { name: "Alice Dupont" });
    await waitFor(() => wire.some((m) => m.t === "awareness"), {
      label: "an awareness message on the wire",
    });

    for (const msg of wire.filter((m) => m.t === "awareness")) {
      expect(msg.enc).toBe(true);
      expect(msg.d).not.toContain("Alice Dupont");
    }
    eavesdropper.disconnect();
  });
});
