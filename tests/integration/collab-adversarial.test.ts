import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./helpers/prisma-mock");
  return { prisma: fakePrisma };
});

import * as Y from "yjs";
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

/**
 * The awkward cases: races, churn, reconnections, hostile timing.
 *
 * Real-time collaboration breaks on the schedule nobody rehearses — two people
 * opening the same transcript in the same second, the save leader closing their
 * laptop mid-transfer, a train tunnel between two keystrokes. Each test here
 * reproduces one of those deterministically.
 */

let server: CollabServer;
const open: CollabClient[] = [];

const join = async (id: string, userId: string, seedContent?: string[]) => {
  const client = await joinCollab(server, id, userId, {
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
  await Promise.all(open.splice(0).map((c) => c.destroy().catch(() => {})));
});

afterAll(async () => {
  await server.close();
});

describe("join races", () => {
  it("elects exactly one authority when two clients open the same empty room at once", async () => {
    // Both users click the transcript at the same instant. If both seeded, the
    // transcript would end up duplicated — the classic double-seed bug.
    const id = nextTranscriptionId();
    const [alice, bob] = await Promise.all([
      join(id, "user-alice", ["Contenu initial"]),
      join(id, "user-bob", ["Contenu initial"]),
    ]);
    await Promise.all([alice.ready, bob.ready]);
    await settle([alice, bob]);

    const seeders = [alice, bob].filter((c) => c.seeded);
    expect(seeders).toHaveLength(1);
    expect(alice.paragraphs()).toEqual(["Contenu initial"]);
    expect(bob.paragraphs()).toEqual(alice.paragraphs());
  });

  it("elects one authority when five clients pile in simultaneously", async () => {
    const id = nextTranscriptionId();
    const users = ["user-alice", "user-bob", "user-carol", "user-eve", "user-mallory"];
    const clients = await Promise.all(
      users.map((u) => join(id, u, ["Entretien"])),
    );
    await Promise.all(clients.map((c) => c.ready));
    await settle(clients);

    expect(clients.filter((c) => c.provider.isSaver)).toHaveLength(1);
    for (const client of clients) {
      expect(client.paragraphs()).toEqual(["Entretien"]);
    }
  });

  it("ignores a duplicate join from a socket that is already the authority", async () => {
    // React mounts effects twice in development (StrictMode), and the provider
    // re-joins on every reconnect. A second join must not tell the authority to
    // "sync", or it would end up requesting state from itself and never seed.
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Contenu"]);
    await alice.ready;

    alice.socket.emit("yjs:join", { transcriptionId: id });
    await sleep(200);

    expect(alice.provider.isSaver).toBe(true);
    expect(alice.paragraphs()).toEqual(["Contenu"]);

    // …and the room still works for a newcomer.
    const bob = await join(id, "user-bob");
    await bob.ready;
    expect(bob.paragraphs()).toEqual(["Contenu"]);
  });
  it("gives the document to a provider rebuilt on a socket already in the room", async () => {
    // The editor does not always keep the provider it first created: React
    // re-runs the effect, and an encrypted transcript replaces the provider the
    // moment its session key resolves. The socket underneath is a singleton, so
    // the room sees the SAME client joining twice — and the replaced instance
    // says goodbye afterwards, its farewell being asynchronous.
    //
    // Both halves of that used to be fatal: the second join went unanswered (the
    // room took the client for a member that already knew everything) and the
    // late goodbye then cancelled its membership. The result was a blank editor
    // that no amount of waiting would fill.
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Contenu"]);
    await alice.ready;

    const bobSocket = await connectSocket(server, "user-bob");
    const first = await joinCollab(server, id, "user-bob", {
      codec: plaintextCodec,
      socket: bobSocket,
    });
    await first.ready;

    // Tear down and rebuild in the same tick, exactly as the effect does.
    const farewell = first.provider.destroy();
    const rebuilding = joinCollab(server, id, "user-bob", {
      codec: plaintextCodec,
      socket: bobSocket,
    });
    await farewell;
    const second = await rebuilding;
    open.push(second);

    await waitFor(() => second.paragraphs().length > 0, {
      label: "the rebuilt provider to receive the document",
    });
    expect(second.paragraphs()).toEqual(["Contenu"]);

    // Still a full member: what Alice types afterwards must reach it.
    alice.append(" modifié");
    await waitFor(() => second.paragraphs()[0] === "Contenu modifié", {
      label: "the rebuilt provider to keep receiving edits",
    });
  });
});

describe("losing the authority at the worst moment", () => {
  it("recovers when the authority vanishes before answering a state request", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Contenu original"]);
    await alice.ready;

    // Bob asks for the state; Alice's connection dies in that very window.
    const bobSocket = await connectSocket(server, "user-bob");
    const rolesSeen: string[] = [];
    bobSocket.on("yjs:role", (d) => rolesSeen.push(d.role));
    alice.socket.disconnect();

    const bob = await joinCollab(server, id, "user-bob", {
      codec: plaintextCodec,
      seedContent: ["Contenu de secours"],
      socket: bobSocket,
    });
    open.push(bob);

    // Bob must not be left hanging with an empty document: with nobody to pull
    // from he is promoted and seeds from the database copy he already holds.
    await bob.ready;
    expect(bob.paragraphs().join("")).not.toBe("");
    expect(bob.provider.isSaver).toBe(true);
  });

  it("asks again when the authority takes the state request to the grave", async () => {
    // The authority is still listed in the room but no longer answering — a
    // frozen tab, a half-closed socket. One unanswered request is all it takes
    // to leave a client staring at a blank document forever, so the provider
    // keeps asking, and re-joins as it does: that is what lets the room hand it
    // the seed once the ghost is finally reaped.
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Contenu original"]);
    await alice.ready;
    alice.socket.off("yjs:state-request");

    const bob = await join(id, "user-bob", ["Contenu de secours"]);
    await sleep(500);
    expect(bob.paragraphs(), "nobody answered, so nothing arrived").toEqual([]);

    alice.socket.disconnect();
    await bob.ready; // the retry finds an empty room and Bob is promoted
    expect(bob.paragraphs()).toEqual(["Contenu de secours"]);
    expect(bob.provider.isSaver).toBe(true);
  });

  it("hands the room over cleanly when the authority leaves mid-typing", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Base"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    alice.append(" alice1");
    await waitFor(() => bob.paragraphs()[0].includes("alice1"), {
      label: "bob to see the first edit",
    });

    // Alice types once more and disconnects in the same tick.
    alice.append(" alice2");
    alice.socket.disconnect();

    await waitFor(() => bob.provider.isSaver, { label: "bob to be promoted" });
    // Bob keeps everything he had; the in-flight edit may or may not have made
    // it out, but the document must never lose what he already received.
    expect(bob.paragraphs()[0]).toContain("alice1");

    bob.append(" bob1");
    const carol = await join(id, "user-carol");
    await carol.ready;
    expect(carol.paragraphs()[0]).toContain("bob1");
  });

  it("survives the whole room leaving and coming back", async () => {
    const id = nextTranscriptionId();
    const first = await join(id, "user-alice", ["Session 1"]);
    await first.ready;
    first.append(" modifiée");
    await first.destroy();
    open.length = 0;
    await sleep(150);

    // Everyone left: the in-memory room is gone, so the next arrival seeds from
    // the database again (the app's own persistence covers the content itself).
    const second = await join(id, "user-bob", ["Session 2"]);
    await second.ready;
    expect(second.role).toBe("seed");
    expect(second.paragraphs()).toEqual(["Session 2"]);
  });
});

