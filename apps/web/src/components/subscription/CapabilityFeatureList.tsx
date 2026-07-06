'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Check, Zap, ShoppingBag, Sparkles } from 'lucide-react';
import { useTenantComplete } from '@/hooks/dashboard/useTenantComplete';
import { useTierConfig } from '@/lib/tiers/useTierConfig';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import {
  CAPABILITY_META,
  summarizeResolvedCapabilities,
  buildEffectiveFeatures,
  EffectiveFeatureRow,
} from '@/lib/tiers/capability-display';

export interface CapabilityFeatureListProps {
  tenantId: string;
  /** Compact mode: smaller text, no feature-store CTA, fewer per-row */
  compact?: boolean;
  /** Show the "Browse Feature Store" CTA link at the bottom */
  showFeatureStoreLink?: boolean;
  /** Title to display above the feature list */
  title?: string;
}

export default function CapabilityFeatureList({
  tenantId,
  compact = false,
  showFeatureStoreLink = false,
  title = 'Your Plan Includes:',
}: CapabilityFeatureListProps) {
  const { tenant, tier, loading: tenantLoading } = useTenantComplete(tenantId);
  const tierConfig = useTierConfig();
  const { data: allCaps, loading: capsLoading } = useAllCapabilities(tenantId);

  const currentTierKey = tier?.effective?.id || tenant?.subscriptionTier || 'discovery';

  const resolvedCaps = useMemo(() => {
    if (!allCaps) return null;
    return summarizeResolvedCapabilities(allCaps);
  }, [allCaps]);

  const effectiveFeatures = useMemo(() => {
    if (!allCaps) return [];
    const tierFeatures = tierConfig.getTierFeatures(currentTierKey);
    return buildEffectiveFeatures(tierFeatures, allCaps.purchasedFeatureKeys, resolvedCaps);
  }, [allCaps, tierConfig, currentTierKey, resolvedCaps]);

  const effectiveFeaturesByCapability = useMemo(() => {
    const groups: Record<string, EffectiveFeatureRow[]> = {};
    effectiveFeatures.forEach(f => {
      if (!groups[f.capabilityKey]) groups[f.capabilityKey] = [];
      groups[f.capabilityKey].push(f);
    });
    return groups;
  }, [effectiveFeatures]);

  const purchasedCount = effectiveFeatures.filter(f => f.isPurchased).length;
  const isLoading = tenantLoading || (capsLoading && !allCaps);

  if (isLoading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
          Loading features...
        </div>
      </div>
    );
  }

  if (effectiveFeatures.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">{title}</h3>
        <p className="text-sm text-neutral-400">No features found for your current plan.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
        {purchasedCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded-lg">
            <ShoppingBag className="w-3 h-3" />
            {purchasedCount} purchased
          </span>
        )}
      </div>

      <div className="space-y-3">
        {Object.entries(effectiveFeaturesByCapability).map(([capKey, features]) => {
          const capMeta = CAPABILITY_META.find(m => m.key === capKey);
          const capLabel = capMeta?.label || features[0]?.capabilityLabel || capKey;
          const isFlexible = features.some(f => f.isFlexible);
          const purchasedInGroup = features.filter(f => f.isPurchased).length;
          return (
            <div key={capKey} className={`rounded-lg border border-neutral-200 ${compact ? 'p-2' : 'p-3'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-neutral-900`}>{capLabel}</span>
                {isFlexible && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                    <Zap className="w-2.5 h-2.5" />
                    Flexible
                  </span>
                )}
                {purchasedInGroup > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                    <ShoppingBag className="w-2.5 h-2.5" />
                    {purchasedInGroup}
                  </span>
                )}
                <span className="text-xs text-neutral-400 ml-auto">{features.length}</span>
              </div>
              <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                {features.map(f => (
                  <div key={f.feature} className="flex items-center gap-2 text-xs p-1.5 rounded bg-neutral-50">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-green-600" />
                    </div>
                    <span className="text-neutral-700 flex-1 truncate">{f.featureName}</span>
                    {f.isPurchased && (
                      <span title="Individually purchased from Feature Store" className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-purple-700 bg-purple-100 px-1 py-0.5 rounded-full">
                        <ShoppingBag className="w-2.5 h-2.5" />
                      </span>
                    )}
                    {f.isFlexible && !f.isPurchased && (
                      <span title="Unlocked via flexible tier capability" className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1 py-0.5 rounded-full">
                        <Zap className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showFeatureStoreLink && (
        <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-semibold text-neutral-900 text-sm">Need additional features?</span>
              <p className="text-xs text-neutral-600 mt-0.5">Purchase individual features in the Feature Store.</p>
            </div>
            <Link
              href={`/t/${tenantId}/settings/feature-store`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Browse Feature Store
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
