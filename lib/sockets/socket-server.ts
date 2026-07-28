import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifySocketAuth, type SocketAuthResult } from "./socket-auth";
import { verifyRoomGrant } from "./room-grant";

let io: SocketIOServer | null = null;

// The custom server (server.ts, run by tsx) and Next-compiled API routes resolve
// this module to DIFFERENT instances, so a plain module-level `io` set by the server
// is invisible to routes calling getSocketServer() (they'd silently skip every
// notify — db:change, revert, …). Mirror the instance on globalThis, which IS shared
// across both instances in the same Node process.
const IO_GLOBAL_KEY = "__humanlogsSocketIO__";
type GlobalWithIO = typeof globalThis & {
  [IO_GLOBAL_KEY]?: SocketIOServer | null;
};
const globalWithIo = globalThis as GlobalWithIO;

// ---------------------------------------------------------------------------
// Blind Yjs relay
// ---------------------------------------------------------------------------
// The server never holds a Y.Doc and never inspects payloads (they may be E2E
// ciphertext). It only (1) relays opaque `yjs:msg` between room members and
// (2) coordinates WHICH client is the seeding authority, so a late joiner pulls
// state from a peer instead of seeding a duplicate. Content stays opaque.
type CollabRoom = { authority: string | null; members: Set<string> };
const collabRooms = new Map<string, CollabRoom>();

function collabLeave(socketId: string, transcriptionId: string) {
  const room = collabRooms.get(transcriptionId);
  if (!room) return;
  room.members.delete(socketId);
  if (room.authority === socketId) {
    // A remaining member already synced full state on join → it can serve future
    // state-requests and becomes the save leader. No re-seed needed (onSeed no-ops
    // on a non-empty doc; the client just flips to isSaver=true).
    room.authority = room.members.size ? [...room.members][0] : null;
    if (room.authority) {
      io?.to(room.authority).emit("yjs:role", {
        transcriptionId,
        role: "seed",
      });
    }
  }
  if (room.members.size === 0) collabRooms.delete(transcriptionId);
}

type CursorPosition = {
  userId: string;
  userName: string;
  startOffset: number;
  endOffset: number;
  timestamp: number;
  hasWriteAccess: boolean;
  audioTime?: number | null;
};

