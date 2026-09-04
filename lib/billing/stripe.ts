import Stripe from "stripe";
import config from "config";

export function isStripeConfigured(): boolean {
  return (
    config.has("stripe.secretKey") &&
    !!config.get<string>("stripe.secretKey") &&
    config.has("stripe.prices.monthlySubscription") &&
    config.has("stripe.prices.yearlySubscription") &&
    config.has("stripe.prices.oneTimeCredits")
  );
}

/**
 * Check if this is a billable version of the app.
 * When false, credits are not deducted and billing features are disabled.
 */
export function isBillableVersion(): boolean {
  return isStripeConfigured();
}

let stripeInstance: Stripe | null = null;

export const getStripe = (): Stripe => {
  if (!stripeInstance) {
    if (!isStripeConfigured()) {
      throw new Error("Stripe is not configured");
    }
    stripeInstance = new Stripe(config.get<string>("stripe.secretKey"), {
      apiVersion: "2026-03-25.dahlia",
      typescript: true,
    });
  }
  return stripeInstance;
};

// For backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get: (target, prop) => {
    const stripeObj = getStripe();
    return stripeObj[prop as keyof Stripe];
  },
});

export const PLANS = {
  FREE: {
    id: "free",
    name: "Free",
    creditsRefill: 100, // 100 minutes per month
    price: 0,
  },
  MONTHLY: {
    id: "monthly",
    name: "Pro Monthly",
    creditsRefill: 1200, // 20 hours = 1200 minutes
    price: 15,
    priceId: config.get<string>("stripe.prices.monthlySubscription"),
  },
  YEARLY: {
    id: "yearly",
    name: "Pro Yearly",
    creditsRefill: 1200, // 20 hours = 1200 minutes per month
    price: 165, // 13.75 * 12 months
    pricePerMonth: 13.75,
    priceId: config.get<string>("stripe.prices.yearlySubscription"),
  },
  ONE_TIME: {
    id: "one-time",
    name: "One-Time Purchase",
    credits: 1200, // 20 hours = 1200 minutes
    price: 20,
    priceId: config.get<string>("stripe.prices.oneTimeCredits"),
  },
} as const;

export type PlanId = keyof typeof PLANS;

/**
 * Read the subscription id an invoice was generated from.
 *
 * Stripe moved this in API version `2025-04-30.basil`: the top-level
 * `invoice.subscription` became `invoice.parent.subscription_details.subscription`.
 * Webhook payloads are rendered at the API version pinned on the *endpoint* in
 * the Stripe dashboard, which is not necessarily the one this SDK requests with,
 * so both shapes can arrive at the same deployment. Read whichever is present —
 * getting this wrong silently reclassifies every subscription invoice as a
 * one-off and skips the credit grant that pays for the plan.
 */
export function getInvoiceSubscriptionId(
  invoice: Stripe.Invoice,
): string | null {
  const parent = (invoice as any).parent;
  const fromParent = parent?.subscription_details?.subscription;
  if (fromParent) {
    return typeof fromParent === "string" ? fromParent : fromParent.id;
  }

  // Pre-Basil payload.
  const legacy = (invoice as any).subscription;
  if (legacy) {
    return typeof legacy === "string" ? legacy : legacy.id;
  }

  return null;
}

/**
 * Read the end of a subscription's current billing period.
 *
 * Also moved in `2025-04-30.basil` — from the subscription down onto each
 * subscription item. Items on one subscription share a period here (the app
 * only ever creates single-item subscriptions), so the first item is the
 * period. Falls back to the pre-Basil top-level field.
 */
export function getSubscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): Date | null {
  const fromItem = subscription.items?.data?.[0]?.current_period_end;
  if (typeof fromItem === "number") {
    return new Date(fromItem * 1000);
  }

  const legacy = (subscription as any).current_period_end;
  if (typeof legacy === "number") {
    return new Date(legacy * 1000);
  }

  return null;
}

/** Map a Stripe price id onto the plan it sells and the credits it grants. */
export function planForPriceId(priceId: string | undefined): {
  plan: string;
  creditsRefill: number;
} {
  if (priceId && priceId === PLANS.MONTHLY.priceId) {
    return { plan: PLANS.MONTHLY.id, creditsRefill: PLANS.MONTHLY.creditsRefill };
  }
  if (priceId && priceId === PLANS.YEARLY.priceId) {
    return { plan: PLANS.YEARLY.id, creditsRefill: PLANS.YEARLY.creditsRefill };
  }
  return { plan: PLANS.FREE.id, creditsRefill: PLANS.FREE.creditsRefill };
}

export function getPlanDetails(planId: string) {
  const normalizedId = planId.toUpperCase() as Uppercase<string>;
  if (normalizedId in PLANS) {
    return PLANS[normalizedId as keyof typeof PLANS];
  }
  return PLANS.FREE;
}

export async function createCheckoutSession({
  customerId,
  priceId,
  mode,
  quantity = 1,
  successUrl,
  cancelUrl,
  allowPromotionCodes = true,
  metadata,
}: {
  customerId?: string;
  priceId: string;
  mode: "subscription" | "payment";
  quantity?: number;
  successUrl: string;
  cancelUrl: string;
  allowPromotionCodes?: boolean;
  metadata?: Record<string, string>;
}) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode,
    line_items: [
      {
        price: priceId,
        quantity,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: allowPromotionCodes,
    metadata,
  });

  return session;
}

export async function createCustomer(email: string, name?: string) {
  const customer = await stripe.customers.create({
    email,
    name: name || undefined,
  });

  return customer;
}

export async function cancelSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.cancel(subscriptionId);
  return subscription;
}

export async function getSubscription(subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscription;
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string,
) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
