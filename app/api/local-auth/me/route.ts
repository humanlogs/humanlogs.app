import { NextRequest, NextResponse } from "next/server";
import { getLocalSession } from "@/lib/auth/local-auth";
import { authConfig } from "@/lib/config";

/**
 * GET /api/local-auth/me
 * Get current user session
 */
export async function GET(request: NextRequest) {
  // Only allow local auth if mode is set to "local"
  if (authConfig.mode !== "local") {
    return NextResponse.json(
      { error: "Local authentication is not enabled" },
      { status: 403 },
    );
  }

  try {
    const user = await getLocalSession();

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 },
    );
  }
}
