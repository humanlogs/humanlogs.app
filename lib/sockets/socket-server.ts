import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";
import { verifySocketAuth } from "./socket-auth";

let io: SocketIOServer | null = null;

// Store Y.js documents for each transcription
// Map<transcriptionId, Y.Doc>
const yjsDocuments = new Map<string, Y.Doc>();

// Store awareness states for each transcription
// Map<transcriptionId, Awareness>
const yjsAwareness = new Map<string, awarenessProtocol.Awareness>();

// Track the current editor (leader) for each transcription
// Map<transcriptionId, { userId: string; userName: string; socketId: string; timestamp: number }>
const transcriptionLeaders = new Map<
  string,
  { userId: string; userName: string; socketId: string; timestamp: number }
>();

// ---------------------------------------------------------------------------
// Blind Yjs relay (collab v2)
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
    // Collab seed / full-state syncs carry the whole Yjs doc (base64), which can be
    // several MB for a long transcript. The default 1MB cap silently rejects those
    // packets and drops the socket, so raise it well above realistic doc sizes.
    maxHttpBufferSize: 1e8, // 100 MB
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "https://humanlogs.app",
      credentials: true,
    },
  });

  io.on("connection", async (socket) => {
    log("Client connected:", socket.id);

    // Verify authentication and extract user info
    const authResult = await verifySocketAuth(socket);

    if (!authResult) {
      log("Unauthorized connection attempt, disconnecting:", socket.id);
      socket.emit("error", { message: "Authentication required" });
      socket.disconnect();
      return;
    }

    const { userId, email } = authResult;
    log(`Authenticated user: ${userId} (${email})`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle joining a transcription room
    socket.on("transcription:join", (transcriptionId: string) => {
      socket.join(`transcription:${transcriptionId}`);
      log(`Socket ${socket.id} joined transcription room: ${transcriptionId}`);

      // Send current leader info to the joining user
      const currentLeader = transcriptionLeaders.get(transcriptionId);
      if (currentLeader) {
        socket.emit("transcription:leader-changed", {
          transcriptionId,
          leader: currentLeader,
        });
      }

      // Notify others in the room that a user joined
      socket
        .to(`transcription:${transcriptionId}`)
        .emit("transcription:user-joined", {
          userId,
          socketId: socket.id,
        });
    });

    // Handle leaving a transcription room
    socket.on("transcription:leave", (transcriptionId: string) => {
      socket.leave(`transcription:${transcriptionId}`);
      log(`Socket ${socket.id} left transcription room: ${transcriptionId}`);

      // Release leadership if this user was the leader
      const currentLeader = transcriptionLeaders.get(transcriptionId);
      if (currentLeader?.socketId === socket.id) {
        transcriptionLeaders.delete(transcriptionId);
        // Notify all users that leadership was released
        io?.to(`transcription:${transcriptionId}`).emit(
          "transcription:leader-changed",
          {
            transcriptionId,
            leader: null,
          },
        );
      }

      // Notify others in the room that a user left
      socket
        .to(`transcription:${transcriptionId}`)
        .emit("transcription:user-left", {
          userId,
          socketId: socket.id,
        });
    });

    // Handle claiming leadership
    socket.on(
      "transcription:claim-leader",
      (data: { transcriptionId: string; userId: string; userName: string }) => {
        const currentLeader = transcriptionLeaders.get(data.transcriptionId);
        const now = Date.now();
        const STALE_THRESHOLD = 30000; // 30 seconds

        // Grant leadership if no current leader or current leader is stale
        if (!currentLeader || now - currentLeader.timestamp > STALE_THRESHOLD) {
          const newLeader = {
            userId: data.userId,
            userName: data.userName,
            socketId: socket.id,
            timestamp: now,
          };
          transcriptionLeaders.set(data.transcriptionId, newLeader);

          // Notify all users in the room about the new leader
          io?.to(`transcription:${data.transcriptionId}`).emit(
            "transcription:leader-changed",
            {
              transcriptionId: data.transcriptionId,
              leader: newLeader,
            },
          );

          // Confirm to the requester that they are now the leader
          socket.emit("transcription:leader-granted", {
            transcriptionId: data.transcriptionId,
          });
        } else {
          // Deny leadership - someone else is already the leader
          socket.emit("transcription:leader-denied", {
            transcriptionId: data.transcriptionId,
            currentLeader,
          });
        }
      },
    );

    // Handle releasing leadership
    socket.on(
      "transcription:release-leader",
      (data: { transcriptionId: string }) => {
        const currentLeader = transcriptionLeaders.get(data.transcriptionId);
        if (currentLeader?.socketId === socket.id) {
          transcriptionLeaders.delete(data.transcriptionId);
          // Notify all users that leadership was released
          io?.to(`transcription:${data.transcriptionId}`).emit(
            "transcription:leader-changed",
            {
              transcriptionId: data.transcriptionId,
              leader: null,
            },
          );
        }
      },
    );

    // Handle leader keepalive
    socket.on(
      "transcription:leader-keepalive",
      (data: { transcriptionId: string }) => {
        const currentLeader = transcriptionLeaders.get(data.transcriptionId);
        if (currentLeader?.socketId === socket.id) {
          currentLeader.timestamp = Date.now();
          transcriptionLeaders.set(data.transcriptionId, currentLeader);
        }
      },
    );

    // Handle cursor position updates
    socket.on(
      "transcription:cursor-update",
      (data: { transcriptionId: string; position: CursorPosition }) => {
        // Broadcast cursor position to all other users in the room
        socket
          .to(`transcription:${data.transcriptionId}`)
          .emit("transcription:cursor-position", {
            socketId: socket.id,
            ...data.position,
          });
      },
    );

    // -----------------------------------------------------------------------
    // Blind Yjs relay (collab v2) — opaque payloads, seeding-authority coord.
    // -----------------------------------------------------------------------
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
      log(
        `[Y.js relay] ${socket.id} joined ${transcriptionId} as ${
          room.authority === socket.id ? "seed" : "sync"
        }`,
      );
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
    // Gating by the clear `t` tag + per-transcription write/read access lands in
    // Stage 3; here we only relay.
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

    // Handle Y.js sync request
    socket.on(
      "yjs:sync-request",
      (data: { transcriptionId: string; stateVector: number[] }) => {
        const transcriptionId = data.transcriptionId;
        log(
          `[Y.js Server] Sync request from ${socket.id} for ${transcriptionId}`,
        );

        // Get or create Y.js document for this transcription
        let doc = yjsDocuments.get(transcriptionId);
        if (!doc) {
          doc = new Y.Doc();
          yjsDocuments.set(transcriptionId, doc);
          log(`[Y.js Server] Created new document for ${transcriptionId}`);
        } else {
          log(`[Y.js Server] Using existing document for ${transcriptionId}`);
        }

        // Get or create awareness for this transcription
        let awareness = yjsAwareness.get(transcriptionId);
        if (!awareness) {
          awareness = new awarenessProtocol.Awareness(doc);
          yjsAwareness.set(transcriptionId, awareness);
        }

        // Send state update to the requesting client
        const stateVector = new Uint8Array(data.stateVector);
        const update = Y.encodeStateAsUpdate(doc, stateVector);
        log(`[Y.js Server] Sending ${update.length} bytes to ${socket.id}`);

        socket.emit(`yjs:sync:${transcriptionId}`, update.buffer);
        socket.emit(`yjs:synced:${transcriptionId}`);
        log(`[Y.js Server] Sent sync response to ${socket.id}`);
      },
    );

    // Handle Y.js document updates
    socket.on(
      "yjs:update",
      (data: { transcriptionId: string; update: number[] }) => {
        const transcriptionId = data.transcriptionId;
        log(
          `[Y.js Server] Received update from ${socket.id} for ${transcriptionId}: ${data.update.length} bytes`,
        );

        // Get or create document
        let doc = yjsDocuments.get(transcriptionId);
        if (!doc) {
          doc = new Y.Doc();
          yjsDocuments.set(transcriptionId, doc);
          log(`[Y.js Server] Created new document for ${transcriptionId}`);
        }

        // Apply the update to the server's document
        const update = new Uint8Array(data.update);
        Y.applyUpdate(doc, update);
        log(
          `[Y.js Server] Applied update to server document for ${transcriptionId}`,
        );

        // Broadcast the update to all other clients in the room
        socket
          .to(`transcription:${transcriptionId}`)
          .emit(`yjs:sync:${transcriptionId}`, update.buffer);
        log(
          `[Y.js Server] Broadcasted update to other clients in ${transcriptionId}`,
        );
      },
    );

    // Handle Y.js awareness updates
    socket.on(
      "yjs:awareness",
      (data: { transcriptionId: string; update: number[] }) => {
        const transcriptionId = data.transcriptionId;

        // Get or create awareness
        let doc = yjsDocuments.get(transcriptionId);
        if (!doc) {
          doc = new Y.Doc();
          yjsDocuments.set(transcriptionId, doc);
        }

        let awareness = yjsAwareness.get(transcriptionId);
        if (!awareness) {
          awareness = new awarenessProtocol.Awareness(doc);
          yjsAwareness.set(transcriptionId, awareness);
        }

        // Apply the awareness update
        const update = new Uint8Array(data.update);
        awarenessProtocol.applyAwarenessUpdate(awareness, update, socket.id);

        // Broadcast the awareness update to all other clients
        socket
          .to(`transcription:${transcriptionId}`)
          .emit(`yjs:awareness:${transcriptionId}`, update.buffer);
      },
    );

    socket.on("disconnect", () => {
      log("Client disconnected:", socket.id);

      // Clean up blind-relay membership / reassign seeding authority.
      for (const transcriptionId of [...collabRooms.keys()]) {
        collabLeave(socket.id, transcriptionId);
      }

      // Release leadership if this user was a leader of any transcription
      for (const [transcriptionId, leader] of transcriptionLeaders.entries()) {
        if (leader.socketId === socket.id) {
          transcriptionLeaders.delete(transcriptionId);
          // Notify all users in that transcription that leadership was released
          io?.to(`transcription:${transcriptionId}`).emit(
            "transcription:leader-changed",
            {
              transcriptionId,
              leader: null,
            },
          );
        }
      }

      // Notify all rooms that this user disconnected
      // Socket.io automatically removes the socket from all rooms on disconnect
      io?.emit("transcription:user-disconnected", {
        socketId: socket.id,
      });
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
