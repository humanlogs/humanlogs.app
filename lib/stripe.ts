import Stripe from "stripe";
import config from "config";

if (
  !config.has("stripe.secretKey") ||
  !config.get<string>("stripe.secretKey")
) {
  throw new Error("Stripe secret key is not configured");
}

export const stripe = new Stripe(config.get<string>("stripe.secretKey"), {
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
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
  successUrl,
  cancelUrl,
}: {
  customerId?: string;
  priceId: string;
  mode: "subscription" | "payment";
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
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
