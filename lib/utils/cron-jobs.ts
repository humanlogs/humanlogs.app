import cron from "node-cron";
import { refillUserCredits } from "../billing/credits-refill-service";
import { processMarketingEmails } from "../email/marketing-email-service";
import { cleanupStaleTranscriptions } from "./stale-transcription-cleanup";
import { purgeExpiredDeletedAccounts } from "../billing/deleted-account-credits";
import { captureError } from "../observability/sentry";

/**
 * Run a scheduled job, logging its outcome and reporting a failure.
 *
 * Cron work has nobody watching it: a job that throws every night leaves only a
 * line in the container log, which is exactly the class of silent failure
 * error reporting exists for. The catch is what keeps one failing job from
 * taking down the scheduler.
 */
function scheduled(
  name: string,
  expression: string,
  run: () => Promise<unknown>,
): void {
  cron.schedule(expression, async () => {
    console.log(`[CRON] Running ${name}...`);
    try {
      const result = await run();
      console.log(`[CRON] ${name} completed:`, result);
    } catch (error) {
      console.error(`[CRON] Error during ${name}:`, error);
      captureError(error, { stage: "cron", job: name });
    }
  });
}

export function initializeCronJobs() {
  // Run credits refill daily at 2:00 AM
  scheduled("credits refill", "0 2 * * *", refillUserCredits);

  // Run marketing email processing daily at 10:00 AM
  scheduled("marketing email processing", "0 10 * * *", processMarketingEmails);

  // Remove transcriptions stuck in PENDING/ERROR for >24h, hourly.
  scheduled(
    "stale transcription cleanup",
    "0 * * * *",
    cleanupStaleTranscriptions,
  );

  // Forget deleted-account credit records past the retention window, weekly.
  scheduled("deleted account purge", "30 3 * * 0", purgeExpiredDeletedAccounts);

  console.log("✓ Cron jobs initialized");
}
