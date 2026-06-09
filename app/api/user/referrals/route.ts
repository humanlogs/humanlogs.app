import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";
import {
  addReferralEmails,
  getReferralSummary,
  removeReferral,
} from "@/lib/referral";
import { NextResponse } from "next/server";

export const GET = withAuthRateLimit(async (request, user) => {
  try {
    const summary = await getReferralSummary(user.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching referrals:", error);
    return NextResponse.json(
      { error: "Failed to fetch referrals" },
      { status: 500 },
    );
  }
});

export const POST = withAuthRateLimit(
  async (request, user) => {
    try {
      const body = await request.json();
      const emails: unknown = body?.emails;

      if (!Array.isArray(emails) || emails.length === 0) {
        return NextResponse.json(
          { error: "A non-empty 'emails' array is required" },
          { status: 400 },
        );
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true },
      });

      if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const summary = await addReferralEmails(
        dbUser,
        emails.map((e) => String(e)),
      );

      return NextResponse.json(summary);
    } catch (error) {
      console.error("Error adding referrals:", error);
      return NextResponse.json(
        { error: "Failed to add referrals" },
        { status: 500 },
      );
    }
  },
  // Sending invitation emails is relatively expensive — tighter rate limit
  { maxRequests: 10, windowMs: 60 * 1000, keyPrefix: "referrals" },
);

export const DELETE = withAuthRateLimit(async (request, user) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "A referral 'id' is required" },
        { status: 400 },
      );
    }

    const summary = await removeReferral(user.id, id);

    if (!summary) {
      return NextResponse.json(
        { error: "Referral not found or cannot be removed" },
        { status: 404 },
      );
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error removing referral:", error);
    return NextResponse.json(
      { error: "Failed to remove referral" },
      { status: 500 },
    );
  }
});
