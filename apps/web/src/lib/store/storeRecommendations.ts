/**
 * Tier-Aware Store Recommendation Engine
 *
 * Mirrors the growth-tip engine's tier awareness for the App Store's
 * Features and Bundles tabs. Scores catalog items using three signals:
 *
 *   1. Eligible + purchasable (base gate)
 *      - tierEligible === true
 *      - tierAvailability === 'not_in_tier' (not already in plan, not gate-off)
 *      - not already active (no live purchase)
 *
 *   2. Capability-gap signal
 *      - The item's capabilityType maps to a capability in the tenant's
 *        resolved AllCapabilitiesState that is NOT currently enabled.
 *      - i.e. buying this feature would fill a capability the tenant lacks.
 *
 *   3. Next-tier bridge signal
 *      - The item's capabilityType is in the recommended "bridge" set for
 *        the tenant's effective tier (presence → storefront → commitment
 *        → ecommerce → omnichannel → enterprise).
 *
 * Items that pass the base gate but match neither gap nor bridge are kept
 * as low-priority eligible items. Results are sorted by score (desc) and
 * limited to maxResults.
 */

import type { AllCapabilitiesState } from '@/services/CapabilityResolutionService';
import { getCapabilityTypeForFeature } from '@/services/CapabilityResolutionService';
import type { TierInfo } from '@/lib/tiers/tier-resolver';
import type {
  BsaasCatalogItem,
  BsaasBundleCatalogItem,
} from '@/services/BsaasPurchaseService';

export interface StoreRecommendationContext {
  tierLevel: TierInfo['level'];
  tierName: string;
  capabilities: AllCapabilitiesState | null;
}

export interface ScoredFeature {
  item: BsaasCatalogItem;
  score: number;
  reasons: RecommendationReason[];
}

export interface ScoredBundle {
  bundle: BsaasBundleCatalogItem;
  score: number;
  reasons: RecommendationReason[];
}

export type RecommendationReason = 'capability_gap' | 'next_tier_bridge' | 'eligible';

// ====================
// CAPABILITY → STATE MAPPING
// ====================

/**
 * Maps a catalog `capabilityType` (the capability_type_list.key) to the
 * `.enabled` flag on the tenant's resolved AllCapabilitiesState.
 */
const CAPABILITY_ENABLED_PATH: Record<string, (c: AllCapabilitiesState) => boolean> = {
  commerce_types: (c) => c.commerce?.enabled ?? false,
  payment_gateway_options: (c) => c.paymentGateway?.enabled ?? false,
  storefront_types: (c) => c.storefront?.enabled ?? false,
  storefront_options: (c) => c.storefrontOptions?.enabled ?? false,
  storefront_qr: (c) => c.storefrontQr?.enabled ?? false,
  storefront_gallery: (c) => c.storefrontGallery?.enabled ?? false,
  storefront_hours: (c) => c.storefrontHours?.enabled ?? false,
  storefront_layouts: (c) => c.storefrontLayouts?.enabled ?? false,
  storefront_maps: (c) => c.storefrontMaps?.enabled ?? false,
  barcode_scan_options: (c) => c.barcodeScan?.enabled ?? false,
  fulfillment_options: (c) => c.fulfillment?.enabled ?? false,
  product_types: (c) => c.productType?.enabled ?? false,
  product_options: (c) => c.productOptions?.enabled ?? false,
  featured_options: (c) => c.featuredOptions?.enabled ?? false,
  integration_options: (c) => c.integrationOptions?.enabled ?? false,
  quickstart_options: (c) => c.quickstartOptions?.enabled ?? false,
  directory_entry_options: (c) => c.directoryEntryOptions?.enabled ?? false,
  faq_options: (c) => c.faqOptions?.enabled ?? false,
  crm_options: (c) => c.crmOptions?.enabled ?? false,
  chatbot_options: (c) => c.chatbotOptions?.enabled ?? false,
  social_commerce_options: (c) => c.socialCommerceOptions?.enabled ?? false,
  directory_promotion: (c) => c.directoryPromotion?.enabled ?? false,
  organization_options: (c) => c.orgOptions?.enabled ?? false,
  wholesale_matching: (c) => c.wholesaleMatching?.enabled ?? false,
  platform_services: (c) => c.platformServices?.enabled ?? false,
  funnel_options: (c) => c.funnel?.enabled ?? false,
  coupon_options: (c) => c.couponOptions?.enabled ?? false,
  marketing_ops: (c) => c.marketingOps?.enabled ?? false,
  gbp_management: (c) => c.gbpManagement?.enabled ?? false,
};

