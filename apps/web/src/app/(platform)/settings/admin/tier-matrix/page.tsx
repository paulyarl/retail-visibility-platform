'use client';

import { useState, useEffect } from 'react';
import { useAccessControl } from '@/lib/auth/useAccessControl';
import { FEATURE_DISPLAY_NAMES, TIER_DISPLAY_NAMES, TIER_PRICING, checkTierFeature, getTierFeatures } from '@/lib/tiers/tier-features';
import { api } from '@/lib/api';

interface TierFeature {
  id: string;
  featureKey: string;
  featureName: string;
  isEnabled: boolean;
  isInherited: boolean;
}

interface Tier {
  id: string;
  tierKey: string;
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  maxSkus?: number;
  maxLocations?: number;
  tierType: string;
  isActive: boolean;
  sortOrder: number;
  features: TierFeature[];
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function TierMatrixPage() {
  console.log('TierMatrixPage component mounted');
  const { user, isPlatformAdmin, loading: accessLoading } = useAccessControl(null);
  const [selectedView, setSelectedView] = useState<'matrix' | 'details'>('matrix');
  const [dbTiers, setDbTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tiers from database
  useEffect(() => {
    console.log('useEffect triggered for loadTiers');
    async function loadTiers() {
      try {
        setLoading(true);
        console.log('Starting to load tiers...');
        // Call Railway API directly - api.get() will include auth token from cookies
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const res = await api.get(`${apiBaseUrl}/api/admin/tier-system/tiers`);
        console.log('API response received:', res);
        if (res.ok) {
          const data = await res.json();
          console.log('Parsed data:', data);
          console.log('Tiers array:', data.tiers);
          console.log('First tier features:', data.tiers?.[0]?.features);
          setDbTiers(data.tiers || []);
          console.log('dbTiers state set');
        } else {
          console.error('API call failed:', res);
          setError('Failed to load tiers');
        }
      } catch (e) {
        console.error('Failed to load tiers:', e);
        setError('Failed to load tiers');
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      console.log('User exists, calling loadTiers');
      loadTiers();
    } else {
      console.log('No user, skipping loadTiers');
    }
  }, [user]);

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

  // Show loading while fetching tiers
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading tiers...</p>
        </div>
      </div>
    );
  }

  // Show error if failed to load
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    );
  }
  
  // Get all unique features from database tiers
  const allFeatures = new Map<string, string>();
  dbTiers.forEach(tier => {
    console.log(`Processing tier ${tier.tierKey}, features:`, tier.features);
    tier.features.forEach(feature => {
      if (!allFeatures.has(feature.featureKey)) {
        allFeatures.set(feature.featureKey, feature.featureName);
      }
    });
  });
  console.log('All features collected:', allFeatures);

  // Sort features by commonality
  const features = Array.from(allFeatures.keys()).sort((a, b) => {
    const countA = dbTiers.filter(tier => 
      tier.features.some(f => f.featureKey === a)
    ).length;
    const countB = dbTiers.filter(tier => 
      tier.features.some(f => f.featureKey === b)
    ).length;
    
    if (countB !== countA) return countB - countA;
    return (allFeatures.get(a) || a).localeCompare(allFeatures.get(b) || b);
  });

  // Check if a tier has a feature
  const tierHasFeature = (tier: Tier, featureKey: string): boolean => {
    return tier.features.some(f => f.featureKey === featureKey);
  };

  // Get tier color based on tier type
  const getTierColor = (tier: Tier): string => {
    if (tier.tierType === 'organization') {
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100';
    }
    const colors: Record<string, string> = {
      google_only: 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100',
      starter: 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100',
      professional: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-900 dark:text-indigo-100',
      enterprise: 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100',
    };
    return colors[tier.tierKey] || 'bg-neutral-100 dark:bg-neutral-900/30 text-neutral-900 dark:text-neutral-100';
  };

  // Get tier badge color
  const getTierBadgeColor = (tier: Tier): string => {
    if (tier.tierType === 'organization') {
      return 'bg-purple-500';
    }
    const colors: Record<string, string> = {
      google_only: 'bg-blue-500',
      starter: 'bg-green-500',
      professional: 'bg-indigo-500',
      enterprise: 'bg-amber-500',
    };
    return colors[tier.tierKey] || 'bg-neutral-500';
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Fixed Header - Mobile Optimized */}
      <div className="sticky top-0 z-20 bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700 shadow-sm">
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
          <h1 className="text-xl md:text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
            Tier & Feature Matrix
          </h1>
          <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400">
            Live view of all subscription tiers and their feature access
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">

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

      {/* View Toggle - Mobile Optimized */}
      <div className="mb-4 md:mb-6 flex gap-2">
        <button
          onClick={() => setSelectedView('matrix')}
          className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg font-medium text-sm md:text-base transition-colors ${
            selectedView === 'matrix'
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          Matrix
        </button>
        <button
          onClick={() => setSelectedView('details')}
          className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg font-medium text-sm md:text-base transition-colors ${
            selectedView === 'details'
              ? 'bg-primary-600 text-white'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
        >
          Details
        </button>
      </div>

      {selectedView === 'matrix' ? (
        <>
          {/* Tier Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {dbTiers.map((tier) => {
              console.log(`Rendering tier card for ${tier.tierKey}:`, tier.features);
              const featureCount = tier.features.length;
              const price = tier.priceMonthly / 100;
              
              return (
                <div
                  key={tier.id}
                  className={`p-4 rounded-lg border-2 ${getTierColor(tier)}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getTierBadgeColor(tier)}`}></div>
                    <h3 className="font-bold text-lg">
                      {tier.displayName}
                    </h3>
                  </div>
                  <p className="text-2xl font-bold mb-1">
                    {price === 0 ? 'Free' : `$${price}/mo`}
                  </p>
                  <p className="text-sm opacity-75">
                    {featureCount} features
                  </p>
                </div>
              );
            })}
          </div>

          {/* Feature Matrix Table - Mobile Optimized */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden">
            {/* Mobile: Horizontal scroll with momentum */}
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch overscroll-x-contain">
              <table className="w-full min-w-max">
                {/* Sticky Header */}
                <thead className="bg-neutral-50 dark:bg-neutral-700 border-b border-neutral-200 dark:border-neutral-600 sticky top-0 z-10">
                  <tr>
                    {/* Sticky First Column */}
                    <th className="text-left p-2 md:p-4 font-semibold text-neutral-900 dark:text-neutral-100 sticky left-0 bg-neutral-50 dark:bg-neutral-700 z-20 shadow-[2px_0_4px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.3)] min-w-[140px] md:min-w-[200px]">
                      <span className="text-xs md:text-base">Feature</span>
                    </th>
                    {dbTiers.map((tier) => (
                      <th
                        key={tier.id}
                        className="text-center p-2 md:p-4 font-semibold text-neutral-900 dark:text-neutral-100 min-w-[80px] md:min-w-[120px]"
                      >
                        <div className="flex flex-col items-center gap-0.5 md:gap-1">
                          <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${getTierBadgeColor(tier)}`}></div>
                          <span className="text-xs md:text-base leading-tight">{tier.displayName}</span>
                          <span className="text-[10px] md:text-xs font-normal opacity-75">
                            ${(tier.priceMonthly / 100).toFixed(0)}/mo
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                  {features.map((featureKey) => (
                    <tr key={featureKey} className="hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors">
                      {/* Sticky First Column */}
                      <td className="p-2 md:p-4 text-xs md:text-base font-medium text-neutral-900 dark:text-neutral-100 sticky left-0 bg-white dark:bg-neutral-800 z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_4px_rgba(0,0,0,0.2)]">
                        {allFeatures.get(featureKey) || featureKey}
                      </td>
                      {dbTiers.map((tier) => {
                        const hasFeature = tierHasFeature(tier, featureKey);
                        return (
                          <td key={tier.id} className="p-2 md:p-4 text-center">
                            {hasFeature ? (
                              <div className="flex justify-center">
                                <svg
                                  className="w-4 h-4 md:w-6 md:h-6 text-green-600 dark:text-green-400"
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
                                  className="w-4 h-4 md:w-6 md:h-6 text-neutral-300 dark:text-neutral-600"
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
            
            {/* Mobile Scroll Hint */}
            <div className="md:hidden bg-neutral-100 dark:bg-neutral-700 px-3 py-2 text-center">
              <p className="text-xs text-neutral-600 dark:text-neutral-400">
                ← Swipe to see all tiers →
              </p>
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
          {dbTiers.map((tier) => {
            const tierFeatures = tier.features;
            const price = tier.priceMonthly / 100;
            
            return (
              <div
                key={tier.id}
                className="bg-white dark:bg-neutral-800 rounded-lg shadow overflow-hidden"
              >
                <div className={`p-6 border-l-4 ${getTierBadgeColor(tier)}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-1">
                        {tier.displayName}
                      </h2>
                      <p className="text-xl font-semibold text-neutral-700 dark:text-neutral-300">
                        ${price.toFixed(2)}/month
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
                        key={feature.id}
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
                          {feature.featureName}
                          {feature.isInherited && <span className="ml-1 text-xs text-neutral-500">↑</span>}
                        </span>
                      </div>
                    ))}
                  </div>

                  {tierFeatures.length === 0 && (
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

      {/* Quick Actions - Mobile Optimized */}
      <div className="mt-4 md:mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 md:p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm md:text-base">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 md:gap-3">
          {isPlatformAdmin && (
            <a
              href="/settings/admin/tier-system"
              className="px-3 md:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 transition-colors font-medium text-sm md:text-base text-center"
            >
              Manage Tier System
            </a>
          )}
          <a
            href="/settings/admin/feature-overrides"
            className="px-3 md:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:bg-indigo-800 transition-colors font-medium text-sm md:text-base text-center"
          >
            Feature Overrides
          </a>
          <a
            href="/settings/admin/tenants"
            className="px-3 md:px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 active:bg-neutral-300 dark:active:bg-neutral-500 transition-colors font-medium text-sm md:text-base text-center"
          >
            View Tenants
          </a>
          <a
            href="/settings/offerings"
            className="px-3 md:px-4 py-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-600 active:bg-neutral-300 dark:active:bg-neutral-500 transition-colors font-medium text-sm md:text-base text-center"
          >
            Offerings
          </a>
        </div>
      </div>

      </div>
    </div>
  );
}
