import { captureError } from "@/lib/observability/sentry";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import config from "config";
import {
  stripe,
  PLANS,
  getInvoiceSubscriptionId,
  getSubscriptionPeriodEnd,
  planForPriceId,
} from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const webhookSecret = config.get<string>("stripe.webhookSecret");

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = (await headers()).get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "No signature provided" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    console.log(`[WEBHOOK] Received event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(
          `[WEBHOOK] Processing checkout.session.completed - Session ID: ${session.id}, Customer: ${session.customer}, Mode: ${session.mode}`,
        );
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(
          `[WEBHOOK] Processing ${event.type} - Subscription ID: ${subscription.id}, Customer: ${subscription.customer}, Status: ${subscription.status}`,
        );
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(
          `[WEBHOOK] Processing customer.subscription.deleted - Subscription ID: ${subscription.id}, Customer: ${subscription.customer}`,
        );
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getInvoiceSubscriptionId(invoice);
        console.log(
          `[WEBHOOK] Processing invoice.payment_succeeded - Invoice ID: ${invoice.id}, Customer: ${invoice.customer}, Subscription: ${subscriptionId}`,
        );
        // Only process recurring subscription payments
        if (subscriptionId) {
          await handleInvoicePaymentSucceeded(invoice, subscriptionId);
        } else {
          console.log(
            `[WEBHOOK] Skipping invoice - not a subscription payment`,
          );
        }
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Billing failures are the ones nobody notices until a customer writes in —
    // a dropped subscription event means someone paid and got nothing.
    captureError(error, {
      stage: "webhook",
      job: `stripe:${event.type}`,
      httpStatus: 500,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  const customerId = session.customer as string;

  if (!customerId) {
    console.error("[WEBHOOK] No customer ID in checkout session");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("[WEBHOOK] User not found for customer:", customerId);
    return;
  }

  console.log(
    `[WEBHOOK] Found user: ${user.id} (${user.email}), current credits: ${user.credits}`,
  );

  // Handle one-time payment
  if (session.mode === "payment") {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 1,
    });
    const quantity = lineItems.data[0]?.quantity ?? 1;
    const creditsToAdd = PLANS.ONE_TIME.credits * quantity;
    const newCredits = user.credits + creditsToAdd;
    console.log(
      `[WEBHOOK] One-time payment - quantity ${quantity}, adding ${creditsToAdd} credits (${user.credits} -> ${newCredits})`,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: newCredits,
        lastPaymentAt: new Date(),
      },
    });
    console.log(`[WEBHOOK] Credits updated successfully`);
  } else {
    console.log(
      `[WEBHOOK] Session mode is "${session.mode}" - not a one-time payment, skipping credit addition`,
    );
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("[WEBHOOK] User not found for customer:", customerId);
    return;
  }

  console.log(
    `[WEBHOOK] Found user: ${user.id} (${user.email}), current plan: ${user.plan}, credits: ${user.credits}`,
  );

  // Determine plan based on subscription price
  const priceId = subscription.items.data[0]?.price.id;
  const { plan, creditsRefill } = planForPriceId(priceId);

  console.log(
    `[WEBHOOK] Subscription price ID: ${priceId}, detected plan: ${plan}, creditsRefill: ${creditsRefill}`,
  );

  const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);

  console.log(
    `[WEBHOOK] Updating user subscription - plan: ${plan}, status: ${subscription.status}, periodEnd: ${currentPeriodEnd}`,
  );

  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  // Grant the plan's credits as soon as the subscription starts, rather than
  // waiting for `invoice.payment_succeeded` alone. A new subscriber who is
  // still holding their free-tier balance would otherwise pay for a plan and
  // keep the old allowance until the nightly refill cron caught up.
  //
  // Gated on the plan actually changing, so the routine `customer.subscription.updated`
  // events (card updates, period rollovers, status changes) cannot top a
  // subscriber back up mid-cycle after they have spent their credits.
  const isNewPaidPlan = isActive && plan !== "free" && user.plan !== plan;
  const creditTarget = creditsRefill + user.referralBonusCredits;
  const shouldGrantCredits = isNewPaidPlan && user.credits < creditTarget;

  if (shouldGrantCredits) {
    console.log(
      `[WEBHOOK] New ${plan} subscription - granting credits: ${user.credits} -> ${creditTarget}`,
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd: currentPeriodEnd,
      plan,
      creditsRefill,
      ...(shouldGrantCredits
        ? { credits: creditTarget, lastCreditsRefill: new Date() }
        : {}),
      // A subscription only reaches an active/trialing state once payment has
      // gone through, so treat this as the user's latest payment moment.
      ...(isActive ? { lastPaymentAt: new Date() } : {}),
    },
  });

  console.log(`[WEBHOOK] Subscription updated successfully`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("[WEBHOOK] User not found for customer:", customerId);
    return;
  }

  console.log(
    `[WEBHOOK] Deleting subscription for user: ${user.id} (${user.email})`,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionPeriodEnd: null,
      plan: "free",
      creditsRefill: PLANS.FREE.creditsRefill,
    },
  });

  console.log(`[WEBHOOK] Subscription deleted successfully`);
}

async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  subscriptionId: string,
) {
  const customerId = invoice.customer as string;

  // Fetch subscription details to get the current plan info
  let subscription: Stripe.Subscription | null = null;
  if (subscriptionId) {
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log(
        `[WEBHOOK] Retrieved subscription: ${subscription.id}, status: ${subscription.status}`,
      );
    } catch (error) {
      console.error("[WEBHOOK] Failed to retrieve subscription:", error);
    }
  }

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("[WEBHOOK] User not found for customer:", customerId);
    return;
  }

  console.log(
    `[WEBHOOK] Found user: ${user.id} (${user.email}), current credits: ${user.credits}, creditsRefill: ${user.creditsRefill}`,
  );

  // Determine creditsRefill from subscription if available (handles race condition)
  let creditsRefill = user.creditsRefill;
  if (subscription) {
    const priceId = subscription.items.data[0]?.price.id;
    const forPrice = planForPriceId(priceId);
    if (forPrice.plan !== PLANS.FREE.id) {
      creditsRefill = forPrice.creditsRefill;
    }
    console.log(
      `[WEBHOOK] Subscription price ID: ${priceId}, calculated creditsRefill: ${creditsRefill}`,
    );
  }

  // A successful invoice always marks a payment, even when credits are already
  // topped up and don't need refilling.
  const now = new Date();

  // Subscribers get their plan allotment plus any referral bonus — the same
  // target the nightly refill cron uses, so a renewal through either path lands
  // a referrer on the same balance.
  const creditTarget = creditsRefill + user.referralBonusCredits;

  // Refill credits on successful subscription payment
  // Only refill if credits are below the target amount
  if (user.credits < creditTarget) {
    console.log(
      `[WEBHOOK] Refilling credits: ${user.credits} -> ${creditTarget}`,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: creditTarget,
        lastCreditsRefill: now,
        lastPaymentAt: now,
      },
    });
    console.log(`[WEBHOOK] Credits refilled successfully`);
  } else {
    console.log(
      `[WEBHOOK] Credits not refilled - user already has ${user.credits} credits (target: ${creditTarget})`,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: { lastPaymentAt: now },
    });
  }
}
