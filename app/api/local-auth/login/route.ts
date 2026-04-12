import { NextRequest, NextResponse } from "next/server";
import { authenticateLocal, setLocalSession } from "@/lib/auth/local-auth";
import { authConfig } from "@/lib/config";

/**
 * POST /api/local-auth/login
 * Authenticate user with email/password (local or LDAP)
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
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const user = await authenticateLocal(email, password);

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    // Set session cookie
    await setLocalSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
