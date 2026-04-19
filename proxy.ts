import { getAuth0Client } from "./lib/auth/auth0";
import { authConfig } from "./lib/config";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// The proxy handles all auth routes automatically via auth0.middleware()
export default async function proxy(request: NextRequest) {
  let response: NextResponse;

  // Only use Auth0 middleware if auth mode is auth0
  if (authConfig.mode === "auth0") {
    const auth0 = getAuth0Client();
    response = await auth0.middleware(request);
  } else {
    // For local auth, just pass through
    response = NextResponse.next();
  }

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; media-src 'self' blob:;",
  );
  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - /api/transcriptions/create (large file upload endpoint)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/transcriptions/create|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
