import { auth0 } from "./lib/auth0";
import type { NextRequest } from "next/server";

// The proxy handles all auth routes automatically via auth0.middleware()
export default async function proxy(request: NextRequest) {
  // The auth0.middleware() handles:
  // - /api/auth/login - redirects to Auth0
  // - /api/auth/logout - clears session and redirects
  // - /api/auth/callback - handles Auth0 callback
  // - /api/auth/me - returns user profile
  // - Session management and cookie handling
  return await auth0.middleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
