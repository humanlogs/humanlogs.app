import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelSubscription, isStripeConfigured } from "@/lib/stripe";
import { withAuthRateLimit } from "@/lib/rate-limit-middleware";

export const POST = withAuthRateLimit(async (request, user) => {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 503 },
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        stripeSubscriptionId: true,
        plan: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!dbUser.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 },
      );
    }

    // Cancel the subscription in Stripe
    await cancelSubscription(dbUser.stripeSubscriptionId);

    // Update user in database - subscription will be canceled at period end
    await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: "canceled",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription will be canceled at the end of the billing period",
    });
  } catch (error) {
    console.error("Error canceling subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 },
    );
  }
});
