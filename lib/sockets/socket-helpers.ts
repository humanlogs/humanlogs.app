import { getSocketServer } from "./socket-server";

/**
 * Helper to emit database changes to connected clients.
 * Call this from API routes AFTER database operations.
 *
 * Example:
 *   const transcription = await prisma.transcription.create({ ... });
 *   notifyDatabaseChange(user.id, "transcription", "create", { id: transcription.id });
 */
export function notifyDatabaseChange(
  userId: string,
  table: string,
  operation: "create" | "update" | "delete",
  data?: unknown,
) {
  const io = getSocketServer();

  if (!io) {
    // In development, this might happen if module loads before server initializes
    // In production, this should never happen
    console.warn("[Socket] Server not initialized, skipping notification");
    return;
  }

  const event = {
    table,
    operation,
    timestamp: new Date().toISOString(),
    data,
  };

  io.to(`user:${userId}`).emit("db:change", event);
  console.log(`[Socket] Emitted db:change to user:${userId}`, event);
}
