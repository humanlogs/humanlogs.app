import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

// Track the current editor (leader) for each transcription
// Map<transcriptionId, { userId: string; userName: string; socketId: string; timestamp: number }>
const transcriptionLeaders = new Map<
  string,
  { userId: string; userName: string; socketId: string; timestamp: number }
>();

type CursorPosition = {
  userId: string;
  userName: string;
  startOffset: number;
  endOffset: number;
  timestamp: number;
  hasWriteAccess: boolean;
};

export function initSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", async (socket) => {
    console.log("Client connected:", socket.id);

    // TODO: In production, verify JWT token sent from client
    // For now, client will send userId via handshake query
    const userId = socket.handshake.query.userId as string | undefined;

    if (userId) {
      // Join user-specific room
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined their room`);
    }

    // Handle joining a transcription room
    socket.on("transcription:join", (transcriptionId: string) => {
      socket.join(`transcription:${transcriptionId}`);
      console.log(
        `Socket ${socket.id} joined transcription room: ${transcriptionId}`,
      );

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
      console.log(
        `Socket ${socket.id} left transcription room: ${transcriptionId}`,
      );

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

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);

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
