import cron from "node-cron";
import { refillUserCredits } from "../billing/credits-refill-service";

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

  console.log("✓ Cron jobs initialized");
}
