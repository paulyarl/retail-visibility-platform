/**
 * Badge Registry Service
 *
 * Single source of truth for all badge type definitions.
 * Loads from the `featured_type_registry` DB table with a 60s in-memory cache.
 * Falls back to static seed data if the DB table is not yet populated.
 *
 * Replaces hardcoded arrays (VALID_FEATURED_TYPES, TENANT_FEATURED_TYPES,
 * PLATFORM_FEATURED_TYPES, FEATURED_TYPE_META) across 12+ files.
 *
 * Pattern mirrors CapabilityConstraintService: DB-driven + cached + static fallback.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

// ====================
// TYPES
// ====================

export interface BadgeTypeMeta {
  id: string;
  tenantId: string | null;  // null = system badge
  key: string;
  label: string;
  description: string | null;
  group: 'tenant' | 'platform';
  icon: string | null;
  color: string | null;
  priority: number;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  autoAssignRule: any | null;
  autoRemoveRule: any | null;
  conflictWith: string[] | null;
}

// ====================
// STATIC FALLBACK
// ====================
// Used when DB table doesn't exist or is empty.
// Matches the seed data in 060_featured_type_registry.sql.

const STATIC_BADGE_TYPES: BadgeTypeMeta[] = [
  { id: 'static-store_selection', tenantId: null, key: 'store_selection', label: 'Store Selection', description: 'Hand-picked by the store owner', group: 'tenant', icon: '🏪', color: 'blue', priority: 50, sortOrder: 1, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-new_arrival', tenantId: null, key: 'new_arrival', label: 'New Arrival', description: 'Recently added products', group: 'tenant', icon: '🆕', color: 'green', priority: 50, sortOrder: 2, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-seasonal', tenantId: null, key: 'seasonal', label: 'Seasonal', description: 'Seasonal or holiday products', group: 'tenant', icon: '🎄', color: 'orange', priority: 50, sortOrder: 3, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-sale', tenantId: null, key: 'sale', label: 'Sale', description: 'Products currently on sale', group: 'tenant', icon: '🏷️', color: 'red', priority: 50, sortOrder: 4, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-staff_pick', tenantId: null, key: 'staff_pick', label: 'Staff Pick', description: 'Recommended by store staff', group: 'tenant', icon: '👍', color: 'purple', priority: 50, sortOrder: 5, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-clearance', tenantId: null, key: 'clearance', label: 'Clearance', description: 'Final sale, while supplies last', group: 'tenant', icon: '🧹', color: 'amber', priority: 50, sortOrder: 6, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-featured', tenantId: null, key: 'featured', label: 'Featured', description: 'General featured products', group: 'tenant', icon: '⭐', color: 'yellow', priority: 50, sortOrder: 7, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-bestseller', tenantId: null, key: 'bestseller', label: 'Bestseller', description: 'Top-selling products across the platform', group: 'platform', icon: '🏆', color: 'gold', priority: 50, sortOrder: 8, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-trending', tenantId: null, key: 'trending', label: 'Trending', description: 'Gaining popularity right now', group: 'platform', icon: '📈', color: 'teal', priority: 50, sortOrder: 9, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-recommended', tenantId: null, key: 'recommended', label: 'Recommended', description: 'Personalized recommendations', group: 'platform', icon: '💡', color: 'indigo', priority: 50, sortOrder: 10, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
  { id: 'static-random_featured', tenantId: null, key: 'random_featured', label: 'Random Featured', description: 'Randomly selected featured products', group: 'platform', icon: '🎲', color: 'pink', priority: 50, sortOrder: 11, isSystem: true, isActive: true, autoAssignRule: null, autoRemoveRule: null, conflictWith: null },
];

// ====================
// CACHE
// ====================

const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedSystemBadges: BadgeTypeMeta[] | null = null;
let cachedTenantBadges: Map<string, BadgeTypeMeta[]> = new Map();
let cacheExpiry = 0;

// ====================
// DB ROW → BadgeTypeMeta
// ====================

function dbRowToMeta(row: any): BadgeTypeMeta {
  return {
    id: row.id,
    tenantId: row.tenant_id ?? null,
    key: row.key,
    label: row.label,
    description: row.description ?? null,
    group: (row.group_type === 'platform' ? 'platform' : 'tenant') as 'tenant' | 'platform',
    icon: row.icon ?? null,
    color: row.color ?? null,
    priority: row.priority ?? 50,
    sortOrder: row.sort_order ?? 0,
    isSystem: row.is_system ?? true,
    isActive: row.is_active ?? true,
    autoAssignRule: row.auto_assign_rule ?? null,
    autoRemoveRule: row.auto_remove_rule ?? null,
    conflictWith: row.conflict_with ?? null,
  };
}

// ====================
// SERVICE
// ====================

/**
 * Get all active system badges (tenant_id IS NULL).
 * Uses cache, falls back to static data.
 */
