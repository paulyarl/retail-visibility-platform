'use client';

import { useState, useEffect } from 'react';
import { useAccessControl } from '@/lib/auth/useAccessControl';
import { TIER_FEATURES, TIER_HIERARCHY, FEATURE_DISPLAY_NAMES, TIER_DISPLAY_NAMES, TIER_PRICING } from '@/lib/tiers/tier-features';

type TierName = 'trial' | 'google_only' | 'starter' | 'professional' | 'enterprise';

export default function TierMatrixPage() {
  const { user, isPlatformAdmin, loading: accessLoading } = useAccessControl(null);
  const [selectedView, setSelectedView] = useState<'matrix' | 'details'>('matrix');

  // Show loading state while checking access
  if (accessLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Allow access to platform staff and tenant decision-makers
  const hasAccess = user && (
    isPlatformAdmin ||
    user.role === 'PLATFORM_SUPPORT' ||
    user.role === 'PLATFORM_VIEWER' ||
    user.role === 'OWNER' ||
    user.role === 'ADMIN'
  );

  // Show access denied after loading completes
  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">
            Access denied. This page is available to platform staff and tenant administrators.
          </p>
        </div>
      </div>
    );
  }

  const isReadOnly = !isPlatformAdmin;

  const tiers: TierName[] = ['trial', 'google_only', 'starter', 'professional', 'enterprise'];
  const features = Object.keys(FEATURE_DISPLAY_NAMES);

  // Check if a tier has a feature (including inherited features)
  const tierHasFeature = (tier: TierName, feature: string): boolean => {
    const tierFeatures = TIER_FEATURES[tier];
    if (!tierFeatures) return false;
    return tierFeatures.includes(feature as any) || false;
  };

  // Get tier color
  const getTierColor = (tier: TierName): string => {
    const colors: Record<TierName, string> = {
      trial: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
      google_only: 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100',
      starter: 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100',
      professional: 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100',
      enterprise: 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100',
    };
    return colors[tier];
  };

  // Get tier badge color
  const getTierBadgeColor = (tier: TierName): string => {
    const colors: Record<TierName, string> = {
      trial: 'bg-neutral-500',
      google_only: 'bg-blue-500',
      starter: 'bg-green-500',
      professional: 'bg-purple-500',
      enterprise: 'bg-amber-500',
    };
    return colors[tier];
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Tier & Feature Matrix
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400">
          Live view of all subscription tiers and their feature access
        </p>
      </div>

      {/* Info Banner for Non-Admins */}
      {isReadOnly && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                Tier Reference Guide
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                This page shows what features are included in each subscription tier. 
                {user?.role === 'OWNER' || user?.role === 'ADMIN' 
                  ? ' Use this to understand what you can access and what you would gain by upgrading.'
                  : ' Use this as a reference when helping customers understand tier capabilities.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setSelectedView('matrix')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedView === 'matrix'
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          Matrix View
        </button>
        <button
          onClick={() => setSelectedView('details')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedView === 'details'
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          Details View
        </button>
      </div>

      {selectedView === 'matrix' ? (
        <>
          {/* Tier Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {tiers.map((tier) => {
              const tierFeatures = TIER_FEATURES[tier];
              const featureCount = tierFeatures ? tierFeatures.length : 0;
              const price = TIER_PRICING[tier] || 0;
              
              return (
                <div
                  key={tier}
                  className={`p-4 rounded-lg border-2 ${getTierColor(tier)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getTierBadgeColor(tier)}`}></div>
                    <h3 className="font-bold text-lg">
                      {TIER_DISPLAY_NAMES[tier]}
                    </h3>
                  </div>
                  <p className="text-2xl font-bold mb-1">
                    {price === 0 ? 'Free' : `$${price}/mo`}
                  </p>
                  <p className="text-sm opacity-75">
                    {featureCount} feature{featureCount !== 1 ? 's' : ''}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Feature Matrix Table */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-600">
                  <tr>
                    <th className="text-left p-4 font-semibold text-neutral-900 dark:text-neutral-100 sticky left-0 bg-neutral-50 dark:bg-neutral-700 z-10">
                      Feature
                    </th>
                    {tiers.map((tier) => (
                      <th
                        key={tier}
                        className="text-center p-4 font-semibold text-neutral-900 dark:text-neutral-100 min-w-[120px]"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-3 h-3 rounded-full ${getTierBadgeColor(tier)}`}></div>
                          <span>{TIER_DISPLAY_NAMES[tier]}</span>
                          <span className="text-xs font-normal opacity-75">
                            {TIER_PRICING[tier] === 0 ? 'Free' : `$${TIER_PRICING[tier]}/mo`}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {features.map((feature) => (
                    <tr key={feature} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50">
                      <td className="p-4 font-medium text-neutral-900 dark:text-neutral-100 sticky left-0 bg-white dark:bg-neutral-800 z-10">
                        {FEATURE_DISPLAY_NAMES[feature]}
                      </td>
                      {tiers.map((tier) => {
                        const hasFeature = tierHasFeature(tier, feature);
                        return (
                          <td key={tier} className="p-4 text-center">
                            {hasFeature ? (
                              <div className="flex justify-center">
                                <svg
                                  className="w-6 h-6 text-green-600 dark:text-green-400"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </div>
                            ) : (
                              <div className="flex justify-center">
                                <svg
                                  className="w-6 h-6 text-neutral-300 dark:text-neutral-600"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-6 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">Legend</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-neutral-700 dark:text-neutral-300">Feature included in tier</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="text-neutral-700 dark:text-neutral-300">Feature not included</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-neutral-700 dark:text-neutral-300">💡 Tip: Use Feature Overrides to grant features outside of tier restrictions</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Details View */
        <div className="space-y-6">
          {tiers.map((tier) => {
            const tierFeatures = TIER_FEATURES[tier] || [];
            const price = TIER_PRICING[tier];
            
            return (
              <div
                key={tier}
                className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden"
              >
                <div className={`p-6 border-l-4 ${getTierBadgeColor(tier)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                        {TIER_DISPLAY_NAMES[tier]}
                      </h2>
                      <p className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">
                        {price === 0 ? 'Free Trial' : `$${price}/month`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        {tierFeatures.length}
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Features
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tierFeatures.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg"
                      >
                        <svg
                          className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                          {FEATURE_DISPLAY_NAMES[feature]}
                        </span>
                      </div>
                    ))}
                  </div>

                  {(!tierFeatures || tierFeatures.length === 0) && (
                    <p className="text-neutral-600 dark:text-neutral-400 italic">
                      No features configured for this tier
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="/settings/admin/feature-overrides"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Manage Feature Overrides
          </a>
          <a
            href="/settings/admin/tenants"
            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-medium"
          >
            View All Tenants
          </a>
          <a
            href="/settings/offerings"
            className="px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors font-medium"
          >
            Platform Offerings
          </a>
        </div>
      </div>
    </div>
  );
}
