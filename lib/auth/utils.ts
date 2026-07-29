import { SignJWT, jwtVerify } from "jose";
import { authConfig } from "../config";

/**
 * Who a socket token says its bearer is.
 *
 * The identity fields are carried IN the token rather than looked up when it is
 * presented: the socket server has no working Prisma client, and the token is
 * minted by an API route that has just read the user anyway. They are display
 * data (logs, presence) — nothing is authorized from them.
 */
export type SocketTokenClaims = {
  userId: string;
  email?: string;
  name?: string;
};

/**
 * Verify socket JWT token and return userId
 * Used by socket server to authenticate socket connections
 */
export async function verifySocketToken(token: string): Promise<string | null> {
  const claims = await verifySocketTokenClaims(token);
  return claims?.userId ?? null;
}

/** As {@link verifySocketToken}, but keeps the identity the token carries. */
export async function verifySocketTokenClaims(
  token: string,
): Promise<SocketTokenClaims | null> {
  try {
    const secret = new TextEncoder().encode(authConfig.sessionSecret);

    const { payload } = await jwtVerify(token, secret);

    // Verify it's a socket token
    if (payload.type !== "socket") {
      return null;
    }

    const userId = payload.userId;
    if (typeof userId !== "string" || !userId) return null;

    return {
      userId,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Create a JWT token specifically for socket authentication
 * This token is separate from session tokens and has a shorter expiry
 * Works for both local and Auth0 users
 */
export async function createSocketToken(
  userId: string,
  identity?: { email?: string | null; name?: string | null },
): Promise<string> {
  if (!authConfig.sessionSecret) {
    throw new Error(
      "Session secret is not configured. Please set AUTH_SESSION_SECRET in your environment variables.",
    );
  }

  const secret = new TextEncoder().encode(authConfig.sessionSecret);

  const token = await new SignJWT({
    userId,
    type: "socket",
    ...(identity?.email ? { email: identity.email } : {}),
    ...(identity?.name ? { name: identity.name } : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h") // Shorter expiry for socket tokens
    .sign(secret);

  return token;
}
