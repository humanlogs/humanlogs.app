import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed within the time window
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  /**
   * Optional prefix for the rate limit key
   */
  keyPrefix?: string;
}

/**
 * Get rate limit key from request or user ID
 *
 * @param request - The incoming Next.js request
 * @param userId - Optional user ID (takes precedence over IP)
 * @returns Rate limit key (user ID or IP address)
 *
 * @example
 * ```ts
 * // For authenticated users
 * const key = getRateLimitKey(request, user.id);
 *
 * // For public endpoints
 * const key = getRateLimitKey(request);
 * ```
 */
export function getRateLimitKey(request: NextRequest, userId?: string): string {
  // Use user ID if available (for authenticated requests)
  if (userId) {
    return userId;
  }

  // Fall back to IP address (for public/unauthenticated requests)
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  return ip;
}

export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;
  /**
   * Number of requests remaining in the current window
   */
  remaining: number;
  /**
   * Total limit for this endpoint
   */
  limit: number;
  /**
   * Unix timestamp (in ms) when the rate limit resets
   */
  resetTime: number;
}

/**
 * Database-backed rate limiter
 *
 * @param key - Unique identifier for the rate limit (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 * @returns Rate limit result indicating if request is allowed
 *
 * @example
 * ```ts
 * const key = getRateLimitKey(request, user?.id);
 * const result = await checkRateLimit(key, {
 *   maxRequests: 3,
 *   windowMs: 60 * 60 * 1000, // 1 hour
 *   keyPrefix: "contact",
 * });
 *
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: "Rate limit exceeded" },
 *     { status: 429 }
 *   );
 * }
 * ```
 */
export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, keyPrefix } = config;
  const rateLimitKey = keyPrefix ? `${keyPrefix}:${key}` : key;
  const now = Date.now();
  const resetTime = now + windowMs;

  // Clean up expired entries periodically (1% chance)
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({
      where: {
        resetAt: {
          lt: new Date(now),
        },
      },
    });
  }

  // Try to get existing rate limit record
  const existing = await prisma.rateLimit.findUnique({
    where: { key: rateLimitKey },
  });

  // If no record exists or window has expired, create new one
  if (!existing || existing.resetAt.getTime() < now) {
    await prisma.rateLimit.upsert({
      where: { key: rateLimitKey },
      create: {
        key: rateLimitKey,
        count: 1,
        resetAt: new Date(resetTime),
      },
      update: {
        count: 1,
        resetAt: new Date(resetTime),
      },
    });

    return {
      allowed: true,
      remaining: maxRequests - 1,
      limit: maxRequests,
      resetTime,
    };
  }

  // Check if limit exceeded
  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      limit: maxRequests,
      resetTime: existing.resetAt.getTime(),
    };
  }

  // Increment count
  await prisma.rateLimit.update({
    where: { key: rateLimitKey },
    data: {
      count: {
        increment: 1,
      },
    },
  });

  return {
    allowed: true,
    remaining: maxRequests - existing.count - 1,
    limit: maxRequests,
    resetTime: existing.resetAt.getTime(),
  };
}

/**
 * Reset rate limit for a specific key
 * Useful for administrative purposes or testing
 *
 * @param key - The rate limit key to reset
 */
export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit
    .delete({
      where: { key },
    })
    .catch(() => {
      // Ignore if key doesn't exist
    });
}

/**
 * Get current rate limit status without incrementing
 *
 * @param key - The rate limit key to check
 * @param config - Rate limit configuration
 */
export async function getRateLimitStatus(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { maxRequests, keyPrefix } = config;
  const rateLimitKey = keyPrefix ? `${keyPrefix}:${key}` : key;
  const now = Date.now();

  const existing = await prisma.rateLimit.findUnique({
    where: { key: rateLimitKey },
  });

  if (!existing || existing.resetAt.getTime() < now) {
    return {
      allowed: true,
      remaining: maxRequests,
      limit: maxRequests,
      resetTime: now + config.windowMs,
    };
  }

  return {
    allowed: existing.count < maxRequests,
    remaining: Math.max(0, maxRequests - existing.count),
    limit: maxRequests,
    resetTime: existing.resetAt.getTime(),
  };
}
