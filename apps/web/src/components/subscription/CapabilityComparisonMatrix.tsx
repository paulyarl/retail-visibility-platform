'use client';

import { Fragment, useMemo, useState } from 'react';
import { Check, X, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useTenantComplete } from '@/hooks/dashboard/useTenantComplete';
import { useTierConfig } from '@/lib/tiers/useTierConfig';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { TIER_DISPLAY_NAMES, TIER_PRICING } from '@/lib/tiers/tier-features';
import {
  COMPARISON_TIERS,
  CAPABILITY_META,
  CAPABILITY_GROUPS,
  summarizeResolvedCapabilities,
  getTierCapabilityInfo,
  getCapabilityFeatureRows,
} from '@/lib/tiers/capability-display';

export interface CapabilityComparisonMatrixProps {
  /** Tenant ID for tenant-aware mode (highlights current tier, uses resolved capabilities) */
  tenantId?: string;
  /** Title shown above the table */
  title?: string;
  /** Subtitle/description shown below the title */
  description?: string;
}

export default function CapabilityComparisonMatrix({
  tenantId,
  title = 'Capability Comparison',
  description = 'Capabilities available at each tier — flexible means all features in the capability are unlocked',
}: CapabilityComparisonMatrixProps) {
  const isTenantMode = !!tenantId;
  const { tenant, tier, loading: tenantLoading } = useTenantComplete(isTenantMode ? tenantId! : null);
  const tierConfig = useTierConfig({ publicMode: !isTenantMode });
  const { data: allCaps, loading: capsLoading } = useAllCapabilities(isTenantMode ? tenantId! : null);
  const [expandedCap, setExpandedCap] = useState<string | null>(null);

  const getTierFeatures = tierConfig.getTierFeatures;

  const currentTierKey = isTenantMode
    ? (tier?.effective?.id || tenant?.subscriptionTier || 'discovery')
    : '';

  const resolvedCaps = useMemo(() => {
    if (!allCaps) return null;
    return summarizeResolvedCapabilities(allCaps);
  }, [allCaps]);

  const comparisonMatrix = useMemo(() => {
    const tierFeaturesMap: Record<string, string[]> = {};
    COMPARISON_TIERS.forEach(t => {
      tierFeaturesMap[t] = getTierFeatures(t);
    });

    return CAPABILITY_META.map(capMeta => {
      const tierInfos: Record<string, ReturnType<typeof getTierCapabilityInfo>> = {};
      COMPARISON_TIERS.forEach(t => {
        tierInfos[t] = getTierCapabilityInfo(tierFeaturesMap[t], capMeta.key, capMeta.flexibleKeys);
      });
      return { ...capMeta, tierInfos };
    });
  }, [getTierFeatures]);

  const currentTierCapStatus = useMemo(() => {
    if (!resolvedCaps) return null;
    const map: Record<string, { enabled: boolean; flexible: boolean }> = {};
    resolvedCaps.forEach(rc => {
      map[rc.key] = { enabled: rc.enabled, flexible: rc.flexible };
    });
    return map;
  }, [resolvedCaps]);

  const isLoading = tierConfig.loading || (isTenantMode && (tenantLoading || (capsLoading && !allCaps)));

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <p className="text-sm text-neutral-500 mt-1">{description}</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-neutral-200">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="text-sm text-neutral-500 mt-1">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="text-left p-4 font-semibold text-neutral-900 sticky left-0 bg-neutral-50 z-10 min-w-[200px]">
                Capability
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
            {CAPABILITY_GROUPS.map(group => {
              const groupRows = comparisonMatrix.filter(r => r.group === group);
              if (groupRows.length === 0) return null;
              return (
                <Fragment key={group}>
                  <tr className="border-b border-neutral-200">
                    <td colSpan={COMPARISON_TIERS.length + 1} className="p-3 bg-neutral-100 font-semibold text-neutral-800 text-xs uppercase tracking-wide">
                      {group}
                    </td>
                  </tr>
                  {groupRows.map((row, idx) => {
                    const isExpanded = expandedCap === row.key;
                    const resolvedInfo = currentTierCapStatus?.[row.key];
                    return (
                      <Fragment key={row.key}>
                  <tr
                    className={`cursor-pointer hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}`}
                    onClick={() => setExpandedCap(isExpanded ? null : row.key)}
                  >
                    <td className={`p-3 text-neutral-700 sticky left-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50'} z-10 border-r border-neutral-100`}>
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                        <span className="font-medium">{row.label}</span>
                      </div>
                    </td>
                    {COMPARISON_TIERS.map(t => {
                      const info = row.tierInfos[t];
                      const isCurrent = t === currentTierKey;
                      const displayEnabled = isCurrent && resolvedInfo ? resolvedInfo.enabled : info.enabled;
                      const displayFlexible = isCurrent && resolvedInfo ? resolvedInfo.flexible : info.flexible;
                      return (
                        <td key={t} className={`p-3 text-center ${isCurrent ? 'bg-blue-50/50' : ''}`}>
                          {displayEnabled ? (
                            <div className="flex items-center justify-center gap-1">
                              <Check className="w-4 h-4 text-green-600" />
                              {displayFlexible && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1 py-0.5 rounded-full">
                                  <Zap className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          ) : (
                            <X className="w-4 h-4 text-neutral-300 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {isExpanded && (
                    <tr key={`${row.key}-detail`} className="bg-neutral-50/50">
                      <td colSpan={COMPARISON_TIERS.length + 1} className="p-4">
                        <div className="ml-6 space-y-2">
                          <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                            Features in {row.label}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {row.tierInfos[COMPARISON_TIERS[0]].features.length === 0 &&
                              row.tierInfos[COMPARISON_TIERS[COMPARISON_TIERS.length - 1]].features.length === 0 ? (
                              <span className="text-xs text-neutral-400">No features defined for this capability in any tier.</span>
                            ) : (
                              getCapabilityFeatureRows(row.tierInfos, currentTierKey, currentTierCapStatus, row.key).map(fr => (
                                <div key={fr.feature} className="flex items-center gap-2 text-xs">
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${fr.available ? 'bg-green-100' : 'bg-neutral-200'}`}>
                                    {fr.available ? (
                                      <Check className="w-2.5 h-2.5 text-green-600" />
                                    ) : (
                                      <X className="w-2.5 h-2.5 text-neutral-400" />
                                    )}
                                  </div>
                                  <span className="text-neutral-700">{fr.featureName}</span>
                                  <span className="text-neutral-400 ml-auto text-[10px]">
                                    {fr.tiersWithFeature}/{COMPARISON_TIERS.length} tiers
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                    </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
