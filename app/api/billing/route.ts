import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getPlanDetails, isStripeConfigured } from "@/lib/stripe";

export async function GET() {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: "Billing is not configured" },
        { status: 503 },
      );
    }

    const user = await requireAuth();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        credits: true,
        creditsRefill: true,
        creditsUsed: true,
        plan: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionPeriodEnd: true,
        subscriptionStatus: true,
        lastCreditsRefill: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const planDetails = getPlanDetails(dbUser.plan);

    return NextResponse.json({
      credits: dbUser.credits,
      creditsRefill: dbUser.creditsRefill,
      creditsUsed: dbUser.creditsUsed,
      plan: dbUser.plan,
      planDetails,
      subscription: {
        status: dbUser.subscriptionStatus,
        periodEnd: dbUser.subscriptionPeriodEnd,
        isActive:
          dbUser.subscriptionStatus === "active" ||
          dbUser.subscriptionStatus === "trialing",
      },
      hasStripeCustomer: !!dbUser.stripeCustomerId,
      lastCreditsRefill: dbUser.lastCreditsRefill,
    });
  } catch (error) {
    console.error("Error fetching billing info:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing information" },
      { status: 500 },
    );
  }
}
