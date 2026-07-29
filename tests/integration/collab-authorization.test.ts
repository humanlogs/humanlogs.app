import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./helpers/prisma-mock");
  return { prisma: fakePrisma };
});

import * as Y from "yjs";
import { SignJWT } from "jose";
import type { Socket } from "socket.io-client";
import { createSocketToken } from "@/lib/auth/utils";
import { plaintextCodec } from "@/lib/sockets/yjs-collab-provider";
import {
  type CollabClient,
  type CollabServer,
  connectSocket,
  joinCollab,
  mintRoomGrant,
  nextTranscriptionId,
  registerTestUsers,
  settle,
  sleep,
  startCollabServer,
  waitFor,
} from "./helpers/collab-harness";
import { registerUser, updateShares } from "./helpers/prisma-mock";

/**
 * Authorization on the collaboration socket.
 *
 * Being logged in says who you are; it says nothing about which transcripts you
 * may open. A transcription id is a UUID that travels in URLs, exports and
 * emails — it is not a secret, so the server has to check every room join
 * against the owner / shared list rather than trusting the client to only ask
 * for rooms it is entitled to.
 *
 * These tests act as the attacker: a fully authenticated user who simply emits
 * the protocol's own events for someone else's transcription.
 */

let server: CollabServer;
const open: CollabClient[] = [];
const sockets: Socket[] = [];

/** A transcript owned by Alice, shared with Bob (write) and Carol (read). */
function privateTranscription() {
  return nextTranscriptionId({
    owner: "user-alice",
    shared: [
      { userId: "user-bob", role: "write" },
      { userId: "user-carol", role: "read" },
    ],
  });
}

const join = async (id: string, userId: string, seedContent?: string[]) => {
  const client = await joinCollab(server, id, userId, {
    codec: plaintextCodec,
    seedContent,
  });
  open.push(client);
  return client;
};

const rawSocket = async (userId: string) => {
  const socket = await connectSocket(server, userId);
  sockets.push(socket);
  return socket;
};

beforeAll(async () => {
  registerTestUsers();
  // An account in good standing who was never given access to anything.
  registerUser("user-outsider");
  server = await startCollabServer();
});

afterEach(async () => {
  await Promise.all(open.splice(0).map((c) => c.destroy().catch(() => {})));
  for (const socket of sockets.splice(0)) socket.disconnect();
});

afterAll(async () => {
  await server.close();
});

describe("joining a collaboration room", () => {
  it("lets the owner in", async () => {
    const alice = await join(privateTranscription(), "user-alice", ["Contenu"]);
    await alice.ready;
    expect(alice.role).toBe("seed");
  });

  it("lets a shared collaborator in", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Contenu"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;
    expect(bob.paragraphs()).toEqual(["Contenu"]);
  });

  it("refuses an authenticated user who was never shared with", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Notes confidentielles"]);
    await alice.ready;

    const outsider = await rawSocket("user-outsider");
    const denied: string[] = [];
    const roles: string[] = [];
    outsider.on("transcription:denied", (d) => denied.push(d.transcriptionId));
    outsider.on("yjs:role", (d) => roles.push(d.role));
    outsider.emit("yjs:join", { transcriptionId: id });

    await waitFor(() => denied.length > 0, { label: "a denial" });
    expect(roles).toEqual([]);
  });

  it("never sends the document to an unauthorized socket", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Notes confidentielles"]);
    await alice.ready;

    const outsider = await rawSocket("user-outsider");
    const received: unknown[] = [];
    outsider.on("yjs:state", (d) => received.push(d));
    outsider.on("yjs:msg", (d) => received.push(d));

    // The full attacker sequence: join, ask for the state, then sit and listen
    // while a legitimate participant types.
    outsider.emit("yjs:join", { transcriptionId: id });
    outsider.emit("yjs:state-request", { transcriptionId: id });
    await sleep(200);
    alice.append(" — un détail privé");
    await settle([alice]);

    expect(received).toEqual([]);
  });

  it("refuses a transcription that does not exist", async () => {
    const outsider = await rawSocket("user-outsider");
    const denied: string[] = [];
    outsider.on("transcription:denied", (d) => denied.push(d.transcriptionId));
    outsider.emit("yjs:join", { transcriptionId: "does-not-exist" });
    await waitFor(() => denied.length > 0, { label: "a denial" });
  });

  it("keeps the room's own members unaffected by a rejected join", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Contenu"]);
    await alice.ready;

    const outsider = await rawSocket("user-outsider");
    outsider.emit("yjs:join", { transcriptionId: id });
    await sleep(200);

    // The intruder must not have become the authority, nor displaced Alice.
    expect(alice.provider.isSaver).toBe(true);

    const bob = await join(id, "user-bob");
    await bob.ready;
    expect(bob.paragraphs()).toEqual(["Contenu"]);
  });
});

