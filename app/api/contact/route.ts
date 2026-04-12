import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailer";
import {
  getContactEmailTemplate,
  getContactConfirmationTemplate,
} from "@/lib/email-templates";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limiter";

const RATE_LIMIT = {
  MAX_REQUESTS: 3, // Max requests per time window
  WINDOW_MS: 60 * 60 * 1000, // 1 hour in milliseconds
};

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const rateLimitKey = getRateLimitKey(request);
    const rateCheck = await checkRateLimit(rateLimitKey, {
      maxRequests: RATE_LIMIT.MAX_REQUESTS,
      windowMs: RATE_LIMIT.WINDOW_MS,
      keyPrefix: "contact",
    });

    if (!rateCheck.allowed) {
      const minutesLeft = Math.ceil((rateCheck.resetTime - Date.now()) / 60000);
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? "s" : ""}.`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateCheck.limit.toString(),
            "X-RateLimit-Remaining": rateCheck.remaining.toString(),
            "X-RateLimit-Reset": rateCheck.resetTime.toString(),
          },
        },
      );
    }

    const body = await request.json();
    const { fullName, email, organization, useCase, message } = body;

    // Validate required fields
    if (!fullName || !email || !organization || !useCase || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^@\s]+@[^.@\s]+(?:\.[^.@\s]+)+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 },
      );
    }

    // Validate use case
    const validUseCases = ["journalism", "legal", "government", "research"];
    if (!validUseCases.includes(useCase)) {
      return NextResponse.json({ error: "Invalid use case" }, { status: 400 });
    }

    // Send email to admin
    const adminEmailTemplate = getContactEmailTemplate({
      fullName,
      email,
      organization,
      useCase,
      message,
    });

    await sendEmail({
      to: "hello@humanlogs.app",
      subject: adminEmailTemplate.subject,
      text: adminEmailTemplate.text,
      html: adminEmailTemplate.html,
      replyTo: email,
    });

    // Send confirmation email to user
    const confirmationTemplate = getContactConfirmationTemplate({
      fullName,
    });

    await sendEmail({
      to: email,
      subject: confirmationTemplate.subject,
      text: confirmationTemplate.text,
      html: confirmationTemplate.html,
    });

    return NextResponse.json(
      { success: true, message: "Message sent successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error handling contact form:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 },
    );
  }
}
