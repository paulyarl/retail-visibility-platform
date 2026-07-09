'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Sparkles, TrendingUp, Settings, Zap, ShoppingBag, LayoutGrid, List, Info, Boxes, Layers } from 'lucide-react';
import { useTenantComplete } from '@/hooks/dashboard/useTenantComplete';
import { useTierConfig } from '@/lib/tiers/useTierConfig';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { TIER_DISPLAY_NAMES, TIER_PRICING } from '@/lib/tiers/tier-features';
import { summarizeResolvedCapabilities } from '@/lib/tiers/capability-display';
import CapabilityComparisonMatrix from '@/components/subscription/CapabilityComparisonMatrix';
import CapabilityFeatureList from '@/components/subscription/CapabilityFeatureList';

const TIER_UPGRADE_PATHS: string[][] = [
  ['google_only', 'starter', 'discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise'],
  ['chain_starter', 'chain_professional', 'chain_enterprise'],
];

function isHighestTier(tierKey: string): boolean {
  const path = TIER_UPGRADE_PATHS.find(p => p.includes(tierKey));
  if (!path) return true;
  return path[path.length - 1] === tierKey;
}

export default function TierFeaturesClient({ tenantId }: { tenantId: string }) {
  const { tenant, tier, loading } = useTenantComplete(tenantId);
  const tierConfig = useTierConfig();
  const { data: allCaps, loading: capsLoading } = useAllCapabilities(tenantId);
  const [activeTab, setActiveTab] = useState<'comparison' | 'effective'>('comparison');

  const currentTierKey = tier?.effective?.id || tenant?.subscriptionTier || 'discovery';
  const currentTierName = TIER_DISPLAY_NAMES[currentTierKey] || currentTierKey;
  const currentTierPrice = TIER_PRICING[currentTierKey] ?? 0;

  const resolvedCaps = useMemo(() => {
    if (!allCaps) return null;
    return summarizeResolvedCapabilities(allCaps);
  }, [allCaps]);

  const isLoading = loading || (capsLoading && !allCaps);

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
              Your plan, resolved capabilities, and effective features
            </p>
          </div>
        </div>

        {isLoading ? (
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
                    {resolvedCaps ? `${resolvedCaps.filter(c => c.enabled).length} capabilities active` : `${tierConfig.getTierFeatures(currentTierKey).length} features included`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">
                    ${currentTierPrice}<span className="text-base font-normal text-neutral-500">/mo</span>
                  </div>
                  {isHighestTier(currentTierKey) ? (
                    <Link
                      href={`/t/${tenantId}/settings/subscription`}
                      className="inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 mt-2"
                    >
                      <Settings className="w-4 h-4" />
                      Manage Plan
                    </Link>
                  ) : (
                    <Link
                      href={`/t/${tenantId}/settings/subscription`}
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Upgrade Plan
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Capability Education Panel */}
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-blue-500" />
                  <h2 className="text-lg font-semibold text-neutral-900">Understanding Capabilities & Features</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Boxes className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-semibold text-neutral-900">What is a Capability?</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      A capability is a platform domain — like Storefront, Commerce, or CRM — that groups related features together. Your tier unlocks specific capabilities, and each capability enables a set of features within that domain.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-semibold text-neutral-900">Flexible Capabilities</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Some tiers unlock a <span className="font-medium">flexible</span> capability, meaning every feature within that domain is automatically enabled — no need to configure each one individually. Look for the <Zap className="w-3 h-3 inline text-amber-600" /> marker.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                      <ShoppingBag className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-neutral-900">Purchased Features</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Need a feature from a higher tier without upgrading? Purchase individual features from the Feature Store. These add to your effective features beyond what your tier bundle includes. Look for the <ShoppingBag className="w-3 h-3 inline text-purple-600" /> marker.
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                  <div className="flex items-start gap-2">
                    <Layers className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-neutral-500 leading-relaxed">
                      <span className="font-medium text-neutral-700">How it works:</span> Your tier determines which capabilities are available. Capabilities resolve into specific features. Flexible capabilities unlock all features in a domain. Purchased features add on top of your tier bundle. The result is your <span className="font-medium text-neutral-700">effective features</span> — the complete set of what's active for your store right now.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex items-center gap-1 border-b border-neutral-200">
              <button
                onClick={() => setActiveTab('comparison')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'comparison' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
              >
                <LayoutGrid className="w-4 h-4" />
                Tier Comparison
              </button>
              <button
                onClick={() => setActiveTab('effective')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'effective' ? 'border-blue-600 text-blue-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'}`}
              >
                <List className="w-4 h-4" />
                Effective Features
              </button>
            </div>

            {/* Resolved Capabilities — from effective capability resolution */}
            {resolvedCaps && (
              <div className="bg-white rounded-xl border border-neutral-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h2 className="text-lg font-semibold text-neutral-900">Your Resolved Capabilities</h2>
                </div>
                <p className="text-sm text-neutral-500 mb-4">
                  Capabilities resolved from your tier, organization, and purchased features — flexible markers expanded
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {resolvedCaps.map(cap => (
                    <div
                      key={cap.key}
                      className={`flex items-start gap-2 p-3 rounded-lg border ${cap.enabled ? 'border-green-200 bg-green-50/50' : 'border-neutral-200 bg-neutral-50'}`}
                    >
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${cap.enabled ? 'bg-green-100' : 'bg-neutral-200'}`}>
                        {cap.enabled ? (
                          <Check className="w-3 h-3 text-green-600" />
                        ) : (
                          <X className="w-3 h-3 text-neutral-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-neutral-900">{cap.label}</span>
                          {cap.flexible && cap.enabled && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                              <Zap className="w-2.5 h-2.5" />
                              Flexible
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">{cap.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Capability Comparison Table */}
            {activeTab === 'comparison' && (
              <CapabilityComparisonMatrix tenantId={tenantId} />
            )}

            {/* Effective Features Tab */}
            {activeTab === 'effective' && (
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-neutral-200">
                  <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-blue-500" />
                    <h2 className="text-lg font-semibold text-neutral-900">All Effective Features</h2>
                  </div>
                  <p className="text-sm text-neutral-500 mt-1">
                    Every feature currently active for your tenant — bundled tier features plus individually purchased add-ons
                  </p>
                </div>
                <div className="p-6">
                  <CapabilityFeatureList tenantId={tenantId} title="" />
                </div>
              </div>
            )}

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
