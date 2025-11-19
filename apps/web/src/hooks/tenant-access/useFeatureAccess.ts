/**
 * Feature Access Hook
 * 
 * Focused hook for checking feature access based on tier and role.
 * Handles both tier-based and role-based permission checking.
 */

import { useMemo } from 'react';
import { hasFeature } from '@/lib/tiers/tier-resolver';
import { forceAdminBypass } from '@/lib/auth/platform-admin';
import type { 
  FeatureAccessResult, 
  ResolvedTier, 
  UserTenantRole, 
  PermissionType, 
  TierBadge,
  PlatformUser
} from './types';

/**
 * Hook for checking feature access
 * 
 * @param tier - The resolved tier information
 * @param userRole - The user's role on the tenant
 * @param platformUser - Platform user information for bypass checks
 * @returns Feature access checking functions
 */
export function useFeatureAccess(
  tier: ResolvedTier | null,
  userRole: UserTenantRole | null,
  platformUser: PlatformUser | null
): FeatureAccessResult {
  
  // Emergency feature name mapping (from Phase 1)
  const EMERGENCY_FEATURE_MAPPING: Record<string, string> = {
    'product_scanning': 'barcode_scan',
    'quick_start_wizard_full': 'quick_start_wizard',
    'propagation': 'propagation_products',
  };

  const normalizeFeatureId = (featureId: string): string => {
    return EMERGENCY_FEATURE_MAPPING[featureId] || featureId;
  };

  // Role permission mapping
  const getRolePermissions = (role: UserTenantRole | null): Set<PermissionType> => {
    if (!role) return new Set();
    
    const rolePermissions: Record<UserTenantRole, PermissionType[]> = {
      'OWNER': ['canView', 'canEdit', 'canManage', 'canSupport', 'canAdmin'],
      'ADMIN': ['canView', 'canEdit', 'canManage', 'canSupport'],
      'SUPPORT': ['canView', 'canEdit', 'canManage', 'canSupport'],
      'MANAGER': ['canView', 'canEdit', 'canManage', 'canSupport'],
      'MEMBER': ['canView', 'canEdit'],
      'VIEWER': ['canView'],
    };
    
    return new Set(rolePermissions[role] || []);
  };

  // Feature tier mapping for badges
  const getFeatureTierInfo = (featureId: string) => {
    const featureTierMap: Record<string, { tier: string; badge: string; tooltip: string; color: string }> = {
      // Organization tier features
      'propagation_products': { 
        tier: 'organization', 
        badge: 'ORG', 
        tooltip: 'Requires Organization tier - Upgrade to propagate to all locations',
        color: 'bg-gradient-to-r from-blue-600 to-cyan-600'
      },
      
      // Professional tier features
      'barcode_scan': {
        tier: 'professional',
        badge: 'PRO+',
        tooltip: 'Requires Professional tier or higher - Upgrade for barcode scanning',
        color: 'bg-gradient-to-r from-purple-600 to-pink-600'
      },
      'quick_start_wizard': { 
        tier: 'professional', 
        badge: 'PRO+', 
        tooltip: 'Requires Professional tier or higher - Upgrade for Quick Start wizard',
        color: 'bg-gradient-to-r from-purple-600 to-pink-600'
      },
      
      // Starter tier features
      'storefront': { 
        tier: 'starter', 
        badge: 'STARTER+', 
        tooltip: 'Requires Starter tier or higher - Upgrade for public storefront',
        color: 'bg-blue-600'
      },
      'category_quick_start': { 
        tier: 'starter', 
        badge: 'STARTER+', 
        tooltip: 'Requires Starter tier or higher - Upgrade for category quick start',
        color: 'bg-blue-600'
      },
    };

    return featureTierMap[featureId];
  };

  // Memoized feature access functions
  const featureAccessFunctions = useMemo(() => {
    const checkHasFeature = (featureId: string): boolean => {
      const normalizedFeatureId = normalizeFeatureId(featureId);
      
      // Emergency force bypass for platform admins
      if (forceAdminBypass(platformUser, normalizedFeatureId)) {
        return true;
      }
      
      // Platform bypass
      if (platformUser?.canBypassTier) {
        return true;
      }
      
      // Tier check
      if (!tier) return false;
      return hasFeature(tier, normalizedFeatureId);
    };

    const checkCanAccess = (featureId: string, permissionType: PermissionType): boolean => {
      // Platform bypass
      if (platformUser?.canBypassRole) {
        return true;
      }
      
      // Level 1: Tier check (must have feature in subscription)
      const hasTierAccess = checkHasFeature(featureId);
      if (!hasTierAccess) {
        return false; // No tier access = no access regardless of role
      }
      
      // Level 2: Role check (does user's role allow this action?)
      const permissions = getRolePermissions(userRole);
      return permissions.has(permissionType);
    };

    const getAccessDeniedReason = (featureId: string, permissionType: PermissionType, actionLabel?: string): string | null => {
      // Platform bypass
      if (platformUser?.canBypassRole) {
        return null;
      }
      
      // Level 1: Tier check
      const hasTierAccess = checkHasFeature(featureId);
      if (!hasTierAccess) {
        const tierInfo = getFeatureTierInfo(normalizeFeatureId(featureId));
        return tierInfo?.tooltip || 'This feature is not included in your subscription tier';
      }
      
      // Level 2: Role check
      const permissions = getRolePermissions(userRole);
      if (!permissions.has(permissionType)) {
        const action = actionLabel || {
          'canView': 'view',
          'canEdit': 'edit',
          'canManage': 'manage',
          'canSupport': 'perform this action',
          'canAdmin': 'access admin features',
        }[permissionType] || 'access';
        
        const roleName = userRole || 'your role';
        return `Your role (${roleName}) does not have permission to ${action}`;
      }
      
      return null; // Access granted
    };

    const getFeatureBadge = (featureId: string, permissionType?: PermissionType, actionLabel?: string): TierBadge | null => {
      // Platform bypass - no badges needed
      if (platformUser?.canBypassRole) {
        return null;
      }
      
      // If user has access, no badge needed
      if (permissionType && checkCanAccess(featureId, permissionType)) {
        return null;
      } else if (!permissionType && checkHasFeature(featureId)) {
        return null;
      }
      
      // Get the reason for denial
      const deniedReason = permissionType 
        ? getAccessDeniedReason(featureId, permissionType, actionLabel)
        : (checkHasFeature(featureId) ? null : 'Feature not available in your tier');
      
      if (!deniedReason) return null;
      
      // Get badge styling from tier info
      const tierInfo = getFeatureTierInfo(normalizeFeatureId(featureId));
      if (!tierInfo) {
        return {
          text: 'UPGRADE',
          tooltip: deniedReason,
          colorClass: 'bg-gray-600'
        };
      }
      
      return {
        text: tierInfo.badge,
        tooltip: deniedReason,
        colorClass: tierInfo.color
      };
    };

    return {
      hasFeature: checkHasFeature,
      canAccess: checkCanAccess,
      getAccessDeniedReason,
      getFeatureBadge
    };
  }, [tier, userRole, platformUser]);

  return featureAccessFunctions;
}
