/**
 * Socket.IO Authentication Helper
 * Handles authentication for local, LDAP, and Auth0 modes
 */

import { Socket } from "socket.io";
import { verifySessionToken } from "./local-auth";
import { auth0 } from "./auth0";
import { authConfig } from "./config";
import { prisma } from "./prisma";

export interface SocketAuthResult {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Extract cookies from socket handshake headers
 */
function parseCookies(
  cookieHeader: string | undefined,
): Record<string, string> {
  if (!cookieHeader) return {};

  return cookieHeader
    .split(";")
    .reduce((acc: Record<string, string>, cookie: string) => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    }, {});
}

/**
 * Verify local/LDAP authentication (both use JWT tokens)
 */
async function verifyLocalAuth(
  token: string,
): Promise<SocketAuthResult | null> {
  const userId = await verifySessionToken(token);
  if (!userId) {
    return null;
  }

  // Verify user exists in database
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name || undefined,
  };
}

/**
 * Verify Auth0 authentication
 * Auth0 stores encrypted session data in cookies that we need to decode
 */
async function verifyAuth0(
  cookieHeader: string | undefined,
): Promise<SocketAuthResult | null> {
  if (!cookieHeader) {
    return null;
  }

  try {
    // Create a minimal request object that Auth0 SDK can use
    // We need to simulate an HTTP request to use auth0.getSession()
    const mockRequest = {
      headers: {
        cookie: cookieHeader,
      },
      url: "/api/socket",
      method: "GET",
    } as any;

    // Try to get session from Auth0
    const session = await auth0.getSession(mockRequest);

    if (!session?.user) {
      return null;
    }

    const auth0User = session.user;

    // Find user in our database
    const user = await prisma.user.findUnique({
      where: { auth0Id: auth0User.sub },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
    };
  } catch (error) {
    console.error("[Socket Auth] Auth0 verification failed:", error);
    return null;
  }
}

/**
 * Main authentication function for Socket.IO connections
 * Automatically handles local, LDAP, and Auth0 modes
 *
 * Note: LDAP authentication uses the same JWT session system as local auth.
 * LDAP is just an alternative authentication method - after successful LDAP login,
 * users get a standard JWT session token just like local users.
 */
export async function verifySocketAuth(
  socket: Socket,
): Promise<SocketAuthResult | null> {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const cookies = parseCookies(cookieHeader);

    // Try to get token from auth object (if client sends it explicitly)
    let token = socket.handshake.auth?.token;

    // Mode-specific authentication
    if (authConfig.mode === "local") {
      // Local mode handles both:
      // 1. Local database users (with password hash)
      // 2. LDAP users (authenticated via LDAP but stored in local DB)
      // Both use the same JWT session token system

      // Get token from cookies if not provided in auth object
      if (!token) {
        token = cookies.session;
      }

      if (!token) {
        return null;
      }

      return await verifyLocalAuth(token);
    } else if (authConfig.mode === "auth0") {
      // Auth0 uses encrypted session cookies
      // We need to validate the session using the Auth0 SDK
      return await verifyAuth0(cookieHeader);
    }

    return null;
  } catch (error) {
    console.error("[Socket Auth] Verification error:", error);
    return null;
  }
}