export async function getSystemBadges(): Promise<BadgeTypeMeta[]> {
  const now = Date.now();
  if (cachedSystemBadges && now < cacheExpiry) {
    return cachedSystemBadges;
  }

  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM featured_type_registry
      WHERE tenant_id IS NULL AND is_active = true
      ORDER BY sort_order ASC
    `;

    if (Array.isArray(rows) && rows.length > 0) {
      cachedSystemBadges = rows.map(dbRowToMeta);
    } else {
      cachedSystemBadges = STATIC_BADGE_TYPES;
    }
    cacheExpiry = now + CACHE_TTL_MS;
  } catch (error) {
    logger.warn('[BadgeRegistryService] Failed to load system badges from DB, using static fallback', undefined, {
      error: (error as Error).message,
    });
    cachedSystemBadges = STATIC_BADGE_TYPES;
    cacheExpiry = now + CACHE_TTL_MS;
  }

  return cachedSystemBadges;
}

/**
 * Get all active badges for a tenant (system + tenant custom).
 */
export async function getTenantBadges(tenantId: string): Promise<BadgeTypeMeta[]> {
  const now = Date.now();
  if (cachedTenantBadges.has(tenantId) && now < cacheExpiry) {
    return cachedTenantBadges.get(tenantId)!;
  }

  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM featured_type_registry
      WHERE (tenant_id IS NULL OR tenant_id = ${tenantId}::text)
        AND is_active = true
      ORDER BY is_system DESC, sort_order ASC
    `;

    if (Array.isArray(rows) && rows.length > 0) {
      const badges = rows.map(dbRowToMeta);
      cachedTenantBadges.set(tenantId, badges);
      cacheExpiry = now + CACHE_TTL_MS;
      return badges;
    } else {
      // DB empty — return static system badges
      const badges = STATIC_BADGE_TYPES;
      cachedTenantBadges.set(tenantId, badges);
      cacheExpiry = now + CACHE_TTL_MS;
      return badges;
    }
  } catch (error) {
    logger.warn('[BadgeRegistryService] Failed to load tenant badges from DB, using static fallback', undefined, {
      error: (error as Error).message,
      tenantId,
    });
    const badges = STATIC_BADGE_TYPES;
    cachedTenantBadges.set(tenantId, badges);
    cacheExpiry = now + CACHE_TTL_MS;
    return badges;
  }
}

/**
 * Get a single badge by key (system badges only, no tenant context).
 */
export async function getBadgeByKey(key: string): Promise<BadgeTypeMeta | null> {
  const systemBadges = await getSystemBadges();
  return systemBadges.find(b => b.key === key) ?? null;
}

/**
 * Get a single badge by key for a specific tenant (checks system + tenant custom).
 */
export async function getTenantBadgeByKey(tenantId: string, key: string): Promise<BadgeTypeMeta | null> {
  const tenantBadges = await getTenantBadges(tenantId);
  return tenantBadges.find(b => b.key === key) ?? null;
}

/**
 * Get all badge keys (system only). Useful for validation.
 */
export async function getAllBadgeKeys(): Promise<string[]> {
  const systemBadges = await getSystemBadges();
  return systemBadges.map(b => b.key);
}

/**
 * Get badge keys for a specific tenant (system + custom).
 */
export async function getTenantBadgeKeys(tenantId: string): Promise<string[]> {
  const tenantBadges = await getTenantBadges(tenantId);
  return tenantBadges.map(b => b.key);
}

/**
 * Get badges by group ('tenant' or 'platform') from system badges.
 */
export async function getBadgesByGroup(group: 'tenant' | 'platform'): Promise<BadgeTypeMeta[]> {
  const systemBadges = await getSystemBadges();
  return systemBadges.filter(b => b.group === group);
}

/**
 * Validate if a badge key is a known system badge.
 */
export async function isValidBadgeKey(key: string): Promise<boolean> {
  const keys = await getAllBadgeKeys();
  return keys.includes(key);
}

/**
 * Check if a badge key is platform-controlled.
 */
export async function isPlatformControlledKey(key: string): Promise<boolean> {
  const badge = await getBadgeByKey(key);
  return badge?.group === 'platform';
}

