import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createCheckoutSession,
  createCustomer,
  PLANS,
  isStripeConfigured,
} from "@/lib/stripe";
import { withAuthRateLimit } from "@/lib/rate-limit-middleware";

export const POST = withAuthRateLimit(async (request, user) => {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 503 },
      );
    }
    const body = await request.json();
    const { planType } = body; // 'monthly', 'yearly', or 'one-time'

    if (!planType || !["monthly", "yearly", "one-time"].includes(planType)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        name: true,
        stripeCustomerId: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create Stripe customer if doesn't exist
    let customerId = dbUser.stripeCustomerId;
    if (!customerId) {
      const customer = await createCustomer(
        dbUser.email,
        dbUser.name || undefined,
      );
      customerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Get the price ID based on plan type
    let priceId: string;
    let mode: "subscription" | "payment";

    if (planType === "monthly") {
      priceId = PLANS.MONTHLY.priceId;
      mode = "subscription";
    } else if (planType === "yearly") {
      priceId = PLANS.YEARLY.priceId;
      mode = "subscription";
    } else {
      priceId = PLANS.ONE_TIME.priceId;
      mode = "payment";
    }

    // Create checkout session
    const session = await createCheckoutSession({
      customerId,
      priceId,
      mode,
      successUrl: `${request.headers.get("origin")}/app/account/billing?success=true`,
      cancelUrl: `${request.headers.get("origin")}/app/account/billing?canceled=true`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
});
