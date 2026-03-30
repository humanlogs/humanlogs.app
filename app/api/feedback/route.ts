import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/rate-limit-middleware";

export const POST = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();

    const { type = "RATING", rating, message } = body;

    // Validate type
    if (!["RATING", "FEATURE_REQUEST"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid feedback type" },
        { status: 400 },
      );
    }

    // Validate rating for RATING type
    if (type === "RATING") {
      if (
        typeof rating !== "number" ||
        rating < 1 ||
        rating > 5 ||
        !Number.isInteger(rating)
      ) {
        return NextResponse.json(
          { error: "Rating must be an integer between 1 and 5" },
          { status: 400 },
        );
      }

      // Message required for low ratings
      if (rating < 3 && (!message || typeof message !== "string")) {
        return NextResponse.json(
          { error: "Message is required for ratings below 3 stars" },
          { status: 400 },
        );
      }
    }

    // Validate message for FEATURE_REQUEST type
    if (
      type === "FEATURE_REQUEST" &&
      (!message || typeof message !== "string" || !message.trim())
    ) {
      return NextResponse.json(
        { error: "Message is required for feature requests" },
        { status: 400 },
      );
    }

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        type,
        rating: rating || null,
        message: message?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error("Error saving feedback:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    );
  }
});
