import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "../config";

/**
 * Verify socket JWT token and return userId
 * Used by socket server to authenticate socket connections
 */
export async function verifySocketToken(token: string): Promise<string | null> {
  try {
    const secret = new TextEncoder().encode(authConfig.sessionSecret);

    const { payload } = await jwtVerify(token, secret);

    // Verify it's a socket token
    if (payload.type !== "socket") {
      return null;
    }

    return payload.userId as string;
  } catch {
    return null;
  }
}

/**
 * Create a JWT token specifically for socket authentication
 * This token is separate from session tokens and has a shorter expiry
 * Works for both local and Auth0 users
 */
export async function createSocketToken(userId: string): Promise<string> {
  if (!authConfig.sessionSecret) {
    throw new Error(
      "Session secret is not configured. Please set AUTH_SESSION_SECRET in your environment variables.",
    );
  }

  const secret = new TextEncoder().encode(authConfig.sessionSecret);

  const token = await new SignJWT({ userId, type: "socket" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h") // Shorter expiry for socket tokens
    .sign(secret);

  return token;
}
