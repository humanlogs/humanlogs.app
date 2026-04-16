import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // Get the real IP address (handle proxies)
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : realIp || request.ip || "unknown";

    // Hash the IP for privacy
    const ipHash = crypto.createHash("sha256").update(ip).digest("hex");

    // Get current date in YYYY-MM-DD format
    const visitDate = new Date().toISOString().split("T")[0];

    // Create or update visit record (upsert)
    await prisma.landingPageVisit.upsert({
      where: {
        ipHash_visitDate: {
          ipHash,
          visitDate,
        },
      },
      create: {
        ipHash,
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
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
