/**
 * Shared Types for Feature Definitions
 * 
 * Common types used across API and Web workspaces.
 */

export interface FeatureCapability {
  key: string;
  name: string;
  description: string;
  category: 'product' | 'commerce' | 'analytics' | 'branding' | 'integration' | 'ui';
  metadata?: Record<string, any>;
}

export interface TierFeatureRecord {
  id: string;
  featureKey: string;
  featureName: string;
  isEnabled: boolean;
  isInherited: boolean;
  isHighlighted?: boolean;
  highlightOrder?: number;
  highlightDescription?: string | null;
  marketingName?: string | null;
}

export interface FeatureGateResult {
  hasAccess: boolean;
  accessDeniedReason: string | null;
  canUpgrade: boolean;
  requiredTier: string;
  requiredPermission: string;
  operation: any;
}

export interface FeatureGateContext {
  tier?: {
    key: string;
    name: string;
  };
  userRole?: string;
  platformUser?: {
    canBypassAll?: boolean;
    canBypassRole?: boolean;
  };
}

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
}

export interface AlignmentResult {
  isAligned: boolean;
  issues: string[];
  timestamp: Date;
}

export type PermissionType = 'canView' | 'canEdit' | 'canManage' | 'canSupport' | 'canAdmin';
