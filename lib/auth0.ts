import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { auth0Config } from "./config";

// Initialize Auth0 using centralized config
export const auth0 = new Auth0Client({
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
    absoluteDuration: 24, // hours
  },
});

export default auth0;
