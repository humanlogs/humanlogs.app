import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | null = null;

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

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

// Emit database change events
export function emitDatabaseChange(
  userId: string,
  table: string,
  operation: "create" | "update" | "delete",
  data?: unknown,
) {
  if (!io) {
    console.warn("Socket.io server not initialized");
    return;
  }

  const event = {
    table,
    operation,
    timestamp: new Date().toISOString(),
    data,
  };

  // Emit to user-specific room
  io.to(`user:${userId}`).emit("db:change", event);
  console.log(`Emitted db:change to user:${userId}`, event);
}
