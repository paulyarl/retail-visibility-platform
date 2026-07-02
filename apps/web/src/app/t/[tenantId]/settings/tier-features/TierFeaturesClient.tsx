'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Sparkles, TrendingUp } from 'lucide-react';
import { useTenantComplete } from '@/hooks/dashboard/useTenantComplete';
import { useTierConfig } from '@/lib/tiers/useTierConfig';
import {
  TIER_DISPLAY_NAMES,
  TIER_PRICING,
  TIER_HIERARCHY,
  FEATURE_DISPLAY_NAMES,
} from '@/lib/tiers/tier-features';

const COMPARISON_TIERS = ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise'];

export default function TierFeaturesClient({ tenantId }: { tenantId: string }) {
  const { tenant, tier, loading } = useTenantComplete(tenantId);
  const tierConfig = useTierConfig();

  const currentTierKey = tier?.effective?.id || tenant?.subscriptionTier || 'discovery';
  const currentTierName = TIER_DISPLAY_NAMES[currentTierKey] || currentTierKey;
  const currentTierPrice = TIER_PRICING[currentTierKey] ?? 0;

  const currentFeatures = useMemo(() => {
    return tierConfig.getTierFeatures(currentTierKey);
  }, [tierConfig, currentTierKey]);

  const allFeatureKeys = useMemo(() => {
    const keys = new Set<string>();
    COMPARISON_TIERS.forEach(t => {
      tierConfig.getTierFeatures(t).forEach(f => keys.add(f));
    });
    return Array.from(keys).sort();
  }, [tierConfig]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/t/${tenantId}/settings`} className="text-neutral-500 hover:text-neutral-900">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-blue-500" />
              Tier Features
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Your current plan and feature comparison
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : (
          <>
            {/* Current Tier Card */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="text-sm text-neutral-500 mb-1">Current Plan</div>
                  <div className="text-2xl font-bold text-neutral-900">{currentTierName}</div>
                  <div className="text-sm text-neutral-500 mt-1">
                    {currentFeatures.length} features included
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">
                    ${currentTierPrice}<span className="text-base font-normal text-neutral-500">/mo</span>
                  </div>
                  <Link
                    href={`/t/${tenantId}/settings/subscription`}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Upgrade Plan
                  </Link>
                </div>
              </div>
            </div>

            {/* Current Features List */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">Your Included Features</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentFeatures.map(feature => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-3 h-3 text-green-600" />
                    </div>
                    <span className="text-neutral-700">
                      {FEATURE_DISPLAY_NAMES[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Comparison Table */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Plan Comparison</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  See what features are available at each tier
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="text-left p-4 font-semibold text-neutral-900 sticky left-0 bg-neutral-50 z-10 min-w-[200px]">
                        Feature
                      </th>
                      {COMPARISON_TIERS.map(t => {
                        const isCurrent = t === currentTierKey;
                        return (
                          <th key={t} className={`text-center p-4 font-semibold min-w-[120px] ${isCurrent ? 'bg-blue-50 text-blue-700' : 'text-neutral-700'}`}>
                            <div>{TIER_DISPLAY_NAMES[t] || t}</div>
                            <div className="text-xs font-normal text-neutral-500 mt-0.5">
                              ${TIER_PRICING[t] ?? 0}/mo
                            </div>
                            {isCurrent && (
                              <div className="text-xs text-blue-600 font-medium mt-1">Your Plan</div>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {allFeatureKeys.map((feature, idx) => {
                      const featureName = FEATURE_DISPLAY_NAMES[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                      return (
                        <tr key={feature} className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                          <td className={`p-3 text-neutral-700 sticky left-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'} z-10 border-r border-neutral-100`}>
                            {featureName}
                          </td>
                          {COMPARISON_TIERS.map(t => {
                            const has = tierConfig.checkTierFeature(t, feature);
                            const isCurrent = t === currentTierKey;
                            return (
                              <td key={t} className={`p-3 text-center ${isCurrent ? 'bg-blue-50/50' : ''}`}>
                                {has ? (
                                  <Check className="w-4 h-4 text-green-600 mx-auto" />
                                ) : (
                                  <X className="w-4 h-4 text-neutral-300 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Feature Store CTA */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="font-semibold text-neutral-900">Need additional features?</h3>
                  <p className="text-sm text-neutral-600 mt-1">
                    Purchase individual features à la carte in the Feature Store.
                  </p>
                </div>
                <Link
                  href={`/t/${tenantId}/settings/feature-store`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4" />
                  Browse Feature Store
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
