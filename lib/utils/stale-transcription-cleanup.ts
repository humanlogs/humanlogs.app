import { prisma } from "../prisma";
import { getStorage } from "../storage";
import { notifyDatabaseChange } from "../sockets/socket-helpers";

// Transcriptions stuck in PENDING or ERROR for longer than this are considered
// dead (the STT job never completed or failed) and are removed automatically.
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Delete transcriptions that have been PENDING or ERROR for more than 24h,
 * along with their history and stored audio file. Tutorial transcriptions are
 * never touched. Meant to be run periodically from the cron scheduler.
 */
export async function cleanupStaleTranscriptions(): Promise<{
  deleted: number;
}> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

  const stale = await prisma.transcription.findMany({
    where: {
      state: { in: ["PENDING", "ERROR"] },
      updatedAt: { lt: cutoff },
      isTutorial: false,
    },
    select: { id: true, userId: true, audioFileKey: true },
  });

  if (stale.length === 0) {
    return { deleted: 0 };
  }

  const storage = getStorage();
  let deleted = 0;

  for (const t of stale) {
    try {
      await prisma.transcriptionHistory.deleteMany({
        where: { transcriptionId: t.id },
      });

      // Remove the stored audio (skip bundled tutorial assets, which are shared).
      if (t.audioFileKey && !t.audioFileKey.startsWith("tutorial:")) {
        try {
          await storage.delete(t.audioFileKey);
        } catch (error) {
          // Missing/already-removed file shouldn't block the DB cleanup.
          console.error(
            `[CLEANUP] Failed to delete audio for ${t.id}:`,
            error,
          );
        }
      }

      await prisma.transcription.delete({ where: { id: t.id } });
      notifyDatabaseChange(t.userId, "transcription", "delete", { id: t.id });
      deleted++;
    } catch (error) {
      console.error(`[CLEANUP] Failed to delete transcription ${t.id}:`, error);
    }
  }

  return { deleted };
}
