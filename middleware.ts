import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const start = Date.now();
  const { pathname, search } = request.nextUrl;
  const method = request.method;

  // Log the incoming request
  console.log(`[API] ${method} ${pathname}${search}`);

  // Create response
  const response = NextResponse.next();

  // Log after response (in practice this logs immediately, duration calculated on next request)
  const duration = Date.now() - start;
  if (duration > 0) {
    console.log(`[API] ${method} ${pathname} - ${duration}ms`);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
