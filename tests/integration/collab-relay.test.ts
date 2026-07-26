import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The socket server reads two things from the database: the user behind a socket
 * token, and the transcription a client asks to join. Both come from an in-memory
 * fixture here — the JWT verification and the authorization rules themselves run
 * for real.
 */
vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./helpers/prisma-mock");
  return { prisma: fakePrisma };
});

import { io as ioClient, type Socket } from "socket.io-client";
import * as Y from "yjs";
import { createSocketToken } from "@/lib/auth/utils";
import { plaintextCodec } from "@/lib/sockets/yjs-collab-provider";
import {
  type CollabClient,
  type CollabServer,
  connectSocket,
  joinCollab,
  nextTranscriptionId,
  registerTestUsers,
  settle,
  sleep,
  startCollabServer,
  waitFor,
} from "./helpers/collab-harness";

let server: CollabServer;
const open: CollabClient[] = [];

const join = async (
  transcriptionId: string,
  userId: string,
  seedContent?: string[],
) => {
  const client = await joinCollab(server, transcriptionId, userId, {
    codec: plaintextCodec,
    seedContent,
  });
  open.push(client);
  return client;
};

beforeAll(async () => {
  registerTestUsers();
  server = await startCollabServer();
});

afterEach(async () => {
  // Disconnecting frees the server-side room membership, which is what triggers
  // authority re-election — exercised on purpose in the hand-off tests.
  await Promise.all(
    open.splice(0).map((client) =>
      client.destroy().catch(() => {
        /* already destroyed by the test */
      }),
    ),
  );
});

afterAll(async () => {
  await server.close();
});

describe("connection & authentication", () => {
  /**
   * Rejection happens in a Socket.io middleware, so a bad handshake never
   * becomes a connection: the client sees `connect_error`. That ordering is not
   * cosmetic — authenticating inside the async `connection` handler used to drop
   * the `yjs:join` packet a client sends the instant it connects.
   */
  const expectRejected = (socket: Socket) =>
    new Promise<string>((resolve, reject) => {
      socket.on("connect_error", (err: Error) => resolve(err.message));
      socket.on("connect", () =>
        reject(new Error("handshake should have been rejected")),
      );
    });

  it("accepts a valid socket token", async () => {
    const socket = await connectSocket(server, "user-alice");
    expect(socket.connected).toBe(true);
    socket.disconnect();
  });

  it("rejects a handshake with no token", async () => {
    const socket = ioClient(server.url, {
      path: "/api/socket",
      transports: ["websocket"],
      reconnection: false,
    });
    await expect(expectRejected(socket)).resolves.toBe("Authentication required");
    socket.disconnect();
  });

  it("rejects a handshake whose token is not a valid socket token", async () => {
    const socket = ioClient(server.url, {
      path: "/api/socket",
      transports: ["websocket"],
      auth: { token: "not-a-jwt" },
      reconnection: false,
    });
    await expect(expectRejected(socket)).resolves.toBe("Authentication required");
    socket.disconnect();
  });

  it("rejects a handshake whose user no longer exists", async () => {
    const socket = ioClient(server.url, {
      path: "/api/socket",
      transports: ["websocket"],
      auth: { token: await createSocketToken("user-deleted") },
      reconnection: false,
    });
    await expect(expectRejected(socket)).resolves.toBe("Authentication required");
    socket.disconnect();
  });

  it("serves a room join emitted in the same tick as the connection", async () => {
    // Regression guard: the client emits `yjs:join` immediately on connect. If the
    // server authenticates before registering its handlers, that packet is lost and
    // the editor silently never seeds nor syncs.
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await expect(alice.ready).resolves.toBeUndefined();
    expect(alice.role).toBe("seed");
  });
});

