import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/router/rate-limit-middleware";
import crypto from "crypto";

async function handleVisit(request: NextRequest) {
  try {
    // Get page from query params
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "/";

    // Validate and sanitize page path
    const sanitizedPage = page.trim().slice(0, 255); // Limit length

    // Get the real IP address (handle proxies)
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded ? forwarded.split(",")[0].trim() : realIp || "unknown";

    // Hash the IP for privacy
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    // Get current date in YYYY-MM-DD format
    const visitDate = new Date().toISOString().split("T")[0];

    // Create or update visit record (upsert)
    await prisma.landingPageVisit.upsert({
      where: {
        ipHash_page_visitDate: {
          ipHash,
          page: sanitizedPage,
          visitDate,
        },
      },
      create: {
        ipHash,
        page: sanitizedPage,
        visitDate,
      },
      update: {
        // Just update createdAt to reflect last visit time
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error tracking visit:", error);
    // Don't fail the request if tracking fails
    return NextResponse.json(
      { success: false, error: "Failed to track visit" },
      { status: 500 },
    );
  }
}

// Apply rate limiting: 10 requests per minute per IP
export const GET = withRateLimit(handleVisit, {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "iwashere",
});
