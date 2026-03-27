import { NextRequest, NextResponse } from "next/server";
import { clearLocalSession } from "@/lib/local-auth";
import { authConfig } from "@/lib/config";

/**
 * POST /api/local-auth/logout
 * Clear session and log out user
 */
export async function POST(request: NextRequest) {
  // Only allow local auth if mode is set to "local"
  if (authConfig.mode !== "local") {
    return NextResponse.json(
      { error: "Local authentication is not enabled" },
      { status: 403 },
    );
  }

  try {
    await clearLocalSession();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
