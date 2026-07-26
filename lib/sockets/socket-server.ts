import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifySocketAuth, type SocketAuthResult } from "./socket-auth";

let io: SocketIOServer | null = null;

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

    // Join user-specific room (targeted by db:change cache-invalidation events)
    socket.join(`user:${userId}`);

    // --- Presence + cursor room (drives the custom text/audio cursors) ----------
    socket.on("transcription:join", (transcriptionId: string) => {
      socket.join(`transcription:${transcriptionId}`);
      socket
        .to(`transcription:${transcriptionId}`)
        .emit("transcription:user-joined", { userId, socketId: socket.id });
    });

    socket.on("transcription:leave", (transcriptionId: string) => {
      socket.leave(`transcription:${transcriptionId}`);
      socket
        .to(`transcription:${transcriptionId}`)
        .emit("transcription:user-left", { userId, socketId: socket.id });
    });

    socket.on(
      "transcription:cursor-update",
      (data: { transcriptionId: string; position: CursorPosition }) => {
        socket
          .to(`transcription:${data.transcriptionId}`)
          .emit("transcription:cursor-position", {
            socketId: socket.id,
            ...data.position,
          });
      },
    );

    // --- Blind Yjs relay — opaque payloads, seeding-authority coordination ------
    socket.on("yjs:join", (data: { transcriptionId: string }) => {
      const { transcriptionId } = data;
      socket.join(`transcription:${transcriptionId}`);
      let room = collabRooms.get(transcriptionId);
      if (!room) {
        room = { authority: null, members: new Set() };
        collabRooms.set(transcriptionId, room);
      }
      room.members.add(socket.id);
      // First member in the room seeds; others pull state from the authority.
      if (!room.authority) {
        room.authority = socket.id;
        socket.emit("yjs:role", { transcriptionId, role: "seed" });
      } else {
        socket.emit("yjs:role", { transcriptionId, role: "sync" });
      }
    });

    // A late joiner asks for full state; route to the authority (which holds it).
    socket.on("yjs:state-request", (data: { transcriptionId: string }) => {
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
    });

    // Authority replies with opaque full state → relay to the original requester.
    socket.on(
      "yjs:state",
      (data: {
        transcriptionId: string;
        requester: string;
        enc: boolean;
        d: string;
      }) => {
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
      (data: {
        transcriptionId: string;
        t: "sync" | "awareness";
        enc: boolean;
        d: string;
      }) => {
        socket.to(`transcription:${data.transcriptionId}`).emit("yjs:msg", data);
      },
    );

    socket.on("yjs:leave", (data: { transcriptionId: string }) => {
      socket.leave(`transcription:${data.transcriptionId}`);
      collabLeave(socket.id, data.transcriptionId);
    });

    socket.on("disconnect", () => {
      log("Client disconnected:", socket.id);
      // Clean up blind-relay membership / reassign seeding authority.
      for (const transcriptionId of [...collabRooms.keys()]) {
        collabLeave(socket.id, transcriptionId);
      }
      io?.emit("transcription:user-disconnected", { socketId: socket.id });
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
