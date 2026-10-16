import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { DEFAULT_TIER } from '../utils/tier-defaults';

/**
 * Rate limiting for image search API
 * Protects against abuse and manages API quota
 */

// In-memory rate limit store (consider Redis for production)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Tier-based limits per hour
// Exported for the tier-contract guard (sprint plan 4.4): subset limit map —
// keys must stay ⊆ the contract tier universe.
export const IMAGE_SEARCH_TIER_LIMITS = {
  directory_presence: 10, // floor — also the DEFAULT_TIER fallback value
  google_only: 10,      // 10 searches/hour
  discovery: 10,
  storefront: 20,
  starter: 20,          // 20 searches/hour
  commitment: 30,
  professional: 50,     // 50 searches/hour (matches Unsplash free tier)
  enterprise: 100,      // 100 searches/hour
  organization: 100,    // 100 searches/hour
} as const;

/**
 * Check and enforce rate limits for image search
 */
export async function checkImageSearchLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = (req as any).user?.userId;
    const tenantId = req.query.tenantId as string;

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Get tenant to check tier — DEFAULT_TIER (directory_presence) per 1.7:
    // the shared "no/unknown tier" answer, least privilege.
    let tier: string = DEFAULT_TIER;
    if (tenantId) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_tier: true },
      });
      tier = tenant?.subscription_tier || DEFAULT_TIER;
    }

    // Get rate limit for this tier
    const limit = IMAGE_SEARCH_TIER_LIMITS[tier as keyof typeof IMAGE_SEARCH_TIER_LIMITS]
      ?? IMAGE_SEARCH_TIER_LIMITS[DEFAULT_TIER];

    // Check rate limit
    const now = Date.now();
    const key = `image-search:${userId}`;
    const entry = rateLimitStore.get(key);

    if (entry && entry.resetAt > now) {
      // Within current window
      if (entry.count >= limit) {
        const resetIn = Math.ceil((entry.resetAt - now) / 1000 / 60); // minutes
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `You've reached your image search limit (${limit}/hour). Try again in ${resetIn} minutes.`,
          limit,
          remaining: 0,
          resetAt: entry.resetAt,
          resetIn,
          upgradeMessage: tier === 'starter' 
            ? 'Upgrade to Professional for 50 searches/hour'
            : tier === 'google_only'
            ? 'Upgrade to Starter for 20 searches/hour'
            : tier === 'discovery'
            ? 'Upgrade to Starter for 20 searches/hour'
            : tier === 'storefront'
            ? 'Upgrade to Starter for 20 searches/hour'
            : tier === 'commitment'
            ? 'Upgrade to Starter for 20 searches/hour'
            : null,
        });
      }

      // Increment count
      entry.count++;
    } else {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetAt: now + 60 * 60 * 1000, // 1 hour from now
      });
    }

    // Add rate limit info to response headers
    const currentEntry = rateLimitStore.get(key)!;
    res.setHeader('X-RateLimit-Limit', limit.toString());
    res.setHeader('X-RateLimit-Remaining', (limit - currentEntry.count).toString());
    res.setHeader('X-RateLimit-Reset', currentEntry.resetAt.toString());

    next();
  } catch (error: any) {
    logger.error('[Image Search Limit] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    // Don't block on rate limit errors
    next();
  }
}

/**
 * Cleanup old rate limit entries (run periodically)
 */
export function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);
