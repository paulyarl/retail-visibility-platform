/**
 * TierGate Component
 * 
 * Declarative component for tier-based feature gating.
 * Automatically shows upgrade prompts when feature is not available.
 * 
 * Usage:
 * ```tsx
 * <TierGate feature="storefront" tier={tenant.subscriptionTier}>
 *   <StorefrontContent />
 * </TierGate>
 * 
 * // With custom fallback
 * <TierGate 
 *   feature="quick_start_wizard" 
 *   tier={tier}
 *   fallback={<CustomUpgradeMessage />}
 * >
 *   <QuickStartWizard />
 * </TierGate>
 * 
 * // Hide completely if no access
 * <TierGate feature="api_access" tier={tier} showUpgrade={false}>
 *   <ApiSettings />
 * </TierGate>
 * ```
 */

'use client';

import React from 'react';
import { useTierAccess } from '@/lib/tiers/useTierAccess';
import { FEATURE_DISPLAY_NAMES, TIER_DISPLAY_NAMES } from '@/lib/tiers/tier-features';
import Link from 'next/link';

interface TierGateProps {
  /** Feature to check access for */
  feature: string;
  
  /** Current tenant tier */
  tier: string | null | undefined;
  
  /** Optional tenant ID for upgrade link */
  tenantId?: string;
  
  /** Custom fallback to show when feature is not available */
  fallback?: React.ReactNode;
  
  /** Whether to show upgrade prompt (default: true) */
  showUpgrade?: boolean;
  
  /** Children to render if feature is available */
  children: React.ReactNode;
  
  /** Custom className for upgrade prompt container */
  className?: string;
}

/**
 * Gate content based on tier feature access
 */
export function TierGate({ 
  feature, 
  tier, 
  tenantId,
  fallback, 
  showUpgrade = true, 
  children,
  className,
}: TierGateProps) {
  const { hasFeature, requiresUpgrade } = useTierAccess(tier);
  
  // Feature is available - render children
  if (hasFeature(feature)) {
    return <>{children}</>;
  }
  
  // Custom fallback provided
  if (fallback) {
    return <>{fallback}</>;
  }
  
  // Show upgrade prompt
  if (showUpgrade) {
    const upgradeData = requiresUpgrade(feature);
    return (
      <TierUpgradePrompt 
        feature={feature}
        currentTier={tier}
        upgrade={upgradeData}
        tenantId={tenantId}
        className={className}
      />
    );
  }
  
  // Hide completely
  return null;
}

interface TierUpgradePromptProps {
  feature: string;
  currentTier: string | null | undefined;
  upgrade: {
    required: boolean;
    targetTier?: string;
    targetTierDisplay?: string;
    targetPrice?: number;
    currentPrice?: number;
    upgradeCost?: number;
  };
  tenantId?: string;
  className?: string;
}

/**
 * Default upgrade prompt shown when feature is not available
 */
function TierUpgradePrompt({ feature, currentTier, upgrade, tenantId, className }: TierUpgradePromptProps) {
  const upgradeUrl = tenantId 
    ? `/t/${tenantId}/settings/subscription`
    : '/settings/subscription';
  
  const dashboardUrl = tenantId
    ? `/t/${tenantId}/dashboard`
    : '/';
  
  const featureDisplayName = FEATURE_DISPLAY_NAMES[feature] || feature;
  const currentTierDisplay = currentTier ? TIER_DISPLAY_NAMES[currentTier] || currentTier : 'Unknown';
  
  return (
    <div className={className || "min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4"}>
      <div className="max-w-2xl w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
            Feature Not Available
          </h1>
          
          {/* Feature and Tier Information Box */}
          <div className="bg-neutral-100 dark:bg-neutral-700 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Feature:</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{featureDisplayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Current Tier:</span>
                <span className="font-semibold text-neutral-900 dark:text-white">{currentTierDisplay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Required Tier:</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">{upgrade.targetTierDisplay}</span>
              </div>
            </div>
          </div>
          
          {upgrade.targetPrice && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Upgrade to {upgrade.targetTierDisplay} (${upgrade.targetPrice}/mo)
              </h3>
              {upgrade.upgradeCost && upgrade.upgradeCost > 0 && (
                <p className="text-sm text-neutral-700 dark:text-blue-200 mb-2">
                  Additional ${upgrade.upgradeCost}/month from your current plan
                </p>
              )}
              <p className="text-sm text-neutral-700 dark:text-blue-200">
                Unlock this feature and many more premium capabilities.
              </p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={upgradeUrl}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-100 text-white font-medium hover:bg-primary-700 transition-colors"  
            >
              Upgrade Plan
            </Link>
            <Link
              href={dashboardUrl}
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline tier badge component
 * Shows a small badge indicating feature requires upgrade
 */
export function TierBadge({ 
  feature, 
  tier 
}: { 
  feature: string; 
  tier: string | null | undefined;
}) {
  const { hasFeature, requiresUpgrade } = useTierAccess(tier);
  
  if (hasFeature(feature)) {
    return null;
  }
  
  const upgrade = requiresUpgrade(feature);
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
      {upgrade.targetTierDisplay}
    </span>
  );
}
