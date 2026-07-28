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

/**
 * Notify every participant that a transcription was reverted to a past version. The
 * live collaborative editor content is an in-memory Yjs doc; a DB-only revert would
 * be silently re-synced away. So every client leaves the collab room (dropping the
 * stale doc) and reloads — the fresh session then re-seeds from the reverted DB row.
 */
export function notifyTranscriptionReverted(
  userIds: string[],
  data: { transcriptionId: string; byUserId: string; byName: string },
) {
  const io = getSocketServer();
  if (!io) return;
  for (const userId of new Set(userIds)) {
    io.to(`user:${userId}`).emit("transcription:reverted", data);
  }
}
