import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthRateLimit } from "@/lib/router/rate-limit-middleware";

/**
 * GET /api/user/encryption
 * Retrieves the user's encryption status and public key.
 */
export const GET = withAuthRateLimit(async (request, user) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        publicKey: true,
        trustedDeviceSecret: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      hasEncryption: !!dbUser.publicKey,
      publicKey: dbUser.publicKey,
      trustedDeviceSecret: dbUser.trustedDeviceSecret,
    });
  } catch (error) {
    console.error("Error fetching encryption status:", error);
    return NextResponse.json(
      { error: "Failed to fetch encryption status" },
      { status: 500 },
    );
  }
});

/**
 * POST /api/user/encryption
 * Enables end-to-end encryption for the user.
 */
export const POST = withAuthRateLimit(async (request, user) => {
  try {
    const body = await request.json();

    const { publicKey, trustedDeviceSecret } = body;

    if (!publicKey || !trustedDeviceSecret) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Update user with encryption keys
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        publicKey,
        trustedDeviceSecret,
      },
      select: {
        publicKey: true,
        trustedDeviceSecret: true,
      },
    });

    return NextResponse.json({
      success: true,
      publicKey: updatedUser.publicKey,
      trustedDeviceSecret: updatedUser.trustedDeviceSecret,
    });
  } catch (error) {
    console.error("Error enabling encryption:", error);
    return NextResponse.json(
      { error: "Failed to enable encryption" },
      { status: 500 },
    );
  }
});

/**
 * DELETE /api/user/encryption
 * Disables end-to-end encryption for the user.
 */
export const DELETE = withAuthRateLimit(async (request, user) => {
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        publicKey: null,
        trustedDeviceSecret: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error disabling encryption:", error);
    return NextResponse.json(
      { error: "Failed to disable encryption" },
      { status: 500 },
    );
  }
});
