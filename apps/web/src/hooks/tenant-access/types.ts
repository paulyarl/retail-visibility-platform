/**
 * Shared Types for Tenant Access System
 * 
 * Centralized type definitions for the new modular hook architecture.
 * Replaces scattered types across multiple files.
 */

// Import and re-export existing types for compatibility
import type {
  ResolvedTier,
  TierInfo,
  TierFeature,
  TierLimits
} from '@/lib/tiers/tier-resolver';

export type {
  ResolvedTier,
  TierInfo,
  TierFeature,
  TierLimits
};

// User and role types
export type UserTenantRole = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'MANAGER' | 'VIEWER';
export type PermissionType = 'canView' | 'canEdit' | 'canManage' | 'canSupport' | 'canAdmin';

// Platform user information
export interface PlatformUser {
  id: string;
  userId: string;
  role: string;
  email?: string;
  canBypassTier: boolean;
  canBypassRole: boolean;
}

// Tenant usage statistics
export interface TenantUsage {
  products: UsageMetric;
  locations: UsageMetric;
  users: UsageMetric;
  apiCalls: UsageMetric;
  storageGB?: UsageMetric;
}

export interface UsageMetric {
  current: number;
  limit: number | null;
  percent: number;
  isUnlimited: boolean;
}

// Feature access information
export interface FeatureAccess {
  hasAccess: boolean;
  source: 'tier' | 'role' | 'admin' | 'override';
  reason?: string;
  requiredTier?: string;
  requiredRole?: string;
  upgradeUrl?: string;
}

// Tier badge for UI display
export interface TierBadge {
  text: string;
  tooltip: string;
  colorClass: string;
  upgradeUrl?: string;
}

// Main hook return interface
export interface TenantAccessResult {
  // Loading states
  loading: boolean;
  error: string | null;
  
  // Tier context
  tier: ResolvedTier | null;
  organization?: TierInfo;
  isChain: boolean;
  
  // User context
  userRole: UserTenantRole | null;
  platformRole: string | null;
  canBypassTier: boolean;
  canBypassRole: boolean;
  
  // Feature access methods
  hasFeature: (featureId: string) => boolean;
  canAccess: (featureId: string, permissionType: PermissionType) => boolean;
  getFeatureBadge: (featureId: string, permissionType?: PermissionType, actionLabel?: string) => TierBadge | null;
  getAccessDeniedReason: (featureId: string, permissionType: PermissionType, actionLabel?: string) => string | null;
  
  // Usage and limits
  usage: TenantUsage | null;
  isLimitReached: (limitType: keyof TenantUsage) => boolean;
  getUsagePercentage: (limitType: keyof TenantUsage) => number;
  
  // Actions
  refresh: () => Promise<void>;
}

// Individual hook return types
export interface TierDataResult {
  tier: ResolvedTier | null;
  organization?: TierInfo;
  tenant?: TierInfo;
  isChain: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface UserRoleResult {
  tenantRole: UserTenantRole | null;
  platformRole: string | null;
  platformUser: PlatformUser | null;
  canBypassTier: boolean;
  canBypassRole: boolean;
  loading: boolean;
  error: string | null;
}

export interface FeatureAccessResult {
  hasFeature: (featureId: string) => boolean;
  canAccess: (featureId: string, permissionType: PermissionType) => boolean;
  getFeatureBadge: (featureId: string, permissionType?: PermissionType, actionLabel?: string) => TierBadge | null;
  getAccessDeniedReason: (featureId: string, permissionType: PermissionType, actionLabel?: string) => string | null;
}

export interface UsageDataResult {
  usage: TenantUsage | null;
  isLimitReached: (limitType: keyof TenantUsage) => boolean;
  getUsagePercentage: (limitType: keyof TenantUsage) => number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// API response types
export interface AccessContextResponse {
  // User context
  user: {
    id: string;
    role: string;
    platformRole: string;
    tenantRole: string | null;
    canBypassTier: boolean;
    canBypassRole: boolean;
  };
  
  // Tier context
  tier: {
    effective: ResolvedTier;
    organization?: TierInfo;
    tenant?: TierInfo;
    isChain: boolean;
  };
  
  // Pre-computed feature access
  features: Record<string, FeatureAccess>;
  
  // Usage limits
  usage: TenantUsage;
  
  // Cache metadata
  cacheKey: string;
  expiresAt: string;
}

// Hook configuration
export interface TenantAccessConfig {
  // Cache settings
  staleTime?: number;
  cacheTime?: number;
  refetchInterval?: number;
  
  // Feature flags
  useUnifiedAPI?: boolean;
  enableBackgroundRefresh?: boolean;
  
  // Debug options
  enableLogging?: boolean;
}
