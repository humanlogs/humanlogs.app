import { NextRequest, NextResponse } from "next/server";
import { registerLocal, setLocalSession } from "@/lib/local-auth";
import { authConfig, ldapConfig } from "@/lib/config";

/**
 * POST /api/local-auth/register
 * Register a new user (local database only, not for LDAP)
 */
export async function POST(request: NextRequest) {
  // Only allow local auth if mode is set to "local"
  if (authConfig.mode !== "local") {
    return NextResponse.json(
      { error: "Local authentication is not enabled" },
      { status: 403 },
    );
  }

  // Don't allow registration if LDAP is enabled (users should come from LDAP)
  if (ldapConfig.enabled) {
    return NextResponse.json(
      { error: "Registration is disabled when LDAP is enabled" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const user = await registerLocal(email, password, name);

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
  } catch (error: unknown) {
    console.error("Registration error:", error);

    // Check for unique constraint violation (user already exists)
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
