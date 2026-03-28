import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";

const userSelectPublic = {
  id: true,
  name: true,
  picture: true,
};

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = await params;
    await requireAuth();

    // Fetch user from database with all fields
    const dbUser = await prisma.user.findUnique({
      where: {
        id,
      },
      select: userSelectPublic,
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
}
