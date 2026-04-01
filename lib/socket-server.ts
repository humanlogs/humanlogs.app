import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

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

      // Notify others in the room that a user left
      socket
        .to(`transcription:${transcriptionId}`)
        .emit("transcription:user-left", {
          userId,
          socketId: socket.id,
        });
    });

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
