import { auth0 } from "./lib/auth/auth0";
import type { NextRequest } from "next/server";

// The proxy handles all auth routes automatically via auth0.middleware()
export default async function proxy(request: NextRequest) {
  const response = await auth0.middleware(request);

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
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
