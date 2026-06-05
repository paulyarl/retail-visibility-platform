/**
 * Capability Gate Component
 * 
 * React component for capability-based feature gating
 * Extends the FeatureGate system to handle sophisticated capability gating
 */

import React from 'react';
import { useCapabilityGate, useCapabilityUpgradePath } from '@/hooks/useCapabilityGate';
import { UpgradePrompt } from './UpgradePrompt';

export interface CapabilityGateProps {
  capabilityType: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
}

/**
 * Component that conditionally renders children based on capability access
 */
export function CapabilityGate({
  capabilityType,
  children,
  fallback,
  showUpgradePrompt = true,
  className = ''
}: CapabilityGateProps) {
  const capabilityResult = useCapabilityGate(capabilityType);
  const upgradePath = useCapabilityUpgradePath(capabilityType);

  if (capabilityResult.hasAccess) {
    return <div className={className}>{children}</div>;
  }

  if (showUpgradePrompt && upgradePath) {
    return (
      <div className={className}>
        <UpgradePrompt
          currentTier={upgradePath.currentTier}
          requiredTier={upgradePath.requiredTier}
          capabilities={upgradePath.capabilities}
        />
      </div>
    );
  }

  return <div className={className}>{fallback || null}</div>;
}

export interface CapabilityFeatureProps {
  capabilityType: string;
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
}

/**
 * Component that conditionally renders children based on specific capability feature
 */
export function CapabilityFeature({
  capabilityType,
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
  className = ''
}: CapabilityFeatureProps) {
  const capabilityResult = useCapabilityGate(capabilityType);
  const upgradePath = useCapabilityUpgradePath(capabilityType);

  // Check if the specific feature is available
  const hasFeature = capabilityResult.capabilities[capabilityType]?.features.includes(feature) || false;

  if (hasFeature) {
    return <div className={className}>{children}</div>;
  }

  if (showUpgradePrompt && upgradePath) {
    return (
      <div className={className}>
        <UpgradePrompt
          currentTier={upgradePath.currentTier}
          requiredTier={upgradePath.requiredTier}
          capabilities={upgradePath.capabilities}
        />
      </div>
    );
  }

  return <div className={className}>{fallback || null}</div>;
}

export interface CapabilityLimitProps {
  capabilityType: string;
  currentCount: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
}

/**
 * Component that enforces capability limits (e.g., max items)
 */
export function CapabilityLimit({
  capabilityType,
  currentCount,
  children,
  fallback,
  showUpgradePrompt = true,
  className = ''
}: CapabilityLimitProps) {
  const capabilityResult = useCapabilityGate(capabilityType);
  const upgradePath = useCapabilityUpgradePath(capabilityType);

  const capability = capabilityResult.capabilities[capabilityType];
  const maxLimit = capability?.maxLimit;
  
  // If no limit is set or within limit, allow access
  if (!maxLimit || currentCount < maxLimit) {
    return <div className={className}>{children}</div>;
  }

  // Limit reached
  if (showUpgradePrompt && upgradePath) {
    return (
      <div className={className}>
        <UpgradePrompt
          currentTier={upgradePath.currentTier}
          requiredTier={upgradePath.requiredTier}
          capabilities={upgradePath.capabilities}
          message={`You've reached the limit of ${maxLimit} items. Upgrade to ${upgradePath.requiredTier} for unlimited access.`}
        />
      </div>
    );
  }

  return <div className={className}>{fallback || null}</div>;
}
