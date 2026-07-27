import cron from "node-cron";
import { refillUserCredits } from "../billing/credits-refill-service";
import { processMarketingEmails } from "../email/marketing-email-service";
import { cleanupStaleTranscriptions } from "./stale-transcription-cleanup";
import { purgeExpiredDeletedAccounts } from "../billing/deleted-account-credits";

export function initializeCronJobs() {
  // Run credits refill daily at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    console.log("[CRON] Running credits refill job...");
    try {
      const result = await refillUserCredits();
      console.log("[CRON] Credits refill completed:", result);
    } catch (error) {
      console.error("[CRON] Error during credits refill:", error);
    }
  });

  // Run marketing email processing daily at 10:00 AM
  cron.schedule("0 10 * * *", async () => {
    console.log("[CRON] Running marketing email job...");
    try {
      const result = await processMarketingEmails();
      console.log("[CRON] Marketing email processing completed:", result);
    } catch (error) {
      console.error("[CRON] Error during marketing email processing:", error);
    }
  });

  // Remove transcriptions stuck in PENDING/ERROR for >24h, hourly.
  cron.schedule("0 * * * *", async () => {
    console.log("[CRON] Running stale transcription cleanup...");
    try {
      const result = await cleanupStaleTranscriptions();
      console.log("[CRON] Stale transcription cleanup completed:", result);
    } catch (error) {
      console.error("[CRON] Error during stale transcription cleanup:", error);
    }
  });

  // Forget deleted-account credit records past the retention window, weekly.
  cron.schedule("30 3 * * 0", async () => {
    console.log("[CRON] Running deleted account purge...");
    try {
      const result = await purgeExpiredDeletedAccounts();
      console.log("[CRON] Deleted account purge completed:", result);
    } catch (error) {
      console.error("[CRON] Error during deleted account purge:", error);
    }
  });

  console.log("✓ Cron jobs initialized");
}
