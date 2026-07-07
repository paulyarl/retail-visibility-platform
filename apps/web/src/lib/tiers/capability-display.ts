import { getCapabilityTypeForFeature, AllCapabilitiesState } from '@/services/CapabilityResolutionService';
import { FEATURE_DISPLAY_NAMES, TIER_FEATURES, getTierFeatures as getTierFeaturesRaw } from '@/lib/tiers/tier-features';

export const COMPARISON_TIERS = ['discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'enterprise'];

export const CAPABILITY_GROUPS = [
  'Clover & Inventory',
  'Google Visibility',
  'Platform Presence',
  'Commerce & Conversion',
  'Management & Growth',
] as const;

export type CapabilityGroup = typeof CAPABILITY_GROUPS[number];

export const CAPABILITY_META: Array<{ key: string; label: string; flexibleKeys: string[]; group: CapabilityGroup }> = [
  { key: 'commerce_types', label: 'Commerce', flexibleKeys: ['commerce_both_options'], group: 'Commerce & Conversion' },
  { key: 'payment_gateway_options', label: 'Payment Gateways', flexibleKeys: ['payment_gateway_flexible'], group: 'Commerce & Conversion' },
  { key: 'storefront_types', label: 'Storefront Types', flexibleKeys: ['storefront_both_options'], group: 'Platform Presence' },
  { key: 'storefront_options', label: 'Storefront Options', flexibleKeys: ['storefront_opt_flexible'], group: 'Platform Presence' },
  { key: 'fulfillment_options', label: 'Fulfillment', flexibleKeys: ['fulfillment_flexible'], group: 'Commerce & Conversion' },
  { key: 'barcode_scan_options', label: 'Barcode Scan', flexibleKeys: ['barcode_flexible'], group: 'Clover & Inventory' },
  { key: 'product_types', label: 'Product Types', flexibleKeys: ['product_types_flexible'], group: 'Clover & Inventory' },
  { key: 'product_options', label: 'Product Options', flexibleKeys: ['product_options_flexible', 'product_flexible'], group: 'Clover & Inventory' },
  { key: 'featured_options', label: 'Featured', flexibleKeys: ['featured_flexible'], group: 'Management & Growth' },
  { key: 'integration_options', label: 'Integrations', flexibleKeys: ['integration_flexible'], group: 'Management & Growth' },
  { key: 'quickstart_options', label: 'Quick Start', flexibleKeys: ['quickstart_flexible'], group: 'Management & Growth' },
  { key: 'chatbot_options', label: 'Chatbot', flexibleKeys: ['chatbot_flexible'], group: 'Management & Growth' },
  { key: 'crm_options', label: 'CRM', flexibleKeys: ['crm_flexible'], group: 'Management & Growth' },
  { key: 'faq_options', label: 'FAQ', flexibleKeys: ['faq_flexible'], group: 'Management & Growth' },
  { key: 'directory_entry_options', label: 'Directory Entry', flexibleKeys: ['directory_entry_flexible'], group: 'Google Visibility' },
  { key: 'social_commerce_options', label: 'Social Commerce', flexibleKeys: ['social_commerce_flexible'], group: 'Management & Growth' },
];

export interface ResolvedCapSummary {
  key: string;
  label: string;
  enabled: boolean;
  flexible: boolean;
  detail: string;
}

export function summarizeResolvedCapabilities(caps: AllCapabilitiesState): ResolvedCapSummary[] {
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
    { key: 'directory_entry_options', label: 'Directory Entry', enabled: de.enabled, flexible: de.isFlexible, detail: de.enabled ? `${de.effectiveLayout ?? 'classic'} layout` : 'Not available' },
    { key: 'social_commerce_options', label: 'Social Commerce', enabled: scc.enabled, flexible: scc.isFlexible, detail: scc.enabled ? [scc.metaEnabled && 'Meta', scc.tiktokEnabled && 'TikTok', scc.canUseShareButtons && 'Share'].filter(Boolean).join(', ') || 'Available' : 'Not available' },
  ];
}

