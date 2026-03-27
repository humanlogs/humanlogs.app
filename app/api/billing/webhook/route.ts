import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import config from "config";
import { stripe, PLANS } from "@/lib/stripe";
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Only process recurring subscription payments
        if ((invoice as any).subscription) {
          await handleInvoicePaymentSucceeded(invoice);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
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
    console.error("No customer ID in checkout session");
    return;
  }

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("User not found for customer:", customerId);
    return;
  }

  // Handle one-time payment
  if (session.mode === "payment") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: user.credits + PLANS.ONE_TIME.credits,
      },
    });
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("User not found for customer:", customerId);
    return;
  }

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

  const currentPeriodEnd = (subscription as any).current_period_end
    ? new Date((subscription as any).current_period_end * 1000)
    : null;

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
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("User not found for customer:", customerId);
    return;
  }

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
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error("User not found for customer:", customerId);
    return;
  }

  // Refill credits on successful subscription payment
  // Only refill if credits are below the refill amount
  if (user.credits < user.creditsRefill) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: user.creditsRefill,
        lastCreditsRefill: new Date(),
      },
    });
  }
}
