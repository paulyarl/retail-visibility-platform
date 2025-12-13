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
  return `tid-${nanoid()}`;
}

/**
 * Generates short user IDs
 * Format: tenant-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateUserId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `uid-${nanoid()}`;
}

/**
 * Generates short user tenant IDs
 * Format: tenant-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateUserTenantId(userId: string = 'uid',tenantId: string = 'tid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `utid-${userId}-${tenantId}-${nanoid()}`;
}
// id: `ut_${tenantId}_${user.id}`,
/**
 * Generates short item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
/**
 * Generates short category mirror IDs
 * Format: tenant-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateCategoryMirrorId(catId: string,tenantId: string = 'tid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `cmid-${tenantId}-${catId}-${nanoid()}`;
}
// id: `ut_${tenantId}_${user.id}`,
/**
 * Generates short item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateItemId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `sid-${nanoid()}`;
}
// id: `ciid_${tenantId}_${user.id}`,
/**
 * Generates clover item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateCloverItemId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `csid-${nanoid()}`;
}
// id: `cigid_${tenantId}_${user.id}`,
/**
 * Generates clover integration IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateCloverIntegrationId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `cigid-${nanoid()}`;
}

// id: `cimid_${tenantId}_${user.id}`,
/**
 * Generates clover item/SKU mappings IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateCloverItemMappingsId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `csmid-${nanoid()}`;
}


/**
 * Generates short SKUs for quick-start items
 * Format: qs-abc123 (10 chars vs 60+ current)
 * Prefix indicates source, short suffix for uniqueness
 */
export function generateQuickStartSku(index?: number): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  const suffix = index !== undefined ? index.toString().padStart(3, '0') : nanoid();
  return `qsid-${suffix}`;
}

/**
 * Generates short photo asset IDs
 * Format: photo-abc123 (13 chars)
 */
export function generatePhotoId(tenantId?: string,itemId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `pid-${tenantId}-${itemId}-${nanoid()}`;
}

/**
 * Generates short session IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateSessionId(tenantId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `sid-${tenantId}-${nanoid()}`;
}

/**
 * Generates short audit logs IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateAuditId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `alid-${nanoid()}`;
}

/**
 * Generates short tier IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateTierId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `tid-${nanoid()}`;
}

/**
 * Generates short tier change IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateTierChangeId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `tcid-${nanoid()}`;
}

/**
 * Generates short tier feature IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateFeatureId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `tfid-${nanoid()}`;
}

/**
 * Generates short quick start category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateQsCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `qsctid-${nanoid()}`;
}

/**
 * Generates short directory category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateDcCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `dccatid-${nanoid()}`;
}

/**
 * Generates clover quick start category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `ccid-${nanoid()}`;
}
/**
 * Generates clover OAuth change log IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverOauthChangeLogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `ocid-${nanoid()}`;
}

/**
 * Generates clover sync logs IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverSyncLogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `csid-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateGbpHoursSyncLogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `bhsid-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateSpecialHoursId(tenantId: string = 'shid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `shid-${tenantId}-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateFeedPushJobId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `fpid-${nanoid()}`;
}

/**
 * Generates short directory category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateProductCatId(tenantId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `scid-${tenantId}-${nanoid()}`;
}

/**
 * Generates directory featured IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateDirectoryFeaturedId(tenantId: string = 'tid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `dfid-${tenantId}-${nanoid()}`;
}

/**
 * Generates organization IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateOrganizationId(ownerId: string = 'oid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `oid-${ownerId}-${nanoid()}`;
}

/**
 * Generates short quick start with optional prefix
 * Format: SKU-abc123 or CUSTOM-abc123
 */
export function generateQuickStart(prefix: string = 'qsid'): string {
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
