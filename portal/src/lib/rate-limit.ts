/**
 * Simple in-memory rate limiter for serverless functions
 * Note: In a distributed environment, consider using Redis or similar
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (resets on cold start, which is acceptable for basic protection)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  // Number of requests allowed in the window
  limit: number;
  // Window size in seconds
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

/**
 * Check rate limit for a given identifier (usually IP or user ID)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupExpiredEntries();

  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const key = identifier;

  const entry = rateLimitStore.get(key);

  // No existing entry or window expired
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: config.limit - 1,
      resetTime: now + windowMs,
    };
  }

  // Within window, increment counter
  entry.count++;

  if (entry.count > config.limit) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    success: true,
    remaining: config.limit - entry.count,
    resetTime: entry.resetTime,
  };
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

// Preset configurations for common use cases
export const RATE_LIMITS = {
  // Login: 5 attempts per 15 minutes per IP
  LOGIN: { limit: 5, windowSec: 15 * 60 },

  // Signup: 3 accounts per hour per IP
  SIGNUP: { limit: 3, windowSec: 60 * 60 },

  // License validation: 100 requests per minute per IP
  LICENSE_VALIDATE: { limit: 100, windowSec: 60 },

  // License generation: 20 per hour per user
  LICENSE_GENERATE: { limit: 20, windowSec: 60 * 60 },

  // API general: 60 requests per minute per IP
  API_GENERAL: { limit: 60, windowSec: 60 },

  // Admin API: 30 write operations per minute per user (for create/update/delete)
  ADMIN_WRITE: { limit: 30, windowSec: 60 },

  // Admin API: 120 read operations per minute per user (for list/get)
  ADMIN_READ: { limit: 120, windowSec: 60 },
} as const;