export function isGateKey(featureKey: string): boolean {
  return featureKey.endsWith('_enabled') || featureKey.endsWith('_disabled');
}

const ALL_FLEXIBLE_KEYS = new Set<string>(
  CAPABILITY_META.flatMap(m => m.flexibleKeys)
);

export function isFlexibleKey(featureKey: string): boolean {
  return ALL_FLEXIBLE_KEYS.has(featureKey);
}

const ALL_FEATURES_BY_CAPABILITY: Record<string, string[]> = (() => {
  const map: Record<string, Set<string>> = {};
  Object.keys(TIER_FEATURES).forEach(tier => {
    getTierFeaturesRaw(tier).forEach(f => {
      if (isGateKey(f) || isFlexibleKey(f)) return;
      const capKey = getCapabilityTypeForFeature(f);
      if (!capKey) return;
      if (!map[capKey]) map[capKey] = new Set();
      map[capKey].add(f);
    });
  });
  const result: Record<string, string[]> = {};
  Object.entries(map).forEach(([k, v]) => { result[k] = Array.from(v).sort(); });
  return result;
})();

export function getAllFeaturesForCapability(capKey: string): string[] {
  return ALL_FEATURES_BY_CAPABILITY[capKey] || [];
}

export interface TierCapabilityInfo {
  enabled: boolean;
  flexible: boolean;
  features: string[];
}

export function getTierCapabilityInfo(tierFeatures: string[], capKey: string, flexibleKeys: string[]): TierCapabilityInfo {
  const allInCap = tierFeatures.filter(f => getCapabilityTypeForFeature(f) === capKey);
  const features = allInCap.filter(f => !isGateKey(f) && !isFlexibleKey(f));
  const flexible = flexibleKeys.some(fk => tierFeatures.includes(fk));
  const hasDisabledGate = allInCap.some(f => f.endsWith('_disabled'));
  const hasEnabledGate = allInCap.some(f => f.endsWith('_enabled'));
  if (hasDisabledGate && !hasEnabledGate) {
    return { enabled: false, flexible: false, features };
  }
  return { enabled: allInCap.length > 0, flexible, features };
}

export interface FeatureRow {
  feature: string;
  featureName: string;
  tiersWithFeature: number;
  available: boolean;
}

export function getCapabilityFeatureRows(
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

export interface EffectiveFeatureRow {
  feature: string;
  featureName: string;
  capabilityKey: string;
  capabilityLabel: string;
  isPurchased: boolean;
  isFlexible: boolean;
}

export function buildEffectiveFeatures(
  tierFeatures: string[],
  purchasedFeatureKeys: string[],
  resolvedCaps: ResolvedCapSummary[] | null,
): EffectiveFeatureRow[] {
  const purchasedSet = new Set(purchasedFeatureKeys);
  const tierSet = new Set(tierFeatures);
  const allFeatures = new Set<string>(
    [...tierFeatures, ...purchasedFeatureKeys].filter(f => !isGateKey(f) && !isFlexibleKey(f))
  );
  const capLabelMap = new Map<string, string>();
  const capFlexibleSet = new Set<string>();
  if (resolvedCaps) {
    resolvedCaps.forEach(rc => {
      capLabelMap.set(rc.key, rc.label);
      if (rc.flexible) capFlexibleSet.add(rc.key);
    });
  }
  capFlexibleSet.forEach(capKey => {
    getAllFeaturesForCapability(capKey).forEach(f => allFeatures.add(f));
  });
  return Array.from(allFeatures).sort().map(feature => {
    const capKey = getCapabilityTypeForFeature(feature);
    if (!capKey) return null;
    const capLabel = capLabelMap.get(capKey) || capKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return {
      feature,
      featureName: FEATURE_DISPLAY_NAMES[feature] || feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      capabilityKey: capKey,
      capabilityLabel: capLabel,
      isPurchased: purchasedSet.has(feature) && !tierSet.has(feature),
      isFlexible: capFlexibleSet.has(capKey),
    };
  }).filter(Boolean) as EffectiveFeatureRow[];
}
