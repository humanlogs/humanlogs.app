import { jwtVerify } from "jose";
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
