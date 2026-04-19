import cron from "node-cron";
import { refillUserCredits } from "../billing/credits-refill-service";
import { processMarketingEmails } from "../email/marketing-email-service";

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

  console.log("✓ Cron jobs initialized");
}