describe("writing to a collaboration room", () => {
  it("drops document updates from an unauthorized socket", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Texte légitime"]);
    await alice.ready;

    // A well-formed Yjs update, exactly like a real client would send.
    const forged = new Y.Doc();
    const frag = forged.getXmlFragment("default");
    const p = new Y.XmlElement("paragraph");
    p.insert(0, [new Y.XmlText("TEXTE INJECTÉ")]);
    frag.insert(0, [p]);

    const outsider = await rawSocket("user-outsider");
    outsider.emit("yjs:msg", {
      transcriptionId: id,
      t: "sync",
      enc: false,
      d: await plaintextCodec.encode(Y.encodeStateAsUpdate(forged)),
    });
    await settle([alice]);

    expect(alice.paragraphs()).toEqual(["Texte légitime"]);
  });

  it("drops document updates from a read-only collaborator", async () => {
    // The editor's read-only mode is a client-side courtesy; the server has to
    // enforce the role itself, or a read-only participant can simply not run it.
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Texte légitime"]);
    await alice.ready;

    const carol = await join(id, "user-carol");
    await carol.ready;
    expect(carol.paragraphs()).toEqual(["Texte légitime"]);

    carol.append(" AJOUT INTERDIT");
    await settle([alice, carol]);

    expect(alice.paragraphs()).toEqual(["Texte légitime"]);
  });

  it("still relays a read-only collaborator's caret", async () => {
    // Read-only participants are visible to the others — presence is not writing.
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Texte"]);
    await alice.ready;
    const carol = await join(id, "user-carol");
    await carol.ready;

    carol.awareness.setLocalStateField("user", { name: "Carol" });
    await waitFor(
      () =>
        [...alice.awareness.getStates().values()].some(
          (s: any) => s?.user?.name === "Carol",
        ),
      { label: "carol's caret to reach alice" },
    );
  });

  it("accepts document updates from a write collaborator", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Texte"]);
    await alice.ready;
    const bob = await join(id, "user-bob");
    await bob.ready;

    bob.append(" — ajout autorisé");
    await waitFor(() => alice.paragraphs()[0] === "Texte — ajout autorisé", {
      label: "bob's authorized edit",
    });
  });

  it("drops a cursor pushed into a room the sender has no access to", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Texte"]);
    await alice.ready;
    // Alice joins the presence room for real, so an empty result means the
    // intruder's cursor was dropped — not merely that nobody was listening.
    alice.socket.emit("transcription:join", {
      transcriptionId: id,
      grant: await mintRoomGrant("user-alice", id),
    });
    await sleep(100);

    const seen: unknown[] = [];
    alice.socket.on("transcription:cursor-position", (d) => seen.push(d));

    const outsider = await rawSocket("user-outsider");
    outsider.emit("transcription:cursor-update", {
      transcriptionId: id,
      position: {
        userId: "user-outsider",
        userName: "Intrus",
        startOffset: 0,
        endOffset: 0,
        timestamp: 1,
        hasWriteAccess: true,
      },
    });
    await sleep(300);

    expect(seen).toEqual([]);
  });

  it("relays a cursor from a participant of the same room", async () => {
    // The control for the test above: same setup, legitimate sender. Without it,
    // a silent presence relay would pass the negative case for the wrong reason.
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Texte"]);
    await alice.ready;
    alice.socket.emit("transcription:join", {
      transcriptionId: id,
      grant: await mintRoomGrant("user-alice", id),
    });

    const seen: { userId: string }[] = [];
    alice.socket.on("transcription:cursor-position", (d) => seen.push(d));

    const bob = await rawSocket("user-bob");
    bob.emit("transcription:join", {
      transcriptionId: id,
      grant: await mintRoomGrant("user-bob", id),
    });
    await sleep(100);
    bob.emit("transcription:cursor-update", {
      transcriptionId: id,
      position: {
        userId: "user-bob",
        userName: "Bob",
        startOffset: 0,
        endOffset: 0,
        timestamp: 1,
        hasWriteAccess: true,
      },
    });

    await waitFor(() => seen.some((c) => c.userId === "user-bob"), {
      label: "bob's cursor to reach alice",
    });
  });
});

