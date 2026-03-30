import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCustomerPortalSession, isStripeConfigured } from "@/lib/stripe";
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
        stripeCustomerId: true,
      },
    });

    if (!dbUser || !dbUser.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 },
      );
    }

    // Create customer portal session
    const session = await createCustomerPortalSession(
      dbUser.stripeCustomerId,
      `${request.headers.get("origin")}/app/account/billing`,
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating customer portal session:", error);
    return NextResponse.json(
      { error: "Failed to create customer portal session" },
      { status: 500 },
    );
  }
});
