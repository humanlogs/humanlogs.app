import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Same fixture database as the other integration files: the socket server still
 * resolves the user behind a token for real, it just reads them from memory.
 */
vi.mock("@/lib/prisma", async () => {
  const { fakePrisma } = await import("./helpers/prisma-mock");
  return { prisma: fakePrisma };
});

import type { Socket } from "socket.io-client";
import {
  notifyDatabaseChange,
  notifyTranscriptionReverted,
} from "@/lib/sockets/socket-helpers";
import {
  type CollabServer,
  connectSocket,
  registerTestUsers,
  startCollabServer,
  waitFor,
} from "./helpers/collab-harness";

/**
 * Everything the server pushes to a *user* rather than to a document goes through
 * the `user:<id>` room: `db:change` (which is what makes comments, notifications
 * and transcription lists refresh live) and `transcription:reverted`.
 *
 * Nothing fails loudly when a socket is not in that room — `io.to()` on an empty
 * room is a no-op — so the only way to notice is to assert delivery. This file
 * does exactly that, for a real client over a real socket.
 */

let server: CollabServer;
const open: Socket[] = [];

const connect = async (userId: string) => {
  const socket = await connectSocket(server, userId);
  open.push(socket);
  return socket;
};

/** Collect every occurrence of `event` on a socket. */
function collect<T>(socket: Socket, event: string): T[] {
  const received: T[] = [];
  socket.on(event, (payload: T) => received.push(payload));
  return received;
}

beforeAll(async () => {
  registerTestUsers();
  server = await startCollabServer();
});

afterEach(() => {
  for (const socket of open.splice(0)) socket.disconnect();
});

afterAll(async () => {
  await server.close();
});

describe("user room notifications", () => {
  it("delivers db:change to the addressed user only", async () => {
    const alice = await connect("user-alice");
    const bob = await connect("user-bob");

    const forAlice = collect<{ table: string; data?: unknown }>(
      alice,
      "db:change",
    );
    const forBob = collect(bob, "db:change");

    notifyDatabaseChange("user-alice", "comment", "create", {
      transcriptionId: "transcription-1",
    });

    await waitFor(() => forAlice.length > 0, { label: "db:change for alice" });
    expect(forAlice[0].table).toBe("comment");
    expect(forAlice[0].data).toEqual({ transcriptionId: "transcription-1" });
    expect(forBob).toHaveLength(0);
  });

  it("reaches every participant of a commented transcription", async () => {
    // What the comments route does: one notification per participant, so a
    // collaborator's comment list invalidates the moment the note is written.
    const participants = ["user-alice", "user-bob", "user-carol"];
    const sockets = await Promise.all(participants.map(connect));
    const inboxes = sockets.map((s) => collect(s, "db:change"));

    for (const userId of participants) {
      notifyDatabaseChange(userId, "comment", "create", {
        transcriptionId: "transcription-2",
      });
    }

    await waitFor(() => inboxes.every((inbox) => inbox.length === 1), {
      label: "db:change for every participant",
    });
  });

  it("delivers transcription:reverted to the listed users", async () => {
    const alice = await connect("user-alice");
    const eve = await connect("user-eve");

    const forAlice = collect<{ transcriptionId: string }>(
      alice,
      "transcription:reverted",
    );
    const forEve = collect(eve, "transcription:reverted");

    notifyTranscriptionReverted(["user-alice"], {
      transcriptionId: "transcription-3",
      byUserId: "user-bob",
      byName: "Bob",
    });

    await waitFor(() => forAlice.length > 0, { label: "revert for alice" });
    expect(forAlice[0].transcriptionId).toBe("transcription-3");
    expect(forEve).toHaveLength(0);
  });
});
