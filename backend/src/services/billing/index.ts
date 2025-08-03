import { Express } from "express";
import { registerBillingRoutes } from "./routes";
import Framework from "../../platform";
import { AccountsDefinition, AccountsType } from "../account/entities/accounts";
import { renewCreditsIfNeeded } from "./services/credit-updater";

export const initBilling = async (app: Express) => {
  Framework.Cron.schedule("renew-credits", "0 1 * * *", async (ctx) => {
    const db = await Framework.Db.getService();
    // Look for all user that need to renew their credits
    const users = await db.select<AccountsType>(ctx, AccountsDefinition.name, {
      where: "plan_renew_at < $1 and plan != '' and plan is not null",
      values: [Date.now()],
    });
    for (const user of users) {
      await renewCreditsIfNeeded(ctx, user.id);
    }
  });

  await registerBillingRoutes(app);
};