/**
 * Returns true when the tenant's resolved capability state shows the given
 * capability type as enabled. Returns false when capabilities are unavailable
 * (treated as "no gap info" upstream).
 */
export function isCapabilityEnabled(
  capabilityType: string | null,
  capabilities: AllCapabilitiesState | null
): boolean | null {
  if (!capabilityType || !capabilities) return null;
  const path = CAPABILITY_ENABLED_PATH[capabilityType];
  if (!path) return null;
  return path(capabilities);
}

// ====================
// TIER BRIDGE MAPPING
// ====================

/**
 * Capability types that bridge a tenant from their current tier toward the
 * next tier in the growth path. Mirrors the growth-tip engine's nextTierName
 * progression: presence → storefront → commitment → ecommerce → omnichannel
 * → enterprise.
 */
const TIER_BRIDGE_CAPABILITIES: Partial<Record<TierInfo['level'], string[]>> = {
  // Presence-class tiers → build out a storefront presence
  directory_presence: [
    'storefront_types', 'storefront_options', 'storefront_qr', 'storefront_gallery',
    'storefront_hours', 'storefront_maps', 'faq_options', 'directory_entry_options',
  ],
  google_only: [
    'storefront_types', 'storefront_options', 'storefront_qr', 'storefront_gallery',
    'storefront_hours', 'faq_options', 'directory_entry_options',
  ],
  starter: [
    'storefront_types', 'storefront_options', 'storefront_qr', 'storefront_gallery',
    'storefront_hours', 'faq_options', 'directory_entry_options',
  ],
  discovery: [
    'storefront_types', 'storefront_options', 'storefront_qr', 'storefront_gallery',
    'storefront_hours', 'faq_options', 'directory_entry_options',
  ],
  presence: [
    'storefront_types', 'storefront_options', 'storefront_qr', 'storefront_gallery',
    'storefront_hours', 'faq_options', 'directory_entry_options',
  ],
  // Storefront tiers → add commerce + CRM to capture intent
  storefront: ['commerce_types', 'payment_gateway_options', 'crm_options', 'faq_options'],
  chain_starter: ['commerce_types', 'payment_gateway_options', 'crm_options', 'faq_options'],
  // Commitment → full commerce + fulfillment + product options
  commitment: [
    'commerce_types', 'fulfillment_options', 'product_options', 'product_types',
    'social_commerce_options', 'crm_options',
  ],
  // E-commerce → omnichannel expansion
  ecommerce: [
    'social_commerce_options', 'integration_options', 'wholesale_matching',
    'featured_options',
  ],
  // Omnichannel / professional → organization + advanced reach
  omnichannel: ['organization_options', 'integration_options', 'directory_promotion', 'marketing_ops'],
  professional: ['organization_options', 'integration_options', 'directory_promotion', 'marketing_ops'],
  organization: ['organization_options', 'directory_promotion', 'marketing_ops', 'featured_options'],
  // Enterprise / chain → optimization & retention add-ons
  enterprise: ['directory_promotion', 'marketing_ops', 'featured_options', 'coupon_options'],
  chain_professional: ['organization_options', 'integration_options', 'directory_promotion'],
  chain_enterprise: ['directory_promotion', 'marketing_ops', 'featured_options'],
  custom: [],
};

function bridgeCapabilityTypes(tierLevel: TierInfo['level']): Set<string> {
  return new Set(TIER_BRIDGE_CAPABILITIES[tierLevel] ?? []);
}

// ====================
// SCORING
// ====================

const SCORE_GAP = 50;
const SCORE_BRIDGE = 30;
const SCORE_ELIGIBLE_ONLY = 5;

/**
 * Whether a feature catalog item is purchasable right now (base gate).
 * Items already active, already in-tier, gate-off, or tier-ineligible are
 * excluded from recommendations — the store already badges those.
 */