describe("seeding authority", () => {
  it("makes the first client in a room the seed authority (and save leader)", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour le monde"]);
    await alice.ready;

    expect(alice.role).toBe("seed");
    expect(alice.seeded).toBe(true);
    expect(alice.provider.isSaver).toBe(true);
    expect(alice.paragraphs()).toEqual(["Bonjour le monde"]);
  });

  it("gives a late joiner the 'sync' role and the authority's full state", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour le monde"]);
    await alice.ready;

    // Bob seeds different content — he must NEVER use it, the authority wins.
    const bob = await join(id, "user-bob", ["CONTENU QUI NE DOIT PAS SERVIR"]);
    await bob.ready;

    expect(bob.role).toBe("sync");
    expect(bob.seeded).toBe(false);
    expect(bob.synced).toBe(true);
    expect(bob.paragraphs()).toEqual(["Bonjour le monde"]);
    // Exactly one save leader, so two clients can never race on persistence.
    expect([alice.provider.isSaver, bob.provider.isSaver]).toEqual([true, false]);
  });

  it("keeps a single save leader with three clients in the room", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Un"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    const carol = await join(id, "user-carol");
    await Promise.all([bob.ready, carol.ready]);

    const savers = [alice, bob, carol].filter((c) => c.provider.isSaver);
    expect(savers).toHaveLength(1);
    expect(savers[0]).toBe(alice);
  });
});

describe("convergence", () => {
  it("propagates an edit from the authority to a peer", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    alice.append(" le monde");
    await waitFor(() => bob.paragraphs()[0] === "Bonjour le monde", {
      label: "bob to receive alice's edit",
    });
  });

  it("propagates an edit from a peer back to the authority", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    bob.append(" tout le monde");
    await waitFor(() => alice.paragraphs()[0] === "Bonjour tout le monde", {
      label: "alice to receive bob's edit",
    });
  });

  it("converges when two clients edit concurrently", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Base"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    // Simultaneous local edits, neither client having seen the other's.
    alice.append(" alice");
    bob.append(" bob");

    await settle([alice, bob]);
    expect(bob.paragraphs()).toEqual(alice.paragraphs());
    // CRDT semantics: no edit is lost.
    expect(alice.paragraphs()[0]).toContain("alice");
    expect(alice.paragraphs()[0]).toContain("bob");
  });

  it("converges with three clients typing at the same time", async () => {
    const id = nextTranscriptionId();
    // Seed text deliberately free of a/b/c so the per-client counts below are exact.
    const alice = await join(id, "user-alice", ["0"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    const carol = await join(id, "user-carol");
    await Promise.all([bob.ready, carol.ready]);

    for (let i = 0; i < 10; i++) {
      alice.append("a");
      bob.append("b");
      carol.append("c");
      await sleep(5);
    }

    await settle([alice, bob, carol]);
    expect(bob.paragraphs()).toEqual(alice.paragraphs());
    expect(carol.paragraphs()).toEqual(alice.paragraphs());
    const text = alice.paragraphs()[0];
    expect(text.split("a")).toHaveLength(11); // 10 inserted 'a'
    expect(text.split("b")).toHaveLength(11);
    expect(text.split("c")).toHaveLength(11);
  });

  it("syncs the shared speaker-name map (Y.Map, not the text fragment)", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await alice.ready;
    alice.doc.getMap<string>("speakers").set("speaker_0", "Intervieweur");

    const bob = await join(id, "user-bob");
    await bob.ready;

    // Late joiner inherits it with the full state…
    await waitFor(
      () => bob.doc.getMap<string>("speakers").get("speaker_0") === "Intervieweur",
      { label: "bob to inherit speaker names" },
    );

    // …and a live rename propagates both ways.
    bob.doc.getMap<string>("speakers").set("speaker_1", "Participant");
    await waitFor(
      () => alice.doc.getMap<string>("speakers").get("speaker_1") === "Participant",
      { label: "alice to receive the rename" },
    );
  });

  it("syncs the shared timing reference used to derive word timestamps", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour le monde"]);
    await alice.ready;
    alice.doc
      .getMap("timing")
      .set("ref", [{ type: "word", text: "Bonjour", start: 0, end: 0.5 }]);

    const bob = await join(id, "user-bob");
    await bob.ready;

    await waitFor(
      () => (bob.doc.getMap("timing").get("ref") as unknown[])?.length === 1,
      { label: "bob to inherit the timing reference" },
    );
  });
});

