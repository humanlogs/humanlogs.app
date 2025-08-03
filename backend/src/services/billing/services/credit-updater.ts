import _ from "lodash";
import { CtxReq } from "../../../types";
import {
  AccountsDefinition,
  AccountsType,
} from "../../account/entities/accounts";
import { stripe } from "../routes";
import Framework from "../../../platform";
import { plans } from "./stripe";

// 1 model = 600, pro model: 1000
// 1¢ = $0.0075
// costs/credit/credit_as_currency:
// Model training:
// $2 | 600¢ | $4.5
// Video generation:
// $3.20 | 450¢ | $3.40
// $6 | 800¢ | $6 (no margin)
export const plansConfigurations = {
  free: {
    monthly_credits: 50,
  },
  basic: {
    monthly_credits: 800,
  },
  essential: {
    monthly_credits: 2000,
  },
  advanced: {
    monthly_credits: 5000, // Get 6 HQ with sound videos or 8s per month, or
  },
  business: {
    monthly_credits: 20000, // Get 25 HQ with sound videos or 8s per month
  },
};

const planOrder = ["basic", "essential", "advanced", "business"];

export const isPlanBetter = (plan: string, currentPlan: string) => {
  if (!currentPlan || currentPlan === "free") return true;
  if (!plan) return false;
  if (!planOrder.includes(plan) || !planOrder.includes(currentPlan)) {
    return false; // Invalid plan comparison
  }
  return planOrder.indexOf(plan) > planOrder.indexOf(currentPlan);
};

export const getPlanForCustomerId = async (
  customerId: string
): Promise<string> => {
  // Show all subscriptions for customer cus_RJtYqlOPrSdK8m
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
  });
  const foundPlans = subscriptions.data
    .filter((a) => a.status === "active")
    .map((a) => plans[(a as any).plan.product])
    .filter(Boolean); // Filter out undefined plans

  // Return best plan
  return _.maxBy(foundPlans, (a: string) => planOrder.indexOf(a)) || "free";
};

export const renewCreditsIfNeeded = async (
  ctx: CtxReq["ctx"],
  userId: string
) => {
  const db = await Framework.Db.getService();
  const user = await db.selectOne<AccountsType>(ctx, AccountsDefinition.name, {
    id: userId,
  });
  if (!user) return;
  if (user.plan_renew_at > Date.now()) return;

  let effectivePlan = "free";

  // Only check with Stripe if the user has a Stripe ID
  if (user.stripe_id) {
    const plan = await getPlanForCustomerId(user.stripe_id);
    // Ensure we have a valid plan
    effectivePlan = plansConfigurations[plan] ? plan : "free";
  } else if (user.plan !== "free") {
    // If user has a non-free plan but no Stripe ID, use their current plan
    // This handles Apple Pay users
    effectivePlan = user.plan;
  }

  // Calculate next renewal date more accurately
  const now = new Date();
  let nextRenew = new Date(user.plan_renew_at);

  // If renewal date is in the past, set it to one month from now
  if (nextRenew.getTime() < now.getTime()) {
    nextRenew = new Date();
    nextRenew.setMonth(nextRenew.getMonth() + 1);
  } else {
    // Otherwise, just add one month to the existing renewal date
    nextRenew.setMonth(nextRenew.getMonth() + 1);
  }

  // Set to end of day
  nextRenew.setHours(23, 59, 59, 999);

  // Update credits and plan in a single operation
  await db.update<AccountsType>(
    ctx,
    AccountsDefinition.name,
    { id: user.id },
    {
      plan: effectivePlan,
      // Only set credits to the monthly amount if it's higher than current credits
      credits: Math.max(
        user.credits,
        plansConfigurations[effectivePlan].monthly_credits
      ),
      plan_renew_at: nextRenew.getTime(),
    }
  );
};
