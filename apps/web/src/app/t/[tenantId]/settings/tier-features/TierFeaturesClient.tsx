'use client';

import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Sparkles, TrendingUp, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { useTenantComplete } from '@/hooks/dashboard/useTenantComplete';
import { useTierConfig } from '@/lib/tiers/useTierConfig';
import { useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import { getCapabilityTypeForFeature, AllCapabilitiesState } from '@/services/CapabilityResolutionService';
import { TIER_DISPLAY_NAMES, TIER_PRICING, FEATURE_DISPLAY_NAMES } from '@/lib/tiers/tier-features';

const COMPARISON_TIERS = ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise'];

// Capability display metadata — ordered for display
const CAPABILITY_META: Array<{ key: string; label: string; flexibleKeys: string[] }> = [
  { key: 'commerce_types', label: 'Commerce', flexibleKeys: ['commerce_both_options'] },
  { key: 'payment_gateway_options', label: 'Payment Gateways', flexibleKeys: ['payment_gateway_flexible'] },
  { key: 'storefront_types', label: 'Storefront Types', flexibleKeys: ['storefront_both_options'] },
  { key: 'storefront_options', label: 'Storefront Options', flexibleKeys: ['storefront_opt_flexible'] },
  { key: 'fulfillment_options', label: 'Fulfillment', flexibleKeys: ['fulfillment_flexible'] },
  { key: 'barcode_scan_options', label: 'Barcode Scan', flexibleKeys: ['barcode_flexible'] },
  { key: 'product_types', label: 'Product Types', flexibleKeys: ['product_types_flexible'] },
  { key: 'product_options', label: 'Product Options', flexibleKeys: ['product_options_flexible', 'product_flexible'] },
  { key: 'featured_options', label: 'Featured', flexibleKeys: ['featured_flexible'] },
  { key: 'integration_options', label: 'Integrations', flexibleKeys: ['integration_flexible'] },
  { key: 'quickstart_options', label: 'Quick Start', flexibleKeys: ['quickstart_flexible'] },
  { key: 'chatbot_options', label: 'Chatbot', flexibleKeys: ['chatbot_flexible'] },
  { key: 'crm_options', label: 'CRM', flexibleKeys: ['crm_flexible'] },
  { key: 'faq_options', label: 'FAQ', flexibleKeys: ['faq_flexible'] },
  { key: 'directory_entry', label: 'Directory Entry', flexibleKeys: ['directory_entry_flexible'] },
  { key: 'social_commerce_options', label: 'Social Commerce', flexibleKeys: ['social_commerce_flexible'] },
];

interface ResolvedCapSummary {
  key: string;
  label: string;
  enabled: boolean;
  flexible: boolean;
  detail: string;
}

function summarizeResolvedCapabilities(caps: AllCapabilitiesState): ResolvedCapSummary[] {
  const c = caps.commerce;
  const pg = caps.paymentGateway;
  const sf = caps.storefront;
  const so = caps.storefrontOptions;
  const fl = caps.fulfillment;
  const bc = caps.barcodeScan;
  const pt = caps.productType;
  const po = caps.productOptions;
  const fo = caps.featuredOptions;
  const io = caps.integrationOptions;
  const qo = caps.quickstartOptions;
  const cb = caps.chatbotOptions;
  const crm = caps.crmOptions;
  const faq = caps.faqOptions;
  const de = caps.directoryEntryOptions;
  const scc = caps.socialCommerceOptions;

  return [
    { key: 'commerce_types', label: 'Commerce', enabled: c.enabled, flexible: c.isFlexible, detail: c.effectivePaymentType !== 'none' ? `Payments: ${c.effectivePaymentType}` : 'Disabled' },
    { key: 'payment_gateway_options', label: 'Payment Gateways', enabled: pg.enabled, flexible: pg.isFlexible, detail: (pg.effectiveGateways ?? []).length > 0 ? pg.effectiveGateways.join(', ') : 'None connected' },
    { key: 'storefront_types', label: 'Storefront Types', enabled: sf.type !== 'none' && (sf.allowedTypes ?? []).length > 0, flexible: sf.isFlexible, detail: sf.effectiveType !== 'none' ? `Type: ${sf.effectiveType}` : 'Not configured' },
    { key: 'storefront_options', label: 'Storefront Options', enabled: so.enabled, flexible: so.isFlexible, detail: so.enabled ? (so.isFlexible ? 'All options unlocked' : 'Customizable') : 'Default' },
    { key: 'fulfillment_options', label: 'Fulfillment', enabled: fl.enabled, flexible: fl.isFlexible, detail: fl.effectiveShowsPickup || fl.effectiveShowsDelivery || fl.effectiveShowsShipping ? [fl.effectiveShowsPickup && 'Pickup', fl.effectiveShowsDelivery && 'Delivery', fl.effectiveShowsShipping && 'Shipping'].filter(Boolean).join(', ') : 'Not configured' },
    { key: 'barcode_scan_options', label: 'Barcode Scan', enabled: bc.enabled, flexible: bc.isFlexible, detail: (bc.effectiveModes ?? []).length > 0 ? `Modes: ${bc.effectiveModes.join(', ')}` : 'Not available' },
    { key: 'product_types', label: 'Product Types', enabled: pt.enabled, flexible: pt.isFlexible, detail: (pt.effectiveTypes ?? []).length > 0 ? pt.effectiveTypes.join(', ') : 'Standard' },
    { key: 'product_options', label: 'Product Options', enabled: po.enabled, flexible: po.isFlexible, detail: po.enabled ? [po.effectiveShowsVariants && 'Variants', po.effectiveShowsGallery && 'Gallery', po.effectiveShowsVideo && 'Video', po.effectiveShowsSupplierCatalog && 'Supplier Catalog'].filter(Boolean).join(', ') || 'Basic' : 'Not available' },
    { key: 'featured_options', label: 'Featured', enabled: fo.enabled, flexible: fo.isFlexible, detail: (fo.effectiveTypes ?? []).length > 0 ? fo.effectiveTypes.join(', ') : 'Not available' },
    { key: 'integration_options', label: 'Integrations', enabled: io.enabled, flexible: io.isFlexible, detail: (io.effectiveTypes ?? []).length > 0 ? io.effectiveTypes.join(', ') : (io.allowedTypes ?? []).length > 0 ? `${io.allowedTypes.join(', ')} (merchant off)` : 'Not configured' },
    { key: 'quickstart_options', label: 'Quick Start', enabled: qo.enabled, flexible: qo.isFlexible, detail: qo.enabled ? 'Active' : 'Not available' },
    { key: 'chatbot_options', label: 'Chatbot', enabled: cb.enabled, flexible: cb.isFlexible, detail: cb.enabled ? [cb.staticEnabled && 'Static', cb.dynamicEnabled && 'Dynamic', cb.skillsEnabled && 'Skills', cb.kbEnabled && 'KB', cb.widgetEnabled && 'Widget'].filter(Boolean).join(', ') || 'AI Assistant' : 'Not available' },
    { key: 'crm_options', label: 'CRM', enabled: crm.enabled, flexible: crm.isFlexible, detail: crm.enabled ? 'Support Hub' : 'Not available' },
    { key: 'faq_options', label: 'FAQ', enabled: faq.enabled, flexible: faq.isFlexible, detail: faq.enabled ? [faq.storefrontEnabled && 'Storefront', faq.productEnabled && 'Product', faq.templatesEnabled && 'Templates'].filter(Boolean).join(', ') || 'Basic' : 'Not available' },
    { key: 'directory_entry', label: 'Directory Entry', enabled: de.enabled, flexible: de.isFlexible, detail: de.enabled ? `${de.effectiveLayout ?? 'classic'} layout` : 'Not available' },
    { key: 'social_commerce_options', label: 'Social Commerce', enabled: scc.enabled, flexible: scc.isFlexible, detail: scc.enabled ? [scc.metaEnabled && 'Meta', scc.tiktokEnabled && 'TikTok', scc.canUseShareButtons && 'Share'].filter(Boolean).join(', ') || 'Available' : 'Not available' },
  ];
}

interface TierCapabilityInfo {
  enabled: boolean;
  flexible: boolean;
  features: string[];
}

function getTierCapabilityInfo(tierFeatures: string[], capKey: string, flexibleKeys: string[]): TierCapabilityInfo {
  const features = tierFeatures.filter(f => getCapabilityTypeForFeature(f) === capKey);
  const flexible = flexibleKeys.some(fk => tierFeatures.includes(fk));
  return { enabled: features.length > 0, flexible, features };
}

interface FeatureRow {
  feature: string;
  featureName: string;
  tiersWithFeature: number;
  available: boolean;
}

function getCapabilityFeatureRows(
  tierInfos: Record<string, TierCapabilityInfo>,
  currentTierKey: string,
  currentTierCapStatus: Record<string, { enabled: boolean; flexible: boolean }> | null,
  capKey: string,
): FeatureRow[] {
  const allFeaturesInCap = new Set<string>();
  Object.values(tierInfos).forEach(info => {
    info.features.forEach(f => allFeaturesInCap.add(f));
  });
  return Array.from(allFeaturesInCap).sort().map(feature => {
    const featureName = FEATURE_DISPLAY_NAMES[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const tiersWithFeature = COMPARISON_TIERS.filter(t => {
      const info = tierInfos[t];
      const isCurrent = t === currentTierKey;
      const resolvedInfo = currentTierCapStatus?.[capKey];
      if (isCurrent && resolvedInfo) {
        return resolvedInfo.enabled && (resolvedInfo.flexible || info.features.includes(feature));
      }
      return info.enabled && (info.flexible || info.features.includes(feature));
    });
    return { feature, featureName, tiersWithFeature: tiersWithFeature.length, available: tiersWithFeature.length > 0 };
  });
}

export default function TierFeaturesClient({ tenantId }: { tenantId: string }) {
  const { tenant, tier, loading } = useTenantComplete(tenantId);
  const tierConfig = useTierConfig();
  const { data: allCaps, loading: capsLoading } = useAllCapabilities(tenantId);
  const [expandedCap, setExpandedCap] = useState<string | null>(null);

  const currentTierKey = tier?.effective?.id || tenant?.subscriptionTier || 'discovery';
  const currentTierName = TIER_DISPLAY_NAMES[currentTierKey] || currentTierKey;
  const currentTierPrice = TIER_PRICING[currentTierKey] ?? 0;

  // Resolved capabilities for the current tenant
  const resolvedCaps = useMemo(() => {
    if (!allCaps) return null;
    return summarizeResolvedCapabilities(allCaps);
  }, [allCaps]);

  // Build capability comparison matrix across tiers
  const comparisonMatrix = useMemo(() => {
    const tierFeaturesMap: Record<string, string[]> = {};
    COMPARISON_TIERS.forEach(t => {
      tierFeaturesMap[t] = tierConfig.getTierFeatures(t);
    });

    return CAPABILITY_META.map(capMeta => {
      const tierInfos: Record<string, TierCapabilityInfo> = {};
      COMPARISON_TIERS.forEach(t => {
        tierInfos[t] = getTierCapabilityInfo(tierFeaturesMap[t], capMeta.key, capMeta.flexibleKeys);
      });
      return { ...capMeta, tierInfos };
    });
  }, [tierConfig]);

  // For the current tier column, use resolved capabilities if available
  const currentTierCapStatus = useMemo(() => {
    if (!resolvedCaps) return null;
    const map: Record<string, { enabled: boolean; flexible: boolean }> = {};
    resolvedCaps.forEach(rc => {
      map[rc.key] = { enabled: rc.enabled, flexible: rc.flexible };
    });
    return map;
  }, [resolvedCaps]);

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
              Your current plan and capability comparison
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
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-neutral-200">
                <h2 className="text-lg font-semibold text-neutral-900">Capability Comparison</h2>
                <p className="text-sm text-neutral-500 mt-1">
                  Capabilities available at each tier — flexible means all features in the capability are unlocked
                </p>
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
                    {comparisonMatrix.map((row, idx) => {
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