describe("churn", () => {
  it("keeps exactly one save leader through repeated joins and leaves", async () => {
    const id = nextTranscriptionId();
    const anchor = await join(id, "user-alice", ["Ancre"]);
    await anchor.ready;

    for (let round = 0; round < 4; round++) {
      const transient = await join(id, "user-bob");
      await transient.ready;
      expect(transient.provider.isSaver).toBe(false);
      await transient.destroy();
      open.pop();
      await sleep(50);
    }

    expect(anchor.provider.isSaver).toBe(true);
    expect(anchor.paragraphs()).toEqual(["Ancre"]);

    const late = await join(id, "user-carol");
    await late.ready;
    expect(late.paragraphs()).toEqual(["Ancre"]);
    expect([anchor, late].filter((c) => c.provider.isSaver)).toHaveLength(1);
  });

  it("ignores traffic from a client that already left", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Contenu"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    // Bob leaves the room but keeps the socket, then keeps typing locally.
    bob.socket.emit("yjs:leave", { transcriptionId: id });
    await sleep(100);
    bob.append(" APRES DEPART");
    await settle([alice, bob]);

    // The relay must not carry his edits any more.
    expect(alice.paragraphs()).toEqual(["Contenu"]);
  });
});

describe("hostile timing", () => {
  it("does not lose an edit made while the state transfer is in flight", async () => {
    // Classic snapshot race: the authority serialises the document, and the very
    // next keystroke happens before the joiner has applied it.
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Debut"]);
    await alice.ready;

    const bobSocket = await connectSocket(server, "user-bob");
    // Hold the full state back so we can type into the gap it leaves.
    let releaseState: (() => void) | null = null;
    bobSocket.on("yjs:state", () => {});
    const originalOn = bobSocket.on.bind(bobSocket);
    void originalOn;

    const bob = await joinCollab(server, id, "user-bob", {
      codec: {
        enc: false,
        encode: plaintextCodec.encode,
        decode: async (payload) => {
          if (releaseState) await new Promise<void>((r) => (releaseState = r));
          return plaintextCodec.decode(payload);
        },
      },
      socket: bobSocket,
    });
    open.push(bob);

    alice.append(" pendant le transfert");
    await bob.ready;
    await settle([alice, bob]);

    expect(bob.paragraphs()[0]).toContain("pendant le transfert");
    expect(bob.paragraphs()).toEqual(alice.paragraphs());
  });

  it("converges when messages are delivered out of order", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Base"]);
    await alice.ready;

    // Bob's transport delays every other message, so updates land reversed.
    let n = 0;
    const bob = await joinCollab(server, id, "user-bob", {
      codec: {
        enc: false,
        encode: plaintextCodec.encode,
        decode: async (payload) => {
          if (n++ % 2 === 0) await sleep(120);
          return plaintextCodec.decode(payload);
        },
      },
    });
    open.push(bob);
    await bob.ready;

    for (const word of [" un", " deux", " trois", " quatre"]) {
      alice.append(word);
      await sleep(10);
    }

    await waitFor(
      () => bob.paragraphs()[0] === alice.paragraphs()[0],
      { timeout: 8000, label: "bob to converge despite reordering" },
    );
    expect(bob.paragraphs()[0]).toBe("Base un deux trois quatre");
  });

  it("merges edits made while a client was disconnected", async () => {
    // A collaborator goes through a tunnel: they keep typing offline, the others
    // keep typing online, and both sides must survive the reunion.
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Base"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    bob.socket.disconnect();
    await sleep(100);

    bob.append(" HORS-LIGNE");
    alice.append(" EN-LIGNE");
    await sleep(100);

    bob.socket.connect();
    await waitFor(() => bob.socket.connected, { label: "bob to reconnect" });
    await settle([alice, bob]);

    // Neither side may lose work.
    expect(bob.paragraphs()[0]).toContain("HORS-LIGNE");
    expect(bob.paragraphs()[0]).toContain("EN-LIGNE");
    expect(alice.paragraphs()[0]).toContain("HORS-LIGNE");
    expect(alice.paragraphs()[0]).toContain("EN-LIGNE");
    expect(alice.paragraphs()).toEqual(bob.paragraphs());
  });

  it("converges when two clients edit the exact same position", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["MOT"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    // Both insert in the middle of the same word, in the same tick.
    const insertAt = (client: CollabClient, index: number, text: string) => {
      const frag = client.doc.getXmlFragment("default");
      const p = frag.get(0) as Y.XmlElement;
      (p.get(0) as Y.XmlText).insert(index, text);
    };
    insertAt(alice, 1, "aaa");
    insertAt(bob, 1, "bbb");

    await settle([alice, bob]);
    expect(alice.paragraphs()).toEqual(bob.paragraphs());
    expect(alice.paragraphs()[0]).toContain("aaa");
    expect(alice.paragraphs()[0]).toContain("bbb");
  });

  it("converges when one client deletes what another is typing into", async () => {
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["Premier", "Second"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;
    expect(bob.paragraphs()).toEqual(["Premier", "Second"]);

    // Alice deletes the second paragraph while Bob types into it.
    const bobFrag = bob.doc.getXmlFragment("default");
    const bobParagraph = bobFrag.get(1) as Y.XmlElement;
    alice.doc.getXmlFragment("default").delete(1, 1);
    (bobParagraph.get(0) as Y.XmlText).insert(6, " modifié");

    await settle([alice, bob]);
    expect(alice.paragraphs()).toEqual(bob.paragraphs());
    // Whatever the outcome, the surviving first paragraph is untouched.
    expect(alice.paragraphs()[0]).toBe("Premier");
  });
});

describe("size", () => {
  it("transfers a multi-megabyte transcript to a late joiner", async () => {
    // Socket.io's default 1 MB frame cap silently kills the socket; long
    // interviews go well past it, so the raised cap needs a guard.
    const id = nextTranscriptionId();
    const alice = await join(id, "user-alice", ["placeholder"]);
    await alice.ready;

    const paragraph = alice.doc
      .getXmlFragment("default")
      .get(0) as Y.XmlElement;
    const text = paragraph.get(0) as Y.XmlText;
    alice.doc.transact(() => {
      text.insert(text.length, " mot".repeat(400_000));
    });
    expect(Y.encodeStateAsUpdate(alice.doc).length).toBeGreaterThan(1_000_000);

    const bob = await join(id, "user-bob");
    await waitFor(() => bob.synced, {
      timeout: 15_000,
      label: "the large state transfer",
    });
    expect(bob.paragraphs()[0].length).toBe(alice.paragraphs()[0].length);
  });
});
