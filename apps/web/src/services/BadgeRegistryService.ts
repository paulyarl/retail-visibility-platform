/**
 * Badge Registry Service (Frontend Singleton)
 *
 * Fetches badge type definitions from the backend badge registry API.
 * Provides a static fallback matching the 11 system badges for SSR and
 * when the API is unavailable.
 *
 * Extends TenantApiSingleton for automatic auth, caching, and cache invalidation.
 * Replaces hardcoded FEATURED_TYPE_META, TENANT_FEATURED_TYPES,
 * PLATFORM_FEATURED_TYPES, and ALL_FEATURED_TYPES arrays across frontend files.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface BadgeTypeMeta {
  id: string;
  tenantId: string | null;
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

export const STATIC_BADGE_TYPES: BadgeTypeMeta[] = [
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
// SERVICE
// ====================

class BadgeRegistryService extends TenantApiSingleton {
  private static instance: BadgeRegistryService;

  private systemBadges: BadgeTypeMeta[] = STATIC_BADGE_TYPES;
  private tenantBadgesCache: Map<string, BadgeTypeMeta[]> = new Map();
  private systemLoaded = false;

  private constructor() {
    super('badge-registry-singleton', { ttl: 10 * 60 * 1000 });
  }

  public static getInstance(): BadgeRegistryService {
    if (!BadgeRegistryService.instance) {
      BadgeRegistryService.instance = new BadgeRegistryService();
    }
    return BadgeRegistryService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['badge-registry-system', 'badge-registry-tenant-*', 'badge-registry-custom-*', 'badge-registry-validation-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`badge-registry-tenant-${tenantId}`);
      this.invalidateCache(`badge-registry-custom-${tenantId}`);
      this.invalidateCache(`badge-registry-validation-${tenantId}`);
      this.tenantBadgesCache.delete(tenantId);
    } else {
      this.invalidateCache('badge-registry-system');
      this.tenantBadgesCache.clear();
    }
  }

  /**
   * Fetch system badges from the public API endpoint.
   * Falls back to static data on error.
   */
  async fetchSystemBadges(): Promise<BadgeTypeMeta[]> {
    try {
      const result = await this.makePublicRequest<{ badges: BadgeTypeMeta[] }>(
        '/api/public/badge-registry',
        {},
        'badge-registry-system',
        this.cacheTTL
      );
      if (result.success && result.data?.badges && Array.isArray(result.data.badges) && result.data.badges.length > 0) {
        this.systemBadges = result.data.badges;
        this.systemLoaded = true;
        return result.data.badges;
      }
      return STATIC_BADGE_TYPES;
    } catch {
      return STATIC_BADGE_TYPES;
    }
  }

  /**
   * Fetch tenant badges (system + custom) from the tenant API endpoint.
   * Falls back to system badges on error.
   */
  async fetchTenantBadges(tenantId: string): Promise<BadgeTypeMeta[]> {
    if (this.tenantBadgesCache.has(tenantId)) {
      return this.tenantBadgesCache.get(tenantId)!;
    }

    try {
      const result = await this.makeDefaultRequest<{ badges: BadgeTypeMeta[] }>(
        `/api/tenants/${tenantId}/badge-registry`,
        {},
        `badge-registry-tenant-${tenantId}`,
        this.cacheTTL,
        { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
      );
      if (result.success && result.data?.badges && Array.isArray(result.data.badges) && result.data.badges.length > 0) {
        this.tenantBadgesCache.set(tenantId, result.data.badges);
        return result.data.badges;
      }
      const fallback = await this.fetchSystemBadges();
      this.tenantBadgesCache.set(tenantId, fallback);
      return fallback;
    } catch {
      const fallback = this.systemBadges;
      this.tenantBadgesCache.set(tenantId, fallback);
      return fallback;
    }
  }

  /**
   * Get cached system badges (synchronous, for SSR or immediate use).
   */
  getSystemBadges(): BadgeTypeMeta[] {
    return this.systemBadges;
  }

  /**
   * Get a single badge by key from cached system badges.
   */
  getBadgeByKey(key: string): BadgeTypeMeta | null {
    return this.systemBadges.find(b => b.key === key) ?? null;
  }

  /**
   * Get badges by group from cached system badges.
   */
  getBadgesByGroup(group: 'tenant' | 'platform'): BadgeTypeMeta[] {
    return this.systemBadges.filter(b => b.group === group);
  }

  /**
   * Get all badge keys from cached system badges.
   */
  getAllBadgeKeys(): string[] {
    return this.systemBadges.map(b => b.key);
  }

  /**
   * Get the CSS color class for a badge type.
   */
  getBadgeColorClass(key: string): string {
    const badge = this.getBadgeByKey(key);
    if (!badge?.color) return 'bg-gray-100 text-gray-700 border-gray-300';

    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-700 border-blue-300',
      green: 'bg-green-100 text-green-700 border-green-300',
      orange: 'bg-orange-100 text-orange-700 border-orange-300',
      red: 'bg-red-100 text-red-700 border-red-300',
      purple: 'bg-purple-100 text-purple-700 border-purple-300',
      amber: 'bg-amber-100 text-amber-700 border-amber-300',
      yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      gold: 'bg-yellow-100 text-yellow-800 border-yellow-400',
      teal: 'bg-teal-100 text-teal-700 border-teal-300',
      indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
      pink: 'bg-pink-100 text-pink-700 border-pink-300',
    };

    return colorMap[badge.color] || 'bg-gray-100 text-gray-700 border-gray-300';
  }

  /**
   * Invalidate tenant cache (call after badge CRUD operations).
   */
  invalidateTenantCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantBadgesCache.delete(tenantId);
      this.invalidateCache(`badge-registry-tenant-${tenantId}`);
      this.invalidateCache(`badge-registry-custom-${tenantId}`);
      this.invalidateCache(`badge-registry-validation-${tenantId}`);
    } else {
      this.tenantBadgesCache.clear();
      this.invalidateCache('badge-registry-system');
    }
  }

  /**
   * Fetch badge rule validation results for a tenant.
   * Returns toAssign, toRemove, and conflicts arrays.
   */
  async fetchBadgeRuleValidation(tenantId: string): Promise<{
    toAssign: Array<{ inventoryItemId: string; badgeKey: string; reason: string }>;
    toRemove: Array<{ inventoryItemId: string; badgeKey: string; reason: string }>;
    conflicts: Array<{ inventoryItemId: string; badgeKey: string; conflictsWith: string[] }>;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        toAssign: Array<{ inventoryItemId: string; badgeKey: string; reason: string }>;
        toRemove: Array<{ inventoryItemId: string; badgeKey: string; reason: string }>;
        conflicts: Array<{ inventoryItemId: string; badgeKey: string; conflictsWith: string[] }>;
      }>(
        `/api/tenants/${tenantId}/badge-registry/validation`,
        {},
        `badge-registry-validation-${tenantId}`,
        this.cacheTTL,
        { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
      );
      if (result.success && result.data) {
        return result.data;
      }
      return { toAssign: [], toRemove: [], conflicts: [] };
    } catch {
      return { toAssign: [], toRemove: [], conflicts: [] };
    }
  }

  /**
   * Fetch custom (non-system) badges for a tenant.
   * Returns badges, usedSlots, and hasAccess (tier gate).
   */
  async fetchTenantCustomBadges(tenantId: string): Promise<{
    badges: BadgeTypeMeta[];
    usedSlots: number;
    hasAccess: boolean;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        badges: BadgeTypeMeta[];
        usedSlots: number;
        hasAccess: boolean;
      }>(
        `/api/tenants/${tenantId}/badge-registry/custom`,
        {},
        `badge-registry-custom-${tenantId}`,
        this.cacheTTL,
        { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
      );
      if (result.success && result.data) {
        return result.data;
      }
      return { badges: [], usedSlots: 0, hasAccess: false };
    } catch {
      return { badges: [], usedSlots: 0, hasAccess: false };
    }
  }

  /**
   * Create a custom badge for a tenant.
   */
  async createCustomBadge(tenantId: string, input: {
    key: string;
    label: string;
    description?: string;
    icon?: string;
    color?: string;
  }): Promise<BadgeTypeMeta | null> {
    try {
      const result = await this.makeDefaultRequest<{ badge: BadgeTypeMeta }>(
        `/api/tenants/${tenantId}/badge-registry/custom`,
        { method: 'POST', body: JSON.stringify(input) },
        undefined,
        undefined,
        { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
      );
      if (result.success && result.data?.badge) {
        this.invalidateTenantCache(tenantId);
        return result.data.badge;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Update a custom badge for a tenant.
   */
  async updateCustomBadge(tenantId: string, badgeId: string, input: {
    label?: string;
    description?: string;
    icon?: string;
    color?: string;
    isActive?: boolean;
  }): Promise<BadgeTypeMeta | null> {
    try {
      const result = await this.makeDefaultRequest<{ badge: BadgeTypeMeta }>(
        `/api/tenants/${tenantId}/badge-registry/custom/${badgeId}`,
        { method: 'PUT', body: JSON.stringify(input) },
        undefined,
        undefined,
        { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
      );
      if (result.success && result.data?.badge) {
        this.invalidateTenantCache(tenantId);
        return result.data.badge;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Delete a custom badge for a tenant.
   */
  async deleteCustomBadge(tenantId: string, badgeId: string): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/tenants/${tenantId}/badge-registry/custom/${badgeId}`,
        { method: 'DELETE' },
        undefined,
        undefined,
        { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
      );
      if (result.success) {
        this.invalidateTenantCache(tenantId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const badgeRegistryService = BadgeRegistryService.getInstance();
export default badgeRegistryService;
