/**
 * Tenant Access System - Phase 2 Architecture
 * 
 * New modular hook architecture for tenant access control.
 * Replaces monolithic useTenantTier.ts with focused, maintainable components.
 */

// Main hook (recommended for new components)
export { useTenantAccess } from './useTenantAccess';

// Focused hooks (for advanced use cases)
export { useTierData } from './useTierData';
export { useUserRole } from './useUserRole';
export { useUsageData } from './useUsageData';
export { useFeatureAccess } from './useFeatureAccess';

// Legacy compatibility (will be removed in Phase 3)
export { useTenantTierCompat } from './useTenantAccess';

// Types
export type {
  TenantAccessResult,
  TierDataResult,
  UserRoleResult,
  UsageDataResult,
  FeatureAccessResult,
  TenantUsage,
  UsageMetric,
  FeatureAccess,
  TierBadge,
  PlatformUser,
  UserTenantRole,
  PermissionType,
  ResolvedTier,
  TierInfo,
  TierFeature,
  TierLimits
} from './types';

/**
 * Migration Guide:
 * 
 * OLD (Phase 1):
 * ```typescript
 * import { useTenantTier } from '@/hooks/dashboard/useTenantTier';
 * const { canAccess, hasFeature } = useTenantTier(tenantId);
 * ```
 * 
 * NEW (Phase 2):
 * ```typescript
 * import { useTenantAccess } from '@/hooks/tenant-access';
 * const { canAccess, hasFeature } = useTenantAccess(tenantId);
 * ```
 * 
 * The interface is the same, but the implementation is now modular and performant.
 */
