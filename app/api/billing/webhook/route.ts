import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import config from "config";
import { stripe, PLANS } from "@/lib/billing/stripe";
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
        console.log(
          `[WEBHOOK] Processing invoice.payment_succeeded - Invoice ID: ${invoice.id}, Customer: ${invoice.customer}, Subscription: ${(invoice as any).subscription}`,
        );
        // Only process recurring subscription payments
        if ((invoice as any).subscription) {
          await handleInvoicePaymentSucceeded(invoice);
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
  let plan = "free";
  let creditsRefill = 100;

  if (priceId === PLANS.MONTHLY.priceId) {
    plan = "monthly";
    creditsRefill = PLANS.MONTHLY.creditsRefill;
  } else if (priceId === PLANS.YEARLY.priceId) {
    plan = "yearly";
    creditsRefill = PLANS.YEARLY.creditsRefill;
  }

  console.log(
    `[WEBHOOK] Subscription price ID: ${priceId}, detected plan: ${plan}, creditsRefill: ${creditsRefill}`,
  );

  const currentPeriodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000)
    : null;

  console.log(
    `[WEBHOOK] Updating user subscription - plan: ${plan}, status: ${subscription.status}, periodEnd: ${currentPeriodEnd}`,
  );

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd: currentPeriodEnd,
      plan,
      creditsRefill,
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

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string;

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
    if (priceId === PLANS.MONTHLY.priceId) {
      creditsRefill = PLANS.MONTHLY.creditsRefill;
    } else if (priceId === PLANS.YEARLY.priceId) {
      creditsRefill = PLANS.YEARLY.creditsRefill;
    }
    console.log(
      `[WEBHOOK] Subscription price ID: ${priceId}, calculated creditsRefill: ${creditsRefill}`,
    );
  }

  // Refill credits on successful subscription payment
  // Only refill if credits are below the refill amount
  if (user.credits < creditsRefill) {
    console.log(
      `[WEBHOOK] Refilling credits: ${user.credits} -> ${creditsRefill}`,
    );
    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: creditsRefill,
        lastCreditsRefill: new Date(),
      },
    });
    console.log(`[WEBHOOK] Credits refilled successfully`);
  } else {
    console.log(
      `[WEBHOOK] Credits not refilled - user already has ${user.credits} credits (refill amount: ${creditsRefill})`,
    );
  }
}