/**
 * Invalidate the in-memory cache. Call after CRUD operations.
 */
export function invalidateBadgeRegistryCache(): void {
  cachedSystemBadges = null;
  cachedTenantBadges = new Map();
  cacheExpiry = 0;
}

/**
 * Get all system badges that have auto-assign or auto-remove rules.
 */
export async function getBadgesWithRules(): Promise<BadgeTypeMeta[]> {
  const badges = await getSystemBadges();
  return badges.filter(b => b.autoAssignRule || b.autoRemoveRule);
}

/**
 * Get all conflict pairs from the registry (badges that conflict with each other).
 */
export async function getConflictPairs(): Promise<Array<{ badgeKey: string; conflictsWith: string[] }>> {
  const badges = await getSystemBadges();
  return badges
    .filter(b => b.conflictWith && b.conflictWith.length > 0)
    .map(b => ({ badgeKey: b.key, conflictsWith: b.conflictWith! }));
}

// ====================
// TENANT CRUD METHODS
// ====================

export interface CreateTenantBadgeInput {
  tenantId: string;
  key: string;
  label: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  priority?: number;
  sortOrder?: number;
}

export interface UpdateTenantBadgeInput {
  label?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  priority?: number;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Count custom (non-system) badges for a tenant.
 * Used for tier-gated slot limit enforcement.
 */
export async function countTenantCustomBadges(tenantId: string): Promise<number> {
  try {
    const result = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count FROM featured_type_registry
      WHERE tenant_id = ${tenantId}::text AND is_system = false
    `;
    return (result as any[])[0]?.count ?? 0;
  } catch (error) {
    logger.warn('[BadgeRegistryService] Failed to count tenant custom badges', undefined, {
      error: (error as Error).message,
      tenantId,
    });
    return 0;
  }
}

/**
 * Create a custom badge for a tenant.
 * Caller is responsible for tier-gate slot limit check before calling.
 */
export async function createTenantBadge(input: CreateTenantBadgeInput): Promise<BadgeTypeMeta> {
  const row = await prisma.featured_type_registry.create({
    data: {
      tenant_id: input.tenantId,
      key: input.key,
      label: input.label,
      description: input.description ?? null,
      group_type: 'tenant',
      icon: input.icon ?? null,
      color: input.color ?? null,
      priority: input.priority ?? 50,
      sort_order: input.sortOrder ?? 100,
      is_system: false,
      is_active: true,
      conflict_with: [],
    },
  });

  invalidateBadgeRegistryCache();
  return dbRowToMeta(row);
}

/**
 * Update a custom badge for a tenant.
 * Only non-system badges owned by the tenant can be updated.
 */
export async function updateTenantBadge(
  tenantId: string,
  badgeId: string,
  input: UpdateTenantBadgeInput
): Promise<BadgeTypeMeta | null> {
  // Verify ownership: badge must belong to this tenant and not be system
  const existing = await prisma.featured_type_registry.findFirst({
    where: { id: badgeId, tenant_id: tenantId, is_system: false },
  });
  if (!existing) return null;

  const row = await prisma.featured_type_registry.update({
    where: { id: badgeId },
    data: {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }),
      ...(input.isActive !== undefined && { is_active: input.isActive }),
      updated_at: new Date(),
    },
  });

  invalidateBadgeRegistryCache();
  return dbRowToMeta(row);
}

/**
 * Delete a custom badge for a tenant.
 * Only non-system badges owned by the tenant can be deleted.
 */
export async function deleteTenantBadge(tenantId: string, badgeId: string): Promise<boolean> {
  const existing = await prisma.featured_type_registry.findFirst({
    where: { id: badgeId, tenant_id: tenantId, is_system: false },
  });
  if (!existing) return false;

  await prisma.featured_type_registry.delete({
    where: { id: badgeId },
  });

  invalidateBadgeRegistryCache();
  return true;
}

/**
 * Get all custom badges for a tenant (non-system only).
 */
export async function getTenantCustomBadges(tenantId: string): Promise<BadgeTypeMeta[]> {
  try {
    const rows = await prisma.$queryRaw`
      SELECT * FROM featured_type_registry
      WHERE tenant_id = ${tenantId}::text AND is_system = false
      ORDER BY sort_order ASC
    `;
    return (rows as any[]).map(dbRowToMeta);
  } catch (error) {
    logger.warn('[BadgeRegistryService] Failed to load tenant custom badges', undefined, {
      error: (error as Error).message,
      tenantId,
    });
    return [];
  }
}
