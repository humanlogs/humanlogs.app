import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { auth0Config, authConfig } from "../config";

// Lazy initialization of Auth0 client
let auth0Instance: Auth0Client | null = null;

/**
 * Get Auth0 client instance (lazy initialization)
 * Only initializes if auth mode is "auth0"
 * Use this function instead of importing auth0 directly
 */
export function getAuth0Client(): Auth0Client {
  if (!auth0Instance) {
    if (authConfig.mode !== "auth0") {
      throw new Error(
        "Auth0 is not enabled. Current auth mode: " + authConfig.mode,
      );
    }

    auth0Instance = new Auth0Client({
      secret: auth0Config.secret,
      domain: auth0Config.issuerBaseUrl,
      appBaseUrl: auth0Config.baseUrl,
      clientId: auth0Config.clientId,
      clientSecret: auth0Config.clientSecret,
      signInReturnToPath: "/app",
      routes: {
        callback: "/api/auth/callback",
        login: "/api/auth/login",
        logout: "/api/auth/logout",
      },
      session: {
        absoluteDuration: 24 * 60 * 60, // 24 hours
      },
    });
  }

  return auth0Instance;
}
