import { NextRequest, NextResponse } from "next/server";
import { requireAuth, UserSession } from "@/lib/auth-helpers";
import {
  checkRateLimit,
  getRateLimitKey,
  RateLimitConfig,
} from "@/lib/rate-limiter";
import { prisma } from "@/lib/prisma";

/**
 * Default rate limit configuration for admin routes
 * 300 requests per minute (higher than regular auth)
 */
const DEFAULT_ADMIN_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 300,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: "admin",
};

/**
 * Type for authenticated admin route handler that receives user session
 */
type AdminRouteHandler = (
  request: NextRequest,
  user: UserSession,
  context?: any,
) => Promise<NextResponse | any>;

/**
 * Wrap an admin route handler with authentication and rate limiting
 *
 * This middleware:
 * 1. Checks if user is authenticated (throws 401 if not)
 * 2. Checks if user is an admin (throws 403 if not)
 * 3. Applies rate limiting based on user ID
 * 4. Calls the actual handler if checks pass
 *
 * @param handler - The authenticated admin route handler function
 * @param config - Optional custom rate limit configuration
 */
export function withAdminRateLimit(
  handler: AdminRouteHandler,
  config: RateLimitConfig = DEFAULT_ADMIN_RATE_LIMIT,
) {
  return async (request: NextRequest, context?: any) => {
    try {
      // 1. Check authentication
      const user = await requireAuth();

      // 2. Check if user is admin
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isAdmin: true },
      });

      if (!dbUser?.isAdmin) {
        return NextResponse.json(
          { error: "Forbidden: Admin access required" },
          { status: 403 },
        );
      }

      // 3. Check rate limit
      const rateLimitKey = getRateLimitKey(request, user.id);
      const rateLimitResult = await checkRateLimit(rateLimitKey, config);

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          { error: "Too many requests" },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": rateLimitResult.limit.toString(),
              "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
              "X-RateLimit-Reset": new Date(
                rateLimitResult.resetTime,
              ).toISOString(),
            },
          },
        );
      }

      // 4. Call the actual handler
      return await handler(request, user, context);
    } catch (error: any) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      throw error;
    }
  };
}
