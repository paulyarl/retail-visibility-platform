/**
 * Platform Feature Definitions - Shared Package
 * 
 * Single source of truth for all feature definitions, mappings, and operations.
 * Used by both API and Web workspaces to ensure perfect synchronization.
 */

// Explicit re-exports to avoid conflicts
export type { FeatureCapability as CanonicalFeatureCapability } from './definitions/canonical-features';
export { CANONICAL_FEATURES } from './definitions/canonical-features';

export { LEGACY_FEATURE_MAP, REVERSE_LEGACY_MAP, MIGRATION_GROUPS } from './definitions/legacy-mappings';
export { validateLegacyMapping, getLegacyKeys, isLegacyKey, hasLegacyMappings } from './definitions/legacy-mappings';

export type { TierKey, TierDefinition, PermissionType as TierPermissionType } from './definitions/tier-hierarchies';
export { TIER_HIERARCHY, TIER_DEFINITIONS, FEATURE_TIER_REQUIREMENTS, TIER_PERMISSIONS } from './definitions/tier-hierarchies';
export { getTierLevel, getFeatureTierRequirement, hasFeatureTierAccess, getTierPermissions, hasPermission, getUpgradePath } from './definitions/tier-hierarchies';

export type { FeatureOperation } from './operations/feature-operations';
export { FEATURE_OPERATIONS, getOperationsByCategory, getOperationsByRiskLevel, validateOperation, getOperation } from './operations/feature-operations';

export type { 
  FeatureCapability, 
  TierFeatureRecord, 
  FeatureGateResult, 
  FeatureGateContext, 
  ValidationResult, 
  AlignmentResult,
  PermissionType 
} from './types/index';

// Export all feature definitions and utilities
export * from './definitions/canonical-features';
export * from './definitions/legacy-mappings';
export * from './definitions/tier-hierarchies';
export * from './operations/feature-operations';
export * from './types';
export * from './CapabilityGateEngine';
export * from './CapabilityGatingService';

// Version and alignment helpers
export const FEATURE_DEFINITIONS_VERSION = '1.0.0';
export const ALIGNMENT_VERSION = '1.0.0';

/**
 * Validate that feature definitions are in sync across workspaces
 */
export function validateFeatureAlignment(): {
  isValid: boolean;
  version: string;
  errors: string[];
} {
  // TODO: Implement runtime validation
  return {
    isValid: true,
    version: FEATURE_DEFINITIONS_VERSION,
    errors: []
  };
}

// Package version for alignment validation
export function validateVersion(apiVersion?: string): boolean {
  const currentVersion = FEATURE_DEFINITIONS_VERSION;
  return apiVersion === currentVersion;
}
