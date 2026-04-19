import { getAuth0Client } from "./lib/auth/auth0";
import { authConfig } from "./lib/config";
import { locales } from "./lib/utils/i18n";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const landingPaths = [
  "/",
  "/alternatives",
  "/contact",
  "/legal",
  "/pricing",
  "/resources",
  "/tools",
  "/use-cases",
];

function isLandingPage(pathname: string): boolean {
  // Check if path starts with any landing page path
  return landingPaths.some((path) => {
    if (path === "/") {
      return pathname === "/" || pathname === "";
    }
    return pathname.startsWith(path);
  });
}

function getLocaleFromPathname(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && locales.includes(segments[0])) {
    return segments[0];
  }
  return null;
}

function getPreferredLocale(request: NextRequest): string {
  // Try to get locale from Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(",")
      .map((lang) => lang.split(";")[0].trim().toLowerCase().split("-")[0]);

    for (const lang of languages) {
      if (locales.includes(lang)) {
        return lang;
      }
    }
  }

  return "en"; // Default to English
}

// The proxy handles all auth routes automatically via auth0.middleware()
export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Handle locale routing for landing pages BEFORE auth middleware
  if (
    isLandingPage(pathname) &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/app") &&
    !pathname.includes(".")
  ) {
    const currentLocale = getLocaleFromPathname(pathname);

    // If URL doesn't have a valid locale, redirect to URL with locale prefix
    if (!currentLocale && pathname !== "/") {
      const preferredLocale = getPreferredLocale(request);
      const newUrl = new URL(
        `/${preferredLocale}${pathname}${search}`,
        request.url,
      );
      return NextResponse.redirect(newUrl);
    }
  }

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
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; media-src 'self' blob:; connect-src 'self' blob: https://unpkg.com https://*.google-analytics.com;",
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
