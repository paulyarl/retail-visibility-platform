/**
 * ID Generation Utilities
 * 
 * Provides short, URL-friendly ID generation for tenants and items
 * to replace long UUIDs and composite IDs.
 */

import { customAlphabet } from 'nanoid';

/**
 * Generates short tenant IDs
 * Format: tenant-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateTenantId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `t-${nanoid()}`;
}

/**
 * Generates short user IDs
 * Format: tenant-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateUserId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `user-${nanoid()}`;
}

/**
 * Generates short user tenant IDs
 * Format: tenant-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateUserTenantId(userId: string = 'user',tenantId: string = 'tenant'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `ut-${userId}-${tenantId}-${nanoid()}`;
}
// id: `ut_${tenantId}_${user.id}`,
/**
 * Generates short item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateItemId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `i-${nanoid()}`;
}

/**
 * Generates short SKUs for quick-start items
 * Format: qs-abc123 (10 chars vs 60+ current)
 * Prefix indicates source, short suffix for uniqueness
 */
export function generateQuickStartSku(index?: number): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  const suffix = index !== undefined ? index.toString().padStart(3, '0') : nanoid();
  return `qs-${suffix}`;
}

/**
 * Generates readable SKUs with optional prefix
 * Format: SKU-abc123 or CUSTOM-abc123
 */
export function generateSku(prefix: string = 'SKU'): string {
  const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
  return `${prefix}-${nanoid()}`;
}

/**
 * Generates short photo asset IDs
 * Format: photo-abc123 (13 chars)
 */
export function generatePhotoId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `p-${nanoid()}`;
}

/**
 * Generates short session IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateSessionId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `s-${nanoid()}`;
}

/**
 * Generates short tier IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateTierId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `tier-${nanoid()}`;
}

/**
 * Generates short tier feature IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateFeatureId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `feat-${nanoid()}`;
}

/**
 * Generates short quick start category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateQsCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `qscat-${nanoid()}`;
}

/**
 * Generates short quick start with optional prefix
 * Format: SKU-abc123 or CUSTOM-abc123
 */
export function generateQuickStart(prefix: string = 'QS'): string {
  const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
  return `${prefix}-${nanoid()}`;
}
/**
 * Example outputs:
 * 
 * Tenant ID: t-a3k9m2x7 (9 chars vs 36 for UUID)
 * Item ID: i-b4n8p1y6 (10 chars)
 * Quick Start SKU: qs-001, qs-002, etc. (6-10 chars vs 60+)
 * Regular SKU: SKU-A3K9M2X7 (12 chars)
 * Photo ID: p-c5q7r3z8 (10 chars)
 * Session ID: s-d6w4t2v9 (10 chars)
 * 
 * Benefits:
 * - 70-80% shorter than current IDs
 * - URL-friendly (no special chars)
 * - Readable and shareable
 * - Unique (collision probability: ~1 in 2.8 trillion for 8 chars)
 * - Sortable by creation time (if using sequential suffix)
 * - Professional appearance
 */
