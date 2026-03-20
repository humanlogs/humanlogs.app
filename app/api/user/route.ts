import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireAuth();

    // Fetch user from database with all fields
    const dbUser = await prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        language: true,
        credits: true,
        creditsRefill: true,
        plan: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(dbUser);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Validate language if provided
    if (body.language && !["en", "fr", "es", "de"].includes(body.language)) {
      return NextResponse.json(
        { error: "Invalid language code" },
        { status: 400 },
      );
    }

    // Update allowed fields
    const updateData: Record<string, string> = {};
    if (body.language) updateData.language = body.language;

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        language: true,
        credits: true,
        creditsRefill: true,
        plan: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user profile" },
      { status: 500 },
    );
  }
}