export function isFeaturePurchasable(item: BsaasCatalogItem): boolean {
  const isActive = item.purchase?.status === 'active';
  if (isActive) return false;
  if (item.tierAvailability !== 'not_in_tier') return false;
  if (item.tierEligible === false) return false;
  return true;
}

/**
 * Whether a bundle catalog item is purchasable right now (base gate).
 */
export function isBundlePurchasable(bundle: BsaasBundleCatalogItem): boolean {
  if (bundle.allActive) return false;
  if (bundle.allInTier) return false;
  if (bundle.tierEligible === false) return false;
  return true;
}

function scoreCapabilityType(
  capabilityType: string | null,
  ctx: StoreRecommendationContext,
  bridgeSet: Set<string>
): { score: number; reasons: RecommendationReason[] } {
  let score = 0;
  const reasons: RecommendationReason[] = [];

  const enabled = isCapabilityEnabled(capabilityType, ctx.capabilities);
  // Gap signal: capability is known and NOT enabled.
  if (enabled === false) {
    score += SCORE_GAP;
    reasons.push('capability_gap');
  }

  // Bridge signal: capability type is in the next-tier bridge set.
  if (capabilityType && bridgeSet.has(capabilityType)) {
    score += SCORE_BRIDGE;
    if (!reasons.includes('next_tier_bridge')) reasons.push('next_tier_bridge');
  }

  return { score, reasons };
}

/**
 * Score and rank feature catalog items for a tenant's tier.
 * Excludes platform_services (those belong on the Services tab) and any
 * non-purchasable items.
 */
export function recommendFeatures(
  catalog: BsaasCatalogItem[],
  ctx: StoreRecommendationContext,
  maxResults = 4
): ScoredFeature[] {
  const bridgeSet = bridgeCapabilityTypes(ctx.tierLevel);

  const scored: ScoredFeature[] = catalog
    .filter((item) => item.capabilityType !== 'platform_services')
    .filter(isFeaturePurchasable)
    .map((item) => {
      const { score, reasons } = scoreCapabilityType(item.capabilityType, ctx, bridgeSet);
      // Eligible but no gap/bridge signal → keep as low-priority.
      const finalScore = score > 0 ? score : SCORE_ELIGIBLE_ONLY;
      const finalReasons: RecommendationReason[] =
        reasons.length > 0 ? reasons : ['eligible'];
      return { item, score: finalScore, reasons: finalReasons };
    });

  return scored
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .slice(0, maxResults);
}

/**
 * Score and rank bundle catalog items for a tenant's tier. A bundle's score
 * is the sum of gap/bridge signals across its component feature keys.
 */
export function recommendBundles(
  bundleCatalog: BsaasBundleCatalogItem[],
  ctx: StoreRecommendationContext,
  maxResults = 3
): ScoredBundle[] {
  const bridgeSet = bridgeCapabilityTypes(ctx.tierLevel);

  const scored: ScoredBundle[] = bundleCatalog
    .filter(isBundlePurchasable)
    .map((bundle) => {
      let score = 0;
      const reasonSet = new Set<RecommendationReason>();

      for (const component of bundle.items) {
        // Skip components the tenant already owns or already has in-tier.
        if (component.alreadyPurchased || component.inTier) continue;
        const capType = getCapabilityTypeForFeature(component.featureKey);
        const { score: componentScore, reasons } = scoreCapabilityType(capType, ctx, bridgeSet);
        score += componentScore;
        reasons.forEach((r) => reasonSet.add(r));
      }

      const finalScore = score > 0 ? score : SCORE_ELIGIBLE_ONLY;
      const finalReasons: RecommendationReason[] =
        reasonSet.size > 0 ? Array.from(reasonSet) : ['eligible'];
      return { bundle, score: finalScore, reasons: finalReasons };
    });

  return scored
    .sort((a, b) => b.score - a.score || a.bundle.name.localeCompare(b.bundle.name))
    .slice(0, maxResults);
}

// ====================
// REASON LABELS
// ====================

export const RECOMMENDATION_REASON_LABELS: Record<RecommendationReason, string> = {
  capability_gap: 'Fills a capability gap',
  next_tier_bridge: 'Steps up to your next plan',
  eligible: 'Available on your plan',
};
