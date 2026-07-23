import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/router/rate-limit-middleware";

// Basic email validation, kept intentionally permissive.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleSubscribe(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const email = String(body?.email ?? "")
      .trim()
      .toLowerCase();
    const locale = String(body?.locale ?? "en")
      .trim()
      .slice(0, 8);
    const source = String(body?.source ?? "landing")
      .trim()
      .slice(0, 64);

    if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address." },
        { status: 400 },
      );
    }

    // Upsert so re-subscribing is idempotent and never leaks whether the
    // email already existed.
    await prisma.newsletterSubscription.upsert({
      where: { email },
      create: { email, locale, source },
      update: { locale, source },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error subscribing to newsletter:", error);
    return NextResponse.json(
      { success: false, error: "Failed to subscribe." },
      { status: 500 },
    );
  }
}

// Apply rate limiting: 5 requests per minute per IP.
export const POST = withRateLimit(handleSubscribe, {
  maxRequests: 5,
  windowMs: 60 * 1000,
  keyPrefix: "newsletter",
});