describe("authority hand-off", () => {
  it("promotes a remaining member when the authority leaves", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;
    expect(bob.provider.isSaver).toBe(false);

    await alice.destroy();

    // Bob becomes the save leader — otherwise nobody would persist the document.
    await waitFor(() => bob.provider.isSaver, {
      label: "bob to be promoted to save leader",
    });
  });

  it("lets the promoted client serve state to the next joiner (content survives)", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Contenu original"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    await alice.destroy();
    await waitFor(() => bob.provider.isSaver, { label: "bob promoted" });

    const carol = await join(id, "user-carol", ["MAUVAIS CONTENU"]);
    await carol.ready;
    expect(carol.paragraphs()).toEqual(["Contenu original"]);
  });

  it("does not re-seed over existing content when a client is promoted", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Original"]);
    await alice.ready;
    // Bob would seed "AUTRE" if he were ever asked to seed a non-empty doc.
    const bob = await join(id, "user-bob", ["AUTRE"]);
    await bob.ready;

    await alice.destroy();
    await waitFor(() => bob.provider.isSaver, { label: "bob promoted" });
    await settle([bob]);

    expect(bob.paragraphs()).toEqual(["Original"]);
  });

  it("re-seeds from scratch once the room is completely empty", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Session 1"]);
    await alice.ready;
    await alice.destroy();
    await sleep(100);

    // A fresh session (everyone gone) must seed again from the database content,
    // not inherit a stale in-memory room.
    const bob = await join(id, "user-bob", ["Session 2"]);
    await bob.ready;
    expect(bob.role).toBe("seed");
    expect(bob.paragraphs()).toEqual(["Session 2"]);
  });
});

describe("room isolation", () => {
  it("never relays a message to a different transcription's room", async () => {
    const alice = await join(nextTranscriptionId(), "user-alice", ["Doc A"]);
    const bob = await join(nextTranscriptionId(), "user-bob", ["Doc B"]);
    await Promise.all([alice.ready, bob.ready]);

    alice.append(" — modifié");
    await settle([alice, bob]);

    expect(bob.paragraphs()).toEqual(["Doc B"]);
    expect(alice.paragraphs()).toEqual(["Doc A — modifié"]);
  });

  it("ignores a message tagged with another transcription id on the same socket", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    const doc = new Y.Doc();
    const frag = doc.getXmlFragment("default");
    const p = new Y.XmlElement("paragraph");
    p.insert(0, [new Y.XmlText("INJECTÉ")]);
    frag.insert(0, [p]);

    // Same room, wrong transcriptionId in the payload → the provider must drop it.
    alice.socket.emit("yjs:msg", {
      transcriptionId: "some-other-transcription",
      t: "sync",
      enc: false,
      d: await plaintextCodec.encode(Y.encodeStateAsUpdate(doc)),
    });
    await settle([bob]);

    expect(bob.paragraphs()).toEqual(["Bonjour"]);
  });
});

describe("awareness (remote carets)", () => {
  it("relays awareness states between peers", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    alice.awareness.setLocalStateField("user", {
      name: "Alice",
      color: "#ff0000",
    });

    await waitFor(
      () =>
        [...bob.awareness.getStates().values()].some(
          (s: any) => s?.user?.name === "Alice",
        ),
      { label: "bob to see alice's caret" },
    );
  });

  it("removes a peer's caret when they leave", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Bonjour"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    alice.awareness.setLocalStateField("user", { name: "Alice" });
    await waitFor(
      () =>
        [...bob.awareness.getStates().values()].some(
          (s: any) => s?.user?.name === "Alice",
        ),
      { label: "alice's caret to appear" },
    );

    await alice.destroy();
    await waitFor(
      () =>
        ![...bob.awareness.getStates().values()].some(
          (s: any) => s?.user?.name === "Alice",
        ),
      { label: "alice's caret to disappear" },
    );
  });
});