const log = (...args: any[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[SocketServer]", ...args);
  }
};

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    addTrailingSlash: false,
    // Collab seed / full-state syncs carry the whole Yjs doc (base64 or ciphertext),
    // which can be several MB for a long transcript. The default 1MB cap silently
    // rejects those packets and drops the socket, so raise it well above real sizes.
    maxHttpBufferSize: 1e8, // 100 MB
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "https://humanlogs.app",
      credentials: true,
    },
  });

  // Authenticate in a MIDDLEWARE, not inside the connection handler. Socket.io
  // buffers a connection's packets until its middlewares resolve, but NOT while
  // an async `connection` handler awaits: a client emits `yjs:join` the instant
  // it connects, so awaiting the token verification + user lookup there dropped
  // that packet whenever the database was slower than the round-trip — the client
  // then never received a role and its editor never seeded or synced.
  io.use(async (socket, next) => {
    const authResult = await verifySocketAuth(socket);
    if (!authResult) {
      log("Unauthorized connection attempt, rejecting:", socket.id);
      return next(new Error("Authentication required"));
    }
    socket.data.auth = authResult;
    next();
  });

  io.on("connection", (socket) => {
    const { userId, email } = socket.data.auth as SocketAuthResult;
    log(`Client connected: ${socket.id} — user ${userId} (${email})`);

    // Personal room, targeted by everything the SERVER pushes to a user rather
    // than to a document: `db:change` cache invalidation (comments, notifications,
    // transcription updates) and `transcription:reverted`. It is keyed on the
    // authenticated user id, never on anything the client sends, so a socket can
    // only ever be in its own — unlike `transcription:<id>` rooms, which are a
    // claim to be checked (see joinRoom below).
    //
    // Losing this join is silent: `io.to("user:<id>")` with no members simply
    // emits into the void, so every cache invalidation stops arriving while the
    // collaborative document keeps syncing — a comment's highlight appears live
    // (it travels in the Yjs doc) but its note, which is fetched over HTTP and
    // refreshed by `db:change`, never does.
    socket.join(`user:${userId}`);

    // Rooms this socket has JOINED, and with what rights. Authentication only
    // proves who the user is; a transcription id travels in URLs, exports and
    // emails, so it is no kind of secret — every join must present a room grant
    // for THIS user and THIS transcription (see room-grant.ts).
    //
    // The map holds the in-flight promise, not the resolved value: a client emits
    // its first document update moments after joining, and that message must wait
    // for the authorization it races rather than be dropped (a lost Yjs update
    // never comes back). Only a socket that joined — and has not left — is in here,
    // so relaying costs nothing after the first verification.
    type Membership = { canWrite: boolean };
    const memberships = new Map<string, Promise<Membership | null>>();

    // The provider instance currently holding this socket's seat in a room.
    //
    // The socket is a long-lived singleton but the provider is not: the editor
    // recreates it (React re-mounting an effect, the E2E session key resolving),
    // and the old instance says goodbye AFTER an asynchronous farewell — so its
    // `yjs:leave` reliably arrives once the new instance has already re-joined.
    // Without this, that stale goodbye evicted the live client: its membership
    // was gone, so every later message from it was dropped and it never received
    // the document. A leave is honoured only for the session that is still in.
    const joinSessions = new Map<string, string>();

    // A seat, once taken, is kept for the life of the socket (or until the client
    // leaves) — re-presenting a grant for a room already joined does not re-open
    // the question. That is deliberate and matches what the database check it
    // replaced did: it ran once per join and was cached the same way. Access
    // changes therefore land on the next connection, not mid-session.
    const joinRoom = (
      transcriptionId: string,
      grant: unknown,
    ): Promise<Membership | null> => {
      const pending = memberships.get(transcriptionId);
      if (pending) return pending;

      const authorized = verifyRoomGrant(grant, { userId, transcriptionId }).then(
        (claims) => {
          if (!claims) {
            log(`Denied ${userId} access to transcription ${transcriptionId}`);
            socket.emit("transcription:denied", { transcriptionId });
            // Forget the refusal, so a client that comes back with a valid grant
            // (it was just shared with, its grant had expired) is not stuck with
            // this answer for the life of the socket.
            memberships.delete(transcriptionId);
            return null;
          }
          return { canWrite: claims.canWrite };
        },
      );

      memberships.set(transcriptionId, authorized);
      return authorized;
    };

    /**
     * Authorize a join and make sure the seat SURVIVES it.
     *
     * Verifying a grant is asynchronous, and messages keep arriving while it is in
     * flight — including the goodbye of the provider instance this join replaces,
     * which erases the very entry `joinRoom` just registered. The join is the newer
     * intent, so it puts its seat back.
     */
    const joinRoomAndHold = async (
      transcriptionId: string,
      grant: unknown,
    ): Promise<Membership | null> => {
      const membership = await joinRoom(transcriptionId, grant);
      if (!membership) return null;
      if (!memberships.has(transcriptionId)) {
        memberships.set(transcriptionId, Promise.resolve(membership));
      }
      return membership;
    };

    /** Rights in a room this socket has joined; null if it never did, or left. */
    const membershipOf = (
      transcriptionId: string,
    ): Promise<Membership | null> =>
      memberships.get(transcriptionId) ?? Promise.resolve(null);

    // --- Presence + cursor room (drives the custom text/audio cursors) ----------
    socket.on(
      "transcription:join",
      async (data: { transcriptionId: string; grant?: string }) => {
        const { transcriptionId } = data ?? {};
        if (!transcriptionId) return;
        if (!(await joinRoomAndHold(transcriptionId, data.grant))) return;
        socket.join(`transcription:${transcriptionId}`);
        socket
          .to(`transcription:${transcriptionId}`)
          .emit("transcription:user-joined", { userId, socketId: socket.id });
      },
    );

    socket.on("transcription:leave", (transcriptionId: string) => {
      socket.leave(`transcription:${transcriptionId}`);
      memberships.delete(transcriptionId);
      socket
        .to(`transcription:${transcriptionId}`)
        .emit("transcription:user-left", { userId, socketId: socket.id });
    });

    socket.on(
      "transcription:cursor-update",
      async (data: { transcriptionId: string; position: CursorPosition }) => {
        // Presence is visible to every participant, but a cursor may not be
        // pushed into a room the sender never joined.
        if (!(await membershipOf(data.transcriptionId))) return;
        socket
          .to(`transcription:${data.transcriptionId}`)
          .emit("transcription:cursor-position", {
            socketId: socket.id,
            ...data.position,
          });
      },
    );

    // --- Blind Yjs relay — opaque payloads, seeding-authority coordination ------
    socket.on(
      "yjs:join",
      async (data: {
        transcriptionId: string;
        session?: string;
        grant?: string;
      }) => {
        const { transcriptionId } = data;
        log(`yjs:join ${transcriptionId} (session ${data.session})`);
        // Claim the seat BEFORE authorizing: a goodbye that lands while we wait
        // belongs to the instance this join replaces, and must be recognised as
        // stale by the time it arrives.
        if (data.session) joinSessions.set(transcriptionId, data.session);
        if (!(await joinRoomAndHold(transcriptionId, data.grant))) return;
        socket.join(`transcription:${transcriptionId}`);
        let room = collabRooms.get(transcriptionId);
        if (!room) {
          room = { authority: null, members: new Set() };
          collabRooms.set(transcriptionId, room);
        }
        room.members.add(socket.id);
        // First member in the room seeds; others pull state from the authority.
        // A socket that re-joins keeps the role it already holds: telling the
        // authority to "sync" would make it request state from itself.
        //
        // Every other join IS answered, re-joins included. A join is how a client
        // asks where to get the document from, and a client re-joins precisely
        // when it has nothing (a fresh provider on the same socket, a reconnect):
        // staying silent left it waiting for a document that was never coming —
        // the blank editor. Re-answering costs one duplicate state transfer,
        // which Yjs merges into a no-op.
        if (!room.authority || room.authority === socket.id) {
          room.authority = socket.id;
          log(`yjs:join ${transcriptionId} → seed (authority)`);
          socket.emit("yjs:role", { transcriptionId, role: "seed" });
        } else {
          log(`yjs:join ${transcriptionId} → sync (peer)`);
          socket.emit("yjs:role", { transcriptionId, role: "sync" });
        }
      },
    );

    // A late joiner asks for full state; route to the authority (which holds it).
    socket.on(
      "yjs:state-request",
      async (data: { transcriptionId: string }) => {
        if (!(await membershipOf(data.transcriptionId))) return;
        const room = collabRooms.get(data.transcriptionId);
        if (!room || !room.authority) {
          // No authority available — promote the requester to seed instead.
          if (room) room.authority = socket.id;
          socket.emit("yjs:role", {
            transcriptionId: data.transcriptionId,
            role: "seed",
          });
          return;
        }
        io?.to(room.authority).emit("yjs:state-request", {
          transcriptionId: data.transcriptionId,
          requester: socket.id,
        });
      },
    );

    // Authority replies with opaque full state → relay to the original requester.
    socket.on(
      "yjs:state",
      async (data: {
        transcriptionId: string;
        requester: string;
        enc: boolean;
        d: string;
      }) => {
        // Only participants may serve a room's state to a late joiner.
        if (!(await membershipOf(data.transcriptionId))) return;
        io?.to(data.requester).emit("yjs:state", {
          transcriptionId: data.transcriptionId,
          enc: data.enc,
          d: data.d,
        });
      },
    );

    // Opaque doc/awareness message → broadcast to the rest of the room.
    socket.on(
      "yjs:msg",
      async (data: {
        transcriptionId: string;
        t: "sync" | "awareness";
        enc: boolean;
        d: string;
      }) => {
        const membership = await membershipOf(data.transcriptionId);
        if (!membership) return;
        // Document changes need write access; awareness (carets) does not, so a
        // read-only participant is still visible to the others. Enforcing this
        // here is what makes the role real — the editor's read-only mode is a
        // client-side convenience an attacker simply would not run.
        if (data.t === "sync" && !membership.canWrite) return;
        socket
          .to(`transcription:${data.transcriptionId}`)
          .emit("yjs:msg", data);
      },
    );

    socket.on(
      "yjs:leave",
      (data: { transcriptionId: string; session?: string }) => {
        // A goodbye from a provider instance that has already been replaced on
        // this socket (see joinSessions) is not this client leaving the room.
        const current = joinSessions.get(data.transcriptionId);
        if (data.session && current && data.session !== current) return;
        joinSessions.delete(data.transcriptionId);
        socket.leave(`transcription:${data.transcriptionId}`);
        memberships.delete(data.transcriptionId);
        collabLeave(socket.id, data.transcriptionId);
      },
    );

    socket.on("disconnect", () => {
      log("Client disconnected:", socket.id);
      // Clean up blind-relay membership / reassign seeding authority.
      for (const transcriptionId of [...collabRooms.keys()]) {
        collabLeave(socket.id, transcriptionId);
      }
      io?.emit("transcription:user-disconnected", { socketId: socket.id });
    });
  });

  // Share across module instances (see IO_GLOBAL_KEY note) so API routes can emit.
  globalWithIo[IO_GLOBAL_KEY] = io;
  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return globalWithIo[IO_GLOBAL_KEY] ?? io;
}
