/**
 * Example: How to use TenantSingletonService in other services
 * 
 * This shows the pattern that any service can follow when they need tenant slugs
 * or other tenant information.
 */

import tenantSingletonService from '../services/TenantSingletonService';

// Example 1: Get smart slug with automatic collision detection (recommended)
export async function getTenantSlugSmart(tenantId: string): Promise<string> {
  return await tenantSingletonService.getTenantSlugSmart(tenantId);
}

// Example 2: Get regular SEO-optimized slug (manual control)
export async function getTenantSlug(tenantId: string): Promise<string> {
  const tenantInfo = await tenantSingletonService.getTenantInfo(tenantId);
  return tenantInfo.slug;
}

// Example 3: Get guaranteed unique slug with autoId (force unique)
export async function getTenantSlugWithAutoId(tenantId: string): Promise<string> {
  return await tenantSingletonService.getTenantSlugWithAutoId(tenantId);
}

// Example 4: Get URLs for routing (both options)
export async function getTenantUrls(tenantId: string) {
  const tenantInfo = await tenantSingletonService.getTenantInfo(tenantId);
  const autoId = await tenantSingletonService.getTenantAutoId(tenantId);
  
  // Regular URLs
  const urls = tenantInfo.urls;
  
  // URLs with autoId for guaranteed uniqueness
  const urlsWithAutoId = tenantSingletonService.generateUrlsWithAutoId(
    tenantId, 
    tenantInfo.slug, 
    autoId
  );
  
  return { ...urls, ...urlsWithAutoId };
}

// Example 5: Resolve tenant by any identifier (slug, tenantId, autoId)
export async function resolveTenant(identifier: string) {
  return await tenantSingletonService.resolveTenantByIdentifier(identifier);
}

// Example 6: Lightweight identifier fetch
export async function getTenantIdentifiers(tenantId: string) {
  return await tenantSingletonService.getTenantIdentifiers(tenantId);
}

// Example 7: Get identifiers with both slug options
export async function getTenantIdentifiersWithAutoId(tenantId: string) {
  return await tenantSingletonService.getTenantIdentifiersWithAutoId(tenantId);
}

// Example 8: Get autoId for short URLs
export async function getTenantAutoId(tenantId: string): Promise<string> {
  return await tenantSingletonService.getTenantAutoId(tenantId);
}

// Example 9: Real-world usage scenarios

/**
 * Scenario 1: Smart collision detection (recommended)
 * Automatically switches to autoId when collision is detected
 * Result: "starbucks-CA" (no collision) or "starbucks-CA-A1B2" (collision detected)
 */
export async function getSmartBusinessSlug(tenantId: string) {
  return await tenantSingletonService.getTenantSlugSmart(tenantId);
}

/**
 * Scenario 2: Multiple Starbucks in California
 * Smart method: Detects collision, uses autoId automatically
 * Manual method: Always uses autoId for guaranteed uniqueness
 */
export async function getChainBusinessSlugs(tenantId: string) {
  const smart = await tenantSingletonService.getTenantSlugSmart(tenantId);
  const regular = await tenantSingletonService.getTenantSlug(tenantId);
  const unique = await tenantSingletonService.getTenantSlugWithAutoId(tenantId);
  
  return { smart, regular, unique };
}

/**
 * Scenario 3: Directory listing with automatic collision handling
 * Smart method handles collisions automatically
 */
export async function getDirectorySlug(tenantId: string) {
  // Smart collision detection - automatic fallback to autoId if needed
  return await tenantSingletonService.getTenantSlugSmart(tenantId);
}
