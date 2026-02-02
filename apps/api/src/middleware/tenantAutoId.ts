/**
 * Tenant Auto ID Generator Middleware
 * Consistently generates 4-digit alphanumeric IDs from tenant IDs
 * Based on the same logic as the SKU generator for consistency
 */

/**
 * Generate a 4-character alphanumeric key from tenant ID
 * Uses the same hash-based algorithm as the SKU generator for consistency
 */
export function generateTenantAutoId(tenantId: string): string {
  if (!tenantId) return 'UNKN';
  
  // Use a simple hash to create consistent 4-char key from tenant ID
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to 4-character alphanumeric key
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0, O, 1, I)
  let tempHash = Math.abs(hash);
  let key = '';
  for (let i = 0; i < 4; i++) {
    key += chars[tempHash % chars.length];
    tempHash = Math.floor(tempHash / chars.length);
  }
  
  return key;
}

/**
 * Middleware function to get tenant auto ID
 * Can be used in API routes or services
 */
export function getTenantAutoId(tenantId: string): string {
  return generateTenantAutoId(tenantId);
}

import { Request, Response, NextFunction } from 'express';

// Extend Request interface to include tenantAutoId
declare global {
  namespace Express {
    interface Request {
      tenantAutoId?: string;
    }
  }
}

/**
 * Express middleware to attach tenant auto ID to request
 */
export function tenantAutoIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { tenantId } = req.query;
  
  if (tenantId && typeof tenantId === 'string') {
    req.tenantAutoId = generateTenantAutoId(tenantId);
  }
  
  next();
}

/**
 * Get all possible URL identifiers for a tenant
 * Returns slug, tenantId, and autoId for flexible URL routing
 */
export function getTenantIdentifiers(tenantId: string, slug?: string): {
  tenantId: string;
  slug?: string;
  autoId: string;
} {
  return {
    tenantId,
    slug,
    autoId: generateTenantAutoId(tenantId)
  };
}

/**
 * Validate if a string looks like a tenant auto ID
 * Pattern: 4 characters, uppercase alphanumeric (no ambiguous chars)
 */
export function isTenantAutoId(identifier: string): boolean {
  const pattern = /^[A-Z0-9]{4}$/;
  return pattern.test(identifier);
}

/**
 * Cache for tenant auto IDs to avoid recalculating
 */
const tenantAutoIdCache = new Map<string, string>();

/**
 * Get tenant auto ID with caching for performance
 */
export function getCachedTenantAutoId(tenantId: string): string {
  if (tenantAutoIdCache.has(tenantId)) {
    return tenantAutoIdCache.get(tenantId)!;
  }
  
  const autoId = generateTenantAutoId(tenantId);
  tenantAutoIdCache.set(tenantId, autoId);
  return autoId;
}

/**
 * Clear the tenant auto ID cache (useful for testing or cache invalidation)
 */
export function clearTenantAutoIdCache(): void {
  tenantAutoIdCache.clear();
}

export default {
  generateTenantAutoId,
  getTenantAutoId,
  tenantAutoIdMiddleware,
  getTenantIdentifiers,
  isTenantAutoId,
  getCachedTenantAutoId,
  clearTenantAutoIdCache
};