/**
 * Attacks on the grant itself.
 *
 * The socket server's whole authorization now rests on this token, so each of
 * these is a way the scheme could have been hollow: a grant that works for
 * anyone, or for any document, or forever, would give the intruder exactly what
 * the owner/shared list is there to deny.
 */
describe("forging a room grant", () => {
  /** Join with `grant` and report whether the server let us in. */
  const tryJoin = async (
    userId: string,
    transcriptionId: string,
    grant: unknown,
  ): Promise<"admitted" | "denied"> => {
    const socket = await rawSocket(userId);
    const outcome = new Promise<"admitted" | "denied">((resolve) => {
      socket.on("yjs:role", () => resolve("admitted"));
      socket.on("transcription:denied", () => resolve("denied"));
    });
    socket.emit("yjs:join", { transcriptionId, grant });
    return outcome;
  };

  it("refuses a join with no grant at all", async () => {
    const id = privateTranscription();
    // Bob genuinely has write access — but access is claimed by presenting the
    // grant, not by being on a list the socket server cannot read.
    expect(await tryJoin("user-bob", id, undefined)).toBe("denied");
  });

  it("refuses a grant issued to someone else", async () => {
    const id = privateTranscription();
    // A grant intercepted from Bob (who may open this transcript) is worthless
    // to the outsider: it is bound to Bob's identity, which the socket proves
    // separately at handshake time.
    const bobsGrant = await mintRoomGrant("user-bob", id);
    expect(await tryJoin("user-outsider", id, bobsGrant)).toBe("denied");
  });

  it("refuses a grant issued for another transcription", async () => {
    // The outsider's own transcript gets them a perfectly valid grant — for
    // their own transcript. It must not open Alice's.
    const mine = nextTranscriptionId({ owner: "user-outsider", shared: [] });
    const theirs = privateTranscription();
    const myGrant = await mintRoomGrant("user-outsider", mine);
    expect(await tryJoin("user-outsider", theirs, myGrant)).toBe("denied");
  });

  it("refuses an expired grant", async () => {
    const id = privateTranscription();
    const stale = await mintRoomGrant("user-bob", id, { ttlSeconds: -60 });
    expect(await tryJoin("user-bob", id, stale)).toBe("denied");
  });

  it("refuses a hand-made grant signed with the wrong secret", async () => {
    const id = privateTranscription();
    const forged = await new SignJWT({ type: "room", tid: id, role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-outsider")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("not-the-session-secret"));
    expect(await tryJoin("user-outsider", id, forged)).toBe("denied");
  });

  it("refuses a socket token replayed as a grant", async () => {
    // Both are signed with the session secret, so only the claim type separates
    // "this is who I am" from "I may open this document".
    const id = privateTranscription();
    const token = await createSocketToken("user-outsider");
    expect(await tryJoin("user-outsider", id, token)).toBe("denied");
  });

  it("admits a grant that is exactly what it says it is", async () => {
    const id = privateTranscription();
    const grant = await mintRoomGrant("user-bob", id);
    expect(await tryJoin("user-bob", id, grant)).toBe("admitted");
  });
});

describe("access changes during a session", () => {
  it("lets a user in once they are granted access", async () => {
    const id = privateTranscription();
    const alice = await join(id, "user-alice", ["Contenu"]);
    await alice.ready;

    const outsider = await rawSocket("user-outsider");
    const denied: string[] = [];
    outsider.on("transcription:denied", (d) => denied.push(d.transcriptionId));
    outsider.emit("yjs:join", { transcriptionId: id });
    await waitFor(() => denied.length > 0, { label: "the first denial" });

    // The owner shares the transcript with them.
    updateShares(id, [
      { userId: "user-bob", role: "write" },
      { userId: "user-outsider", role: "write" },
    ]);

    const invited = await join(id, "user-outsider");
    await invited.ready;
    expect(invited.paragraphs()).toEqual(["Contenu"]);
  });
});
