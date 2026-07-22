import { createSocketToken } from "@/lib/auth/utils";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import { getAvailableSttProviders } from "@/lib/stt/stt-service";
import { NextResponse } from "next/server";

const userSelectDefault = {
  id: true,
  email: true,
  name: true,
  language: true,
  createdAt: true,
  trustedDeviceSecret: true,
  subscriptionPeriodEnd: true,
  subscriptionStatus: true,
  credits: true,
  creditsRefill: true,
  creditsUsed: true,
  plan: true,
  shortcuts: true,
  isWelcomeDone: true,
  onboardingStep: true,
  isAdmin: true,
  profession: true,
  monthlyUsage: true,
  dataResidency: true,
  referralBonusCredits: true,
};

export const GET = withAuthRateLimit(async (request, user) => {
  try {
    // Fetch user from database with all fields
    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: userSelectDefault,
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate socket token for real-time connections
    const socketToken = await createSocketToken(user.id);

    return NextResponse.json({
      ...dbUser,
      socketToken,
      isBillingEnabled: isStripeConfigured(),
      availableSttProviders: getAvailableSttProviders(),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 },
    );
  }
});

export const PATCH = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();

    // Validate language if provided
    if (body.language && !["en", "fr", "es", "de"].includes(body.language)) {
      return NextResponse.json(
        { error: "Invalid language code" },
        { status: 400 },
      );
    }

    // Validate data residency if provided
    if (
      body.dataResidency &&
      !["eu", "us"].includes(body.dataResidency)
    ) {
      return NextResponse.json(
        { error: "Invalid data residency" },
        { status: 400 },
      );
    }

    // Validate onboarding step if provided. Current flow first, then legacy
    // values kept so historical data and older clients stay valid.
    const ONBOARDING_STEPS = [
      "role",
      "engage",
      "provisioning",
      "security",
      "done",
      "profile",
      "referral",
      "ready",
    ];
    if (
      body.onboardingStep &&
      !ONBOARDING_STEPS.includes(body.onboardingStep)
    ) {
      return NextResponse.json(
        { error: "Invalid onboarding step" },
        { status: 400 },
      );
    }

    // Update allowed fields
    const updateData: Record<string, string | boolean> = {};
    if (body.language) updateData.language = body.language;
    if (body.isWelcomeDone) {
      updateData.isWelcomeDone = true;
      // Completing the welcome flow always lands on the terminal step.
      updateData.onboardingStep = "done";
    }
    if (body.onboardingStep) updateData.onboardingStep = body.onboardingStep;
    if (typeof body.profession === "string")
      updateData.profession = body.profession;
    if (typeof body.monthlyUsage === "string")
      updateData.monthlyUsage = body.monthlyUsage;
    if (body.dataResidency) updateData.dataResidency = body.dataResidency;

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: updateData,
      select: userSelectDefault,
    });

    return NextResponse.json({
      ...updatedUser,
      isBillingEnabled: isStripeConfigured(),
      availableSttProviders: getAvailableSttProviders(),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 },
    );
  }
});
