/**
 * Featured Options Utility
 *
 * Domain helpers for working with the featured_options capability.
 * Provides classification, display, and filtering logic for featured types
 * across tenant, admin, and public scopes.
 */

import {
  FeaturedType as FeaturedTypeInternal,
  FeaturedOptionsState,
} from '@/services/CapabilityResolutionService';

// Re-export FeaturedType for consumers
export type FeaturedType = FeaturedTypeInternal;

// ====================
// CLASSIFICATION
// ====================

/** Tenant-controlled featured types (merchants can tag their own products) */
export const TENANT_FEATURED_TYPES: FeaturedType[] = [
  'store_selection',
  'new_arrival',
  'seasonal',
  'sale',
  'staff_pick',
  'clearance',
  'featured',
];

/** Platform-controlled featured types (system/algorithm-driven) */
export const PLATFORM_FEATURED_TYPES: FeaturedType[] = [
  'bestseller',
  'trending',
  'recommended',
  'random_featured',
];

/** All featured types in canonical order */
export const ALL_FEATURED_TYPES: FeaturedType[] = [
  ...TENANT_FEATURED_TYPES,
  ...PLATFORM_FEATURED_TYPES,
];

// ====================
// TYPE GUARDS
// ====================

export function isTenantControlled(type: FeaturedType): boolean {
  return TENANT_FEATURED_TYPES.includes(type);
}

export function isPlatformControlled(type: FeaturedType): boolean {
  return PLATFORM_FEATURED_TYPES.includes(type);
}

// ====================
// DISPLAY HELPERS
// ====================

export interface FeaturedTypeMeta {
  key: FeaturedType;
  label: string;
  description: string;
  group: 'tenant' | 'platform';
  icon: string;
  color: string;
}

const FEATURED_TYPE_META: Record<FeaturedType, FeaturedTypeMeta> = {
  store_selection: {
    key: 'store_selection',
    label: 'Store Selection',
    description: 'Hand-picked by the store owner',
    group: 'tenant',
    icon: '🏪',
    color: 'blue',
  },
  new_arrival: {
    key: 'new_arrival',
    label: 'New Arrival',
    description: 'Recently added products',
    group: 'tenant',
    icon: '🆕',
    color: 'green',
  },
  seasonal: {
    key: 'seasonal',
    label: 'Seasonal',
    description: 'Seasonal or holiday products',
    group: 'tenant',
    icon: '🎄',
    color: 'orange',
  },
  sale: {
    key: 'sale',
    label: 'Sale',
    description: 'Products currently on sale',
    group: 'tenant',
    icon: '🏷️',
    color: 'red',
  },
  staff_pick: {
    key: 'staff_pick',
    label: 'Staff Pick',
    description: 'Recommended by store staff',
    group: 'tenant',
    icon: '👍',
    color: 'purple',
  },
  clearance: {
    key: 'clearance',
    label: 'Clearance',
    description: 'Final sale, while supplies last',
    group: 'tenant',
    icon: '🧹',
    color: 'amber',
  },
  featured: {
    key: 'featured',
    label: 'Featured',
    description: 'General featured products',
    group: 'tenant',
    icon: '⭐',
    color: 'yellow',
  },
  bestseller: {
    key: 'bestseller',
    label: 'Bestseller',
    description: 'Top-selling products across the platform',
    group: 'platform',
    icon: '🏆',
    color: 'gold',
  },
  trending: {
    key: 'trending',
    label: 'Trending',
    description: 'Gaining popularity right now',
    group: 'platform',
    icon: '📈',
    color: 'teal',
  },
  recommended: {
    key: 'recommended',
    label: 'Recommended',
    description: 'Personalized recommendations',
    group: 'platform',
    icon: '💡',
    color: 'indigo',
  },
  random_featured: {
    key: 'random_featured',
    label: 'Random Featured',
    description: 'Randomly selected featured products',
    group: 'platform',
    icon: '🎲',
    color: 'pink',
  },
};

export function getFeaturedTypeMeta(type: FeaturedType): FeaturedTypeMeta {
  return FEATURED_TYPE_META[type];
}

export function getFeaturedTypeLabel(type: FeaturedType): string {
  return FEATURED_TYPE_META[type]?.label || type;
}

export function getFeaturedTypeIcon(type: FeaturedType): string {
  return FEATURED_TYPE_META[type]?.icon || '⭐';
}

// ====================
// CAPABILITY-AWARE FILTERING
// ====================

/**
 * Filter a list of featured types to only those allowed by the tenant's capability state.
 */
export function filterAllowedFeaturedTypes(
  types: FeaturedType[],
  state: FeaturedOptionsState
): FeaturedType[] {
  if (!state.enabled) return [];
  return types.filter(t => state.allowedTypes.includes(t));
}

/**
 * Filter a list of featured types to only those effectively enabled (tier allows AND merchant enabled).
 */
export function filterEffectiveFeaturedTypes(
  types: FeaturedType[],
  state: FeaturedOptionsState
): FeaturedType[] {
  if (!state.enabled) return [];
  return types.filter(t => state.effectiveTypes.includes(t));
}

/**
 * Get all tenant-controlled types allowed by capability state.
 */
export function getAllowedTenantTypes(state: FeaturedOptionsState): FeaturedType[] {
  if (!state.enabled || !state.tenantEnabled) return [];
  return state.allowedTenantTypes;
}

/**
 * Get all platform-controlled types allowed by capability state.
 */
export function getAllowedPlatformTypes(state: FeaturedOptionsState): FeaturedType[] {
  if (!state.enabled || !state.platformEnabled) return [];
  return state.allowedPlatformTypes;
}

/**
 * Check if a specific featured type is allowed by capability state.
 */
export function isFeaturedTypeAllowed(type: FeaturedType, state: FeaturedOptionsState): boolean {
  return state.enabled && state.allowedTypes.includes(type);
}

/**
 * Check if a specific featured type is effectively enabled (tier allows AND merchant enabled).
 */
export function isFeaturedTypeEffective(type: FeaturedType, state: FeaturedOptionsState): boolean {
  return state.enabled && state.effectiveTypes.includes(type);
}

/**
 * Group allowed types by control group (tenant vs platform).
 */
export function groupAllowedTypes(state: FeaturedOptionsState): {
  tenant: FeaturedTypeMeta[];
  platform: FeaturedTypeMeta[];
} {
  return {
    tenant: state.allowedTenantTypes.map(getFeaturedTypeMeta),
    platform: state.allowedPlatformTypes.map(getFeaturedTypeMeta),
  };
}

// ====================
// FEATURE KEY MAPPING
// ====================

/**
 * Map a FeaturedType to its corresponding feature key in the capability system.
 */
export function featuredTypeToFeatureKey(type: FeaturedType): string {
  return `featured_${type}`;
}

/**
 * Map a feature key back to a FeaturedType, if it matches.
 */
export function featureKeyToFeaturedType(key: string): FeaturedType | null {
  if (!key.startsWith('featured_')) return null;
  const suffix = key.slice('featured_'.length);
  if (ALL_FEATURED_TYPES.includes(suffix as FeaturedType)) {
    return suffix as FeaturedType;
  }
  return null;
}

// ====================
// BADGE / DISPLAY HELPERS
// ====================

/**
 * Get the CSS color class for a featured type badge.
 */
export function getFeaturedBadgeColorClass(type: FeaturedType): string {
  const meta = FEATURED_TYPE_META[type];
  if (!meta) return 'bg-gray-100 text-gray-700 border-gray-300';

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

  return colorMap[meta.color] || 'bg-gray-100 text-gray-700 border-gray-300';
}
