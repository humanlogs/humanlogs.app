import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import { withAuthRateLimit } from "@/lib/rate-limit-middleware";

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
  isAdmin: true,
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

    return NextResponse.json({
      ...dbUser,
      isBillingEnabled: isStripeConfigured(),
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

    // Update allowed fields
    const updateData: Record<string, string | boolean> = {};
    if (body.language) updateData.language = body.language;
    if (body.isWelcomeDone) updateData.isWelcomeDone = true;

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
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 },
    );
  }
});
