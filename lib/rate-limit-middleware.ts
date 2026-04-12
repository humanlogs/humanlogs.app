import { NextRequest, NextResponse } from "next/server";
import { requireAuth, UserSession } from "@/lib/auth-helpers";
import {
  checkRateLimit,
  getRateLimitKey,
  RateLimitConfig,
} from "@/lib/rate-limiter";

/**
 * Default rate limit configuration for authenticated routes
 * 60 requests per minute
 */
const DEFAULT_AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "auth",
};

/**
 * Type for Next.js route handler
 */
type RouteHandler = (
  request: NextRequest,
  context?: { params?: any },
) => Promise<NextResponse>;

/**
 * Type for authenticated route handler that receives user session
 */
type AuthenticatedRouteHandler = (
  request: NextRequest,
  user: UserSession,
  context?: any,
) => Promise<NextResponse | any>;

/**
 * Wrap an authenticated route handler with rate limiting
 *
 * This middleware:
 * 1. Checks if user is authenticated (throws 401 if not)
 * 2. Applies rate limiting based on user ID
 * 3. Calls the actual handler if checks pass
 *
 * @param handler - The authenticated route handler function
 * @param config - Optional custom rate limit configuration
 *
 * @example
 * ```ts
 * export const GET = withAuthRateLimit(async (request, user) => {
 *   // Your route logic here
 *   // User is guaranteed to be authenticated
 *   // Rate limit already checked
 *   return NextResponse.json({ userId: user.id });
 * });
 * ```
 *
 * @example With custom rate limit
 * ```ts
 * export const POST = withAuthRateLimit(
 *   async (request, user) => {
 *     // Handle expensive operation
 *     return NextResponse.json({ success: true });
 *   },
 *   { maxRequests: 10, windowMs: 60 * 1000 }
 * );
 * ```
 */
export function withAuthRateLimit(
  handler: AuthenticatedRouteHandler,
  config: Partial<RateLimitConfig> = {},
): RouteHandler {
  const rateLimitConfig = { ...DEFAULT_AUTH_RATE_LIMIT, ...config };

  return async (request: NextRequest, context?: { params?: any }) => {
    try {
      // 1. Check authentication first
      const user = await requireAuth();

      // 2. Apply rate limiting based on user ID
      const rateLimitKey = getRateLimitKey(request, user.id);
      const rateCheck = await checkRateLimit(rateLimitKey, rateLimitConfig);

      if (!rateCheck.allowed) {
        const secondsLeft = Math.ceil(
          (rateCheck.resetTime - Date.now()) / 1000,
        );
        return NextResponse.json(
          {
            error: `Rate limit exceeded. Please try again in ${secondsLeft} second${secondsLeft !== 1 ? "s" : ""}.`,
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": rateCheck.limit.toString(),
              "X-RateLimit-Remaining": rateCheck.remaining.toString(),
              "X-RateLimit-Reset": rateCheck.resetTime.toString(),
              "Retry-After": secondsLeft.toString(),
            },
          },
        );
      }

      // 3. Call the actual handler
      const response = await handler(request, user, context);

      // 4. Add rate limit headers to successful responses
      response.headers.set("X-RateLimit-Limit", rateCheck.limit.toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        rateCheck.remaining.toString(),
      );
      response.headers.set("X-RateLimit-Reset", rateCheck.resetTime.toString());

      return response;
    } catch (error) {
      // Handle authentication errors
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        return NextResponse.json(
          { error: "Unauthorized - Please log in" },
          { status: 401 },
        );
      }

      // Re-throw other errors to be handled by the route
      throw error;
    }
  };
}

/**
 * Alternative: Wrap a route handler with ONLY rate limiting (no auth check)
 * Useful for public endpoints that still need rate limiting
 *
 * @param handler - The route handler function
 * @param config - Rate limit configuration
 * @param getKey - Function to extract rate limit key from request (defaults to IP)
 *
 * @example
 * ```ts
 * export const POST = withRateLimit(
 *   async (request) => {
 *     return NextResponse.json({ success: true });
 *   },
 *   { maxRequests: 5, windowMs: 60 * 1000, keyPrefix: "public" }
 * );
 * ```
 */
export function withRateLimit(
  handler: RouteHandler,
  config: RateLimitConfig,
  getKey?: (request: NextRequest) => string,
): RouteHandler {
  return async (request: NextRequest, context?: { params?: any }) => {
    const key = getKey ? getKey(request) : getRateLimitKey(request);
    const rateCheck = await checkRateLimit(key, config);

    if (!rateCheck.allowed) {
      const secondsLeft = Math.ceil((rateCheck.resetTime - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again in ${secondsLeft} second${secondsLeft !== 1 ? "s" : ""}.`,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateCheck.limit.toString(),
            "X-RateLimit-Remaining": rateCheck.remaining.toString(),
            "X-RateLimit-Reset": rateCheck.resetTime.toString(),
            "Retry-After": secondsLeft.toString(),
          },
        },
      );
    }

    const response = await handler(request, context);

    // Add rate limit headers to response
    response.headers.set("X-RateLimit-Limit", rateCheck.limit.toString());
    response.headers.set(
      "X-RateLimit-Remaining",
      rateCheck.remaining.toString(),
    );
    response.headers.set("X-RateLimit-Reset", rateCheck.resetTime.toString());

    return response;
  };
}
