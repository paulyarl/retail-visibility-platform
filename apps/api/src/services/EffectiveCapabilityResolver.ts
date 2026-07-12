/**
 * Effective Capability Resolver
 *
 * The core orchestrator for the unified capabilities endpoint.
 *
 * Performs a single DB round-trip to fetch tier features + all merchant
 * settings tables, then dispatches to per-domain resolvers to produce a
 * flat "effective capability manifest" that the frontend can consume
 * without any client-side merge logic.
 */

import { prisma } from '../prisma';
import { getEffectiveTier } from '../utils/trial-tier-transparency';
import { deriveInternalStatus, getMaintenanceState } from '../utils/subscription-status';
import { logger } from '../logger';
import { generateCorrelationId, generateTenantKey } from '../lib/id-generator';
import {
  resolveCommerce,
  resolvePaymentGateway,
  resolveStorefrontType,
  resolveFulfillment,
  resolveBarcodeScan,
  resolveProductType,
  resolveProductOptions,
  resolveFeaturedOptions,
  resolveIntegrationOptions,
  resolveQuickstartOptions,
  resolveStorefrontOptions,
  resolveDirectoryEntryOptions,
  resolveFaqOptions,
  resolveCrmOptions,
  resolveChatbotOptions,
  resolveOrgOptions,
  resolveSocialCommerceOptions,
  resolveDirectoryPromotion,
  resolveWholesaleMatching,
  applyCrossCapabilityConstraints,
} from './resolvers';
import type {
  EffectiveCapabilities,
  MerchantSettingsBundle,
  RawCapabilitiesInput,
  SubscriptionContext,
} from './resolvers/types';

// ====================
// CACHE (in-memory LRU per worker)
// ====================

interface CacheEntry {
  data: EffectiveCapabilities;
  expiry: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry>();
const MEMORY_TTL_MS = 60_000; // 60 seconds

const MV_CACHE = new Map<string, CacheEntry>();
const MV_TTL_MS = 60_000; // 60 seconds

/**
 * Invalidate the in-memory cache for a tenant.
 * Call this from every settings PUT handler.
 */
export function invalidateEffectiveCapabilities(tenantId: string): void {
  MEMORY_CACHE.delete(tenantId);
  MV_CACHE.delete(tenantId);
  logger.debug('[EffectiveCapabilityResolver] Invalidated caches (resolver + MV)', undefined, { tenantId, correlationId: generateCorrelationId(tenantId) });
}

// ====================
// CORE RESOLVER
// ====================

/**
 * Resolve all effective capabilities for a tenant.
 *
 * @param tenantIdOrSlug  Tenant ID (tid-*) or slug
 * @param opts            detail=full includes raw gates for settings pages
 * @returns Unified effective capability manifest
 */
export async function resolveEffectiveCapabilities(
  tenantIdOrSlug: string,
  opts: { detail?: 'full' | 'summary' } = {}
): Promise<EffectiveCapabilities | null> {
  const detail = opts.detail ?? 'summary';
  const correlationId = generateCorrelationId();
  const logMeta = { correlationId, tenantId: tenantIdOrSlug };

  // 1. Resolve identifier
  const resolved = await resolveTenantIdentifier(tenantIdOrSlug);
  if (!resolved) {
    logger.warn('[EffectiveCapabilityResolver] Tenant not found', undefined, logMeta);
    return null;
  }
  const tenantId = resolved.id;
  logMeta.tenantId = tenantId;

  // 2. Check in-memory cache
  const cached = MEMORY_CACHE.get(tenantId);
  if (cached && cached.expiry > Date.now()) {
    logger.debug('[EffectiveCapabilityResolver] Memory cache hit', undefined, logMeta);
    // Clone to prevent mutation
    return { ...cached.data };
  }

  // 3. Fetch tenant + tier + merchant settings in parallel
  const [tenant, rawCaps, merchantBundle] = await Promise.all([
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        organization_id: true,
        org_standing_mode: true,
        organizations_list: { select: { subscription_tier: true, subscription_status: true } },
      },
    }),
    fetchRawCapabilities(tenantId),
    fetchMerchantSettings(tenantId),
  ]);

  if (!tenant || !rawCaps) {
    logger.warn('[EffectiveCapabilityResolver] Unable to resolve capabilities', undefined, logMeta);
    return null;
  }

  // 4. Build tier info
  const tierInfo = {
    key: rawCaps.tier_key,
    name: rawCaps.tier_name || rawCaps.tier_key,
    description: rawCaps.tier_description || '',
  };

  // 5. Dispatch to per-domain resolvers
  const effective = await Promise.all([
    resolveCommerce(tenantId, rawCaps, merchantBundle.commerce),
    resolvePaymentGateway(
      rawCaps.capabilities.payment_gateway_options?.features || {},
      merchantBundle.paymentGateway
    ),
    resolveStorefrontType(tenantId, merchantBundle.storefrontType),
    resolveFulfillment(
      rawCaps.capabilities.fulfillment_options?.features || {},
      merchantBundle.fulfillment
    ),
    resolveBarcodeScan(
      rawCaps.capabilities.barcode_scan_options?.features || {},
      merchantBundle.barcodeScan
    ),
    resolveProductType(
      rawCaps.capabilities.product_types?.features || {},
      merchantBundle.productType
    ),
    resolveProductOptions(
      rawCaps.capabilities.product_options?.features || {},
      merchantBundle.productOptions
    ),
    resolveFeaturedOptions(
      rawCaps.capabilities.featured_options?.features || {},
      merchantBundle.featuredOptions
    ),
    resolveIntegrationOptions(
      rawCaps.capabilities.integration_options?.features || {},
      merchantBundle.integrationOptions,
      rawCaps.capabilities.integration_options?.capability_enabled
    ),
    resolveQuickstartOptions(
      rawCaps.capabilities.quickstart_options?.features || {},
      merchantBundle.quickstartOptions
    ),
    resolveStorefrontOptions(
      rawCaps.capabilities.storefront_options?.features || {},
      merchantBundle.storefrontOptions
    ),
    resolveDirectoryEntryOptions(
      rawCaps.capabilities.directory_entry?.features || {},
      merchantBundle.directoryEntry
    ),
    resolveFaqOptions(
      rawCaps.capabilities.faq_options?.features || {},
      merchantBundle.faqOptions
    ),
    resolveCrmOptions(
      rawCaps.capabilities.crm_options?.features || {},
      merchantBundle.crmOptions
    ),
    resolveChatbotOptions(
      rawCaps.capabilities.chatbot_options?.features || {},
      merchantBundle.chatbotOptions
    ),
    resolveOrgOptions(
      rawCaps.capabilities.organization_options?.features || {},
      rawCaps.capabilities.organization_options?.capability_enabled
    ),
    resolveSocialCommerceOptions(
      rawCaps.capabilities.social_commerce_options?.features || {},
      merchantBundle.socialCommerceOptions
    ),
    resolveDirectoryPromotion(
      rawCaps.capabilities.directory_promotion?.features || {},
      rawCaps.capabilities.directory_promotion?.capability_enabled
    ),
    resolveWholesaleMatching(
      rawCaps.capabilities.wholesale_matching_options?.features || {},
      merchantBundle.wholesaleMatching
    ),
  ]);

  const result: EffectiveCapabilities = {
    tenant_id: tenantId,
    tier: tierInfo,
    subscription_context: {
      internalStatus: 'active',
      maintenanceState: null,
      isReadOnly: false,
      isLimited: false,
      writable: true,
    },
    effective: {
      commerce: effective[0],
      payment_gateway: effective[1],
      storefront: effective[2],
      fulfillment: effective[3],
      barcode_scan: effective[4],
      product_types: effective[5],
      product_options: effective[6],
      featured: effective[7],
      integrations: effective[8],
      quickstart: effective[9],
      storefront_options: effective[10],
      directory_entry: effective[11],
      faq: effective[12],
      crm: effective[13],
      chatbot: effective[14],
      org_options: effective[15],
      social_commerce_options: effective[16],
      directory_promotion: effective[17],
      wholesale_matching: effective[18],
    },
    constraint_violations: [],
    constraint_status: {},
    uncategorized_features: rawCaps.uncategorized_features,
    purchased_feature_keys: rawCaps.purchased_feature_keys || [],
  };

  // 5.5. Apply cross-capability constraints (post-resolution pass)
  const { violations, constraint_status } = await applyCrossCapabilityConstraints(result.effective);
  result.constraint_violations = violations;
  result.constraint_status = constraint_status;

  // 6. Apply subscription-status-aware capability override
  // Asymmetric inheritance: if tenant is in 'inherited' mode and org is in good standing,
  // the tenant's STATUS is lifted to 'active' regardless of its own status.
  // The tenant's TIER is never replaced — capabilities are always resolved from the
  // tenant's own tier (steps 4-5). Org tier only gates org-level features (org_options, propagation).
  // Org bad standing does NOT drag the tenant down — tenant's own status is the floor.
  const standingMode = tenant.org_standing_mode || 'independent';
  let effectiveStatus = tenant.subscription_status;

  if (standingMode === 'inherited' && tenant.organizations_list) {
    const orgInternalStatus = deriveInternalStatus({
      subscription_status: tenant.organizations_list.subscription_status,
      subscription_tier: tenant.organizations_list.subscription_tier,
      trialEndsAt: null,
      subscription_ends_at: null,
    });
    // Only lift up — org active/trialing/past_due rescues a frozen/canceled/expired tenant
    if (orgInternalStatus === 'active' || orgInternalStatus === 'trialing' || orgInternalStatus === 'past_due') {
      effectiveStatus = 'active';
    }
    // If org is also bad, fall through with tenant's own status (no change)
  }

  const internalStatus = deriveInternalStatus({
    subscription_status: effectiveStatus,
    subscription_tier: tenant.subscription_tier,
    trialEndsAt: tenant.trial_ends_at,
    subscription_ends_at: tenant.subscription_ends_at,
  });

  const maintenanceState = getMaintenanceState({
    tier: tenant.subscription_tier,
    status: effectiveStatus,
    trialEndsAt: tenant.trial_ends_at,
  });

  const isReadOnly = internalStatus === 'frozen' || internalStatus === 'canceled' || internalStatus === 'expired';
  const isLimited = internalStatus === 'maintenance' || internalStatus === 'past_due';

  const subCtx: SubscriptionContext = {
    internalStatus,
    maintenanceState,
    isReadOnly,
    isLimited,
    writable: !isReadOnly,
  };
  result.subscription_context = subCtx;

  if (isReadOnly) {
    // Fully disabled capabilities — set enabled=false and zero out sub-features
    result.effective.chatbot.enabled = false;
    result.effective.barcode_scan.enabled = false;
    result.effective.quickstart.enabled = false;
    result.effective.commerce.enabled = false;
    result.effective.fulfillment.enabled = false;
    result.effective.integrations.enabled = false;
    result.effective.payment_gateway.enabled = false;
    result.effective.directory_promotion.enabled = false;
    result.effective.wholesale_matching.enabled = false;

    // Read-only capabilities — keep enabled=true so UI shows them (read-only mode)
    // Frontend checks subscription_context.writable to lock write operations
    // CRM, Storefront, Product Options, Featured, Storefront Options, Directory Entry, FAQ, Org Options

    // CRM is a platform communication channel, not a feature benefit.
    // Force enabled regardless of tier so tenants can always receive alerts,
    // view tickets/tasks, and respond to existing items.
    result.effective.crm.enabled = true;
    result.effective.crm.crm_available = true;
  }

  // CRM is always available as a platform communication channel regardless of tier.
  // If the tier doesn't include CRM features, force minimal access (read + respond).
  if (!result.effective.crm.enabled) {
    result.effective.crm.enabled = true;
    result.effective.crm.crm_available = true;
  }

  if (isLimited) {
    // Maintenance mode: disable write-heavy capabilities
    result.effective.barcode_scan.enabled = false;
    result.effective.quickstart.enabled = false;
    result.effective.featured.enabled = false;
    result.effective.chatbot.enabled = false;
    result.effective.directory_promotion.enabled = false;
    result.effective.wholesale_matching.enabled = false;
    // Payment Gateway stays active in maintenance
    // CRM stays active in maintenance
    // FAQ stays active in maintenance
  }

  // Org-level subscription status check
  const orgStatus = tenant.organizations_list?.subscription_status;
  const orgTier = tenant.organizations_list?.subscription_tier;
  if (orgStatus && orgTier) {
    const orgInternalStatus = deriveInternalStatus({
      subscription_status: orgStatus,
      subscription_tier: orgTier,
      trialEndsAt: null,
      subscription_ends_at: null,
    });
    const orgReadOnly = orgInternalStatus === 'frozen' || orgInternalStatus === 'canceled' || orgInternalStatus === 'expired';
    if (orgReadOnly) {
      result.effective.org_options.enabled = false;
    }
  }

  logger.debug('[EffectiveCapabilityResolver] Subscription context applied', undefined, {
    ...logMeta,
    internalStatus,
    isReadOnly,
    isLimited,
  });

  // 7. Attach raw gates for authenticated / detail=full requests
  if (detail === 'full') {
    result.gates = {
      tier_hard: rawCaps.capabilities,
      merchant_soft: buildMerchantSoftGates(merchantBundle),
    };
  }

  // 8. Cache in memory
  MEMORY_CACHE.set(tenantId, { data: result, expiry: Date.now() + MEMORY_TTL_MS });

  return result;
}

// ====================
// MV-BASED RESOLVER (for public endpoints)
// ====================

/**
 * Invalidate the MV-based cache for a tenant.
 * Called alongside invalidateEffectiveCapabilities when settings change.
 */
export function invalidateMVCapabilities(tenantId: string): void {
  MV_CACHE.delete(tenantId);
}

/**
 * Fetch raw capabilities from the pre-resolved materialized view.
 *
 * Replaces the 5+ queries in fetchRawCapabilities with a single MV lookup.
 * The MV already merges tier features, BSaaS purchases, admin overrides,
 * and all three flexible expansions.
 *
 * Trade-off: data is up to 10 minutes stale (MV refresh interval).
 * Acceptable for public/read-only surfaces. Not for settings pages or
 * post-purchase confirmation — those use resolveEffectiveCapabilities.
 */
async function fetchRawCapabilitiesFromMV(tenantId: string): Promise<RawCapabilitiesInput | null> {
  // 1. Get all enabled feature keys for this tenant from the MV
  const mvRows = await prisma.$queryRaw<{ feature_key: string }[]>`
    SELECT feature_key FROM mv_tenant_effective_capabilities WHERE tenant_id = ${tenantId}
  `;

  // 2. Get tier info from tenants table
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: {
      subscription_tier: true,
      organization_id: true,
      organizations_list: { select: { subscription_tier: true } },
    },
  });

  if (!tenant) return null;

  const orgTierKey = tenant.organizations_list?.subscription_tier || null;
  const tenantTierKey = tenant.subscription_tier || null;
  const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
  const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;
  const effectiveTierKey = resolvedOrgTierKey || resolvedTenantTierKey || 'starter';

  const tier = await prisma.subscription_tiers_list.findFirst({
    where: { tier_key: effectiveTierKey },
    select: { name: true, description: true },
  });

  // 3. If MV has no rows, the tenant has no enabled features.
  // Still return a valid RawCapabilitiesInput with empty capabilities.
  const featureKeys = mvRows.map(r => r.feature_key);

  // 4. Look up capability types for these features
  let capabilities: Record<string, { capability_enabled: boolean; is_highlighted: boolean; features: Record<string, boolean> }> = {};
  const uncategorizedFeatures: string[] = [];

  if (featureKeys.length > 0) {
    const features = await prisma.features_list.findMany({
      where: { key: { in: featureKeys } },
      select: { id: true, key: true },
    });

    const featureIdToKey = new Map(features.map(f => [f.id, f.key]));
    const capLinks = await prisma.capability_features_list.findMany({
      where: { feature_id: { in: [...featureIdToKey.keys()] } },
      include: { capability_type_list: { select: { key: true } } },
    });

    const featureKeyToCapKey = new Map<string, string>();
    for (const link of capLinks) {
      const fKey = featureIdToKey.get(link.feature_id);
      if (fKey && link.capability_type_list?.key) {
        featureKeyToCapKey.set(fKey, link.capability_type_list.key);
      }
    }

    // Fallback: for feature keys not found in capability_features_list,
    // check tier_features_list.capability_type_id (same source as fetchRawCapabilities).
    // This handles cases where seed scripts set capability_type_id on tier_features_list
    // but capability_features_list links are missing or were overwritten.
    const unmappedKeys = featureKeys.filter(fk => !featureKeyToCapKey.has(fk));
    if (unmappedKeys.length > 0) {
      const tierFeatureLinks = await prisma.tier_features_list.findMany({
        where: { feature_key: { in: unmappedKeys }, is_enabled: true },
        include: { capability_type_list: { select: { key: true } } },
      });

      for (const tfl of tierFeatureLinks) {
        if (tfl.capability_type_list?.key && !featureKeyToCapKey.has(tfl.feature_key)) {
          featureKeyToCapKey.set(tfl.feature_key, tfl.capability_type_list.key);
        }
      }
    }

    for (const fk of featureKeys) {
      const capKey = featureKeyToCapKey.get(fk);
      if (capKey) {
        if (!capabilities[capKey]) {
          capabilities[capKey] = { capability_enabled: true, is_highlighted: false, features: {} };
        }
        capabilities[capKey].features[fk] = true;
      } else {
        uncategorizedFeatures.push(fk);
      }
    }
  }

  // 5. Lightweight query for purchased feature keys (for metadata)
  const purchases = await prisma.tenant_feature_purchases.findMany({
    where: {
      tenant_id: tenantId,
      status: { in: ['active', 'past_due', 'trial'] },
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { feature_key: true },
  });

  return {
    tier_key: effectiveTierKey,
    tier_name: tier?.name || effectiveTierKey,
    tier_description: tier?.description || '',
    capabilities,
    uncategorized_features: uncategorizedFeatures,
    purchased_feature_keys: purchases.map(p => p.feature_key),
    override_feature_keys: [],
  };
}

/**
 * Resolve effective capabilities using the pre-resolved MV.
 *
 * Same output shape as resolveEffectiveCapabilities, but raw capabilities
 * come from the MV instead of the multi-query fetchRawCapabilities.
 *
 * Use this for public/read-only endpoints where 10-minute staleness is acceptable.
 * Use resolveEffectiveCapabilities for settings pages, post-purchase, and write routes.
 */
export async function resolveEffectiveCapabilitiesFromMV(
  tenantIdOrSlug: string,
  opts: { detail?: 'full' | 'summary' } = {}
): Promise<EffectiveCapabilities | null> {
  const detail = opts.detail ?? 'summary';
  const correlationId = generateCorrelationId();
  const logMeta = { correlationId, tenantId: tenantIdOrSlug };

  // 1. Resolve identifier
  const resolved = await resolveTenantIdentifier(tenantIdOrSlug);
  if (!resolved) {
    logger.warn('[MVCapabilities] Tenant not found', undefined, logMeta);
    return null;
  }
  const tenantId = resolved.id;
  logMeta.tenantId = tenantId;

  // 2. Check MV cache
  const cached = MV_CACHE.get(tenantId);
  if (cached && cached.expiry > Date.now()) {
    logger.debug('[MVCapabilities] Cache hit', undefined, logMeta);
    return { ...cached.data };
  }

  // 3. Fetch tenant + MV raw caps + merchant settings in parallel
  const [tenant, rawCaps, merchantBundle] = await Promise.all([
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
        trial_ends_at: true,
        subscription_ends_at: true,
        organization_id: true,
        org_standing_mode: true,
        organizations_list: { select: { subscription_tier: true, subscription_status: true } },
      },
    }),
    fetchRawCapabilitiesFromMV(tenantId),
    fetchMerchantSettings(tenantId),
  ]);

  if (!tenant || !rawCaps) {
    logger.warn('[MVCapabilities] Unable to resolve capabilities', undefined, logMeta);
    return null;
  }

  // 4. Build tier info
  const tierInfo = {
    key: rawCaps.tier_key,
    name: rawCaps.tier_name || rawCaps.tier_key,
    description: rawCaps.tier_description || '',
  };

  // 5. Dispatch to per-domain resolvers (same pipeline as resolveEffectiveCapabilities)
  const effective = await Promise.all([
    resolveCommerce(tenantId, rawCaps, merchantBundle.commerce),
    resolvePaymentGateway(
      rawCaps.capabilities.payment_gateway_options?.features || {},
      merchantBundle.paymentGateway
    ),
    resolveStorefrontType(tenantId, merchantBundle.storefrontType),
    resolveFulfillment(
      rawCaps.capabilities.fulfillment_options?.features || {},
      merchantBundle.fulfillment
    ),
    resolveBarcodeScan(
      rawCaps.capabilities.barcode_scan_options?.features || {},
      merchantBundle.barcodeScan
    ),
    resolveProductType(
      rawCaps.capabilities.product_types?.features || {},
      merchantBundle.productType
    ),
    resolveProductOptions(
      rawCaps.capabilities.product_options?.features || {},
      merchantBundle.productOptions
    ),
    resolveFeaturedOptions(
      rawCaps.capabilities.featured_options?.features || {},
      merchantBundle.featuredOptions
    ),
    resolveIntegrationOptions(
      rawCaps.capabilities.integration_options?.features || {},
      merchantBundle.integrationOptions,
      rawCaps.capabilities.integration_options?.capability_enabled
    ),
    resolveQuickstartOptions(
      rawCaps.capabilities.quickstart_options?.features || {},
      merchantBundle.quickstartOptions
    ),
    resolveStorefrontOptions(
      rawCaps.capabilities.storefront_options?.features || {},
      merchantBundle.storefrontOptions
    ),
    resolveDirectoryEntryOptions(
      rawCaps.capabilities.directory_entry?.features || {},
      merchantBundle.directoryEntry
    ),
    resolveFaqOptions(
      rawCaps.capabilities.faq_options?.features || {},
      merchantBundle.faqOptions
    ),
    resolveCrmOptions(
      rawCaps.capabilities.crm_options?.features || {},
      merchantBundle.crmOptions
    ),
    resolveChatbotOptions(
      rawCaps.capabilities.chatbot_options?.features || {},
      merchantBundle.chatbotOptions
    ),
    resolveOrgOptions(
      rawCaps.capabilities.organization_options?.features || {},
      rawCaps.capabilities.organization_options?.capability_enabled
    ),
    resolveSocialCommerceOptions(
      rawCaps.capabilities.social_commerce_options?.features || {},
      merchantBundle.socialCommerceOptions
    ),
    resolveDirectoryPromotion(
      rawCaps.capabilities.directory_promotion?.features || {},
      rawCaps.capabilities.directory_promotion?.capability_enabled
    ),
    resolveWholesaleMatching(
      rawCaps.capabilities.wholesale_matching_options?.features || {},
      merchantBundle.wholesaleMatching
    ),
  ]);

  const result: EffectiveCapabilities = {
    tenant_id: tenantId,
    tier: tierInfo,
    subscription_context: {
      internalStatus: 'active',
      maintenanceState: null,
      isReadOnly: false,
      isLimited: false,
      writable: true,
    },
    effective: {
      commerce: effective[0],
      payment_gateway: effective[1],
      storefront: effective[2],
      fulfillment: effective[3],
      barcode_scan: effective[4],
      product_types: effective[5],
      product_options: effective[6],
      featured: effective[7],
      integrations: effective[8],
      quickstart: effective[9],
      storefront_options: effective[10],
      directory_entry: effective[11],
      faq: effective[12],
      crm: effective[13],
      chatbot: effective[14],
      org_options: effective[15],
      social_commerce_options: effective[16],
      directory_promotion: effective[17],
      wholesale_matching: effective[18],
    },
    constraint_violations: [],
    constraint_status: {},
    uncategorized_features: rawCaps.uncategorized_features,
    purchased_feature_keys: rawCaps.purchased_feature_keys || [],
  };

  // 6. Apply cross-capability constraints
  const { violations, constraint_status } = await applyCrossCapabilityConstraints(result.effective);
  result.constraint_violations = violations;
  result.constraint_status = constraint_status;

  // 7. Apply subscription-status-aware capability override
  // Asymmetric inheritance: if tenant is in 'inherited' mode and org is in good standing,
  // the tenant's STATUS is lifted to 'active' regardless of its own status.
  const standingMode = tenant.org_standing_mode || 'independent';
  let effectiveStatus = tenant.subscription_status;

  if (standingMode === 'inherited' && tenant.organizations_list) {
    const orgInternalStatus = deriveInternalStatus({
      subscription_status: tenant.organizations_list.subscription_status,
      subscription_tier: tenant.organizations_list.subscription_tier,
      trialEndsAt: null,
      subscription_ends_at: null,
    });
    if (orgInternalStatus === 'active' || orgInternalStatus === 'trialing' || orgInternalStatus === 'past_due') {
      effectiveStatus = 'active';
    }
  }

  const internalStatus = deriveInternalStatus({
    subscription_status: effectiveStatus,
    subscription_tier: tenant.subscription_tier,
    trialEndsAt: tenant.trial_ends_at,
    subscription_ends_at: tenant.subscription_ends_at,
  });

  const maintenanceState = getMaintenanceState({
    tier: tenant.subscription_tier,
    status: effectiveStatus,
    trialEndsAt: tenant.trial_ends_at,
  });

  const isReadOnly = internalStatus === 'frozen' || internalStatus === 'canceled' || internalStatus === 'expired';
  const isLimited = internalStatus === 'maintenance' || internalStatus === 'past_due';

  const subCtx: SubscriptionContext = {
    internalStatus,
    maintenanceState,
    isReadOnly,
    isLimited,
    writable: !isReadOnly,
  };
  result.subscription_context = subCtx;

  if (isReadOnly) {
    result.effective.chatbot.enabled = false;
    result.effective.barcode_scan.enabled = false;
    result.effective.quickstart.enabled = false;
    result.effective.commerce.enabled = false;
    result.effective.fulfillment.enabled = false;
    result.effective.integrations.enabled = false;
    result.effective.payment_gateway.enabled = false;
    result.effective.directory_promotion.enabled = false;
    result.effective.wholesale_matching.enabled = false;
  }

  if (isLimited) {
    result.effective.barcode_scan.enabled = false;
    result.effective.quickstart.enabled = false;
    result.effective.featured.enabled = false;
    result.effective.chatbot.enabled = false;
    result.effective.directory_promotion.enabled = false;
    result.effective.wholesale_matching.enabled = false;
  }

  // Org-level subscription status check
  const orgStatus = tenant.organizations_list?.subscription_status;
  const orgTier = tenant.organizations_list?.subscription_tier;
  if (orgStatus && orgTier) {
    const orgInternalStatus = deriveInternalStatus({
      subscription_status: orgStatus,
      subscription_tier: orgTier,
      trialEndsAt: null,
      subscription_ends_at: null,
    });
    const orgReadOnly = orgInternalStatus === 'frozen' || orgInternalStatus === 'canceled' || orgInternalStatus === 'expired';
    if (orgReadOnly) {
      result.effective.org_options.enabled = false;
    }
  }

  // 8. Attach raw gates for detail=full
  if (detail === 'full') {
    result.gates = {
      tier_hard: rawCaps.capabilities,
      merchant_soft: buildMerchantSoftGates(merchantBundle),
    };
  }

  // 9. Cache in MV cache
  MV_CACHE.set(tenantId, { data: result, expiry: Date.now() + MV_TTL_MS });

  logger.debug('[MVCapabilities] Resolved from MV', undefined, logMeta);
  return result;
}

// ====================
// HELPER: Tenant Identifier Resolution
// ====================

async function resolveTenantIdentifier(identifier: string): Promise<{ id: string; slug: string | null } | null> {
  // Try ID lookup first (works for any tenant ID format: tid-*, tenant-*, etc.)
  const byId = await prisma.tenants.findUnique({
    where: { id: identifier },
    select: { id: true, slug: true },
  });
  if (byId) return byId;

  // Fall back to slug lookup
  const tenant = await prisma.tenants.findFirst({
    where: { slug: identifier },
    select: { id: true, slug: true },
  });
  return tenant;
}

// ====================
// HELPER: Raw Capabilities (tier features)
// ====================

async function fetchRawCapabilities(tenantId: string): Promise<RawCapabilitiesInput | null> {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: {
      subscription_tier: true,
      organization_id: true,
      organizations_list: { select: { subscription_tier: true } },
    },
  });

  if (!tenant) return null;

  const orgTierKey = tenant.organizations_list?.subscription_tier || null;
  const tenantTierKey = tenant.subscription_tier || null;
  const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
  const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;

  const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);
  const tiers = tierKeys.length > 0
    ? await prisma.subscription_tiers_list.findMany({ where: { tier_key: { in: tierKeys } } })
    : [];

  const tierMap = new Map(tiers.map((t) => [t.tier_key, t]));
  const allTierIds = tiers.map((t) => t.id);

  let tierFeatures: any[] = [];
  if (allTierIds.length > 0) {
    tierFeatures = await prisma.tier_features_list.findMany({
      where: { tier_id: { in: allTierIds }, is_enabled: true },
      include: {
        capability_type_list: { select: { key: true, name: true, category: true } },
      },
      orderBy: { capability_type_id: 'asc' },
    });
  }

  // Merge features: most-permissive-wins (org-tier + tenant-tier)
  const mergedFeatures = new Map<string, { feature_key: string; is_enabled: boolean; is_highlighted: boolean; capability_type_list: any }>();
  for (const tf of tierFeatures) {
    const existing = mergedFeatures.get(tf.feature_key);
    if (existing) {
      existing.is_enabled = existing.is_enabled || tf.is_enabled;
      existing.is_highlighted = existing.is_highlighted || (tf.is_highlighted ?? false);
    } else {
      mergedFeatures.set(tf.feature_key, {
        feature_key: tf.feature_key,
        is_enabled: tf.is_enabled,
        is_highlighted: tf.is_highlighted ?? false,
        capability_type_list: tf.capability_type_list,
      });
    }
  }

  // Merge purchased features (BSaaS — à la carte feature purchases)
  // Active and past_due (grace period) purchases override tier gates with most-permissive-wins
  const purchases = await prisma.tenant_feature_purchases.findMany({
    where: {
      tenant_id: tenantId,
      status: { in: ['active', 'past_due', 'trial'] },
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { feature_key: true },
  });

  if (purchases.length > 0) {
    // Resolve capability_type for purchased features that may not be in any tier
    const purchaseFeatureKeys = purchases.map(p => p.feature_key);
    const purchaseFeatures = await prisma.features_list.findMany({
      where: { key: { in: purchaseFeatureKeys } },
      select: { id: true, key: true },
    });
    const featureIdToKey = new Map(purchaseFeatures.map(f => [f.id, f.key]));

    const capLinks = await prisma.capability_features_list.findMany({
      where: { feature_id: { in: [...featureIdToKey.keys()] } },
      include: { capability_type_list: { select: { key: true, name: true, category: true } } },
    });

    const featureKeyToCapType = new Map<string, any>();
    for (const link of capLinks) {
      const fKey = featureIdToKey.get(link.feature_id);
      if (fKey) featureKeyToCapType.set(fKey, link.capability_type_list);
    }

    for (const purchase of purchases) {
      const existing = mergedFeatures.get(purchase.feature_key);
      if (existing) {
        existing.is_enabled = true; // purchased = always enabled
      } else {
        const capType = featureKeyToCapType.get(purchase.feature_key) || null;
        mergedFeatures.set(purchase.feature_key, {
          feature_key: purchase.feature_key,
          is_enabled: true,
          is_highlighted: false,
          capability_type_list: capType,
        });
      }
    }

    // Flexible purchase expansion: if a tenant purchases {capability_key}_flexible,
    // expand to ALL features in that capability type (mirrors MV flexible_purchase_features CTE)
    for (const purchase of purchases) {
      if (!purchase.feature_key.endsWith('_flexible')) continue;
      const capType = featureKeyToCapType.get(purchase.feature_key);
      if (!capType) continue;

      const flexibleCapLinks = capLinks.filter(l => l.capability_type_list?.key === capType.key);
      for (const cfl of flexibleCapLinks) {
        const expandedFeature = featureIdToKey.get(cfl.feature_id);
        if (!expandedFeature) continue;
        const existing = mergedFeatures.get(expandedFeature);
        if (existing) {
          existing.is_enabled = true;
        } else {
          mergedFeatures.set(expandedFeature, {
            feature_key: expandedFeature,
            is_enabled: true,
            is_highlighted: false,
            capability_type_list: capType,
          });
        }
      }
    }
  }

  // Merge admin overrides (tenant_feature_overrides_list)
  // Admin can grant any feature to a tenant, including _flexible keys that expand
  // to all features in a capability type. This mirrors the MV's override + flexible_override CTEs.
  const overrides = await prisma.tenant_feature_overrides_list.findMany({
    where: {
      tenant_id: tenantId,
      granted: true,
      OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
    },
    select: { feature: true },
  });

  const overrideFeatureKeys = overrides.map(o => o.feature);

  if (overrideFeatureKeys.length > 0) {
    // Resolve capability_type for override features (same pattern as purchases)
    const overrideFeatures = await prisma.features_list.findMany({
      where: { key: { in: overrideFeatureKeys } },
      select: { id: true, key: true },
    });

    const overrideFeatureIdToKey = new Map(overrideFeatures.map(f => [f.id, f.key]));

    const overrideCapLinks = await prisma.capability_features_list.findMany({
      where: { feature_id: { in: [...overrideFeatureIdToKey.keys()] } },
      include: { capability_type_list: { select: { key: true, name: true, category: true } } },
    });

    const overrideFeatureKeyToCapType = new Map<string, any>();
    for (const link of overrideCapLinks) {
      const fKey = overrideFeatureIdToKey.get(link.feature_id);
      if (fKey) overrideFeatureKeyToCapType.set(fKey, link.capability_type_list);
    }

    // Add override features to merged map
    for (const fk of overrideFeatureKeys) {
      const existing = mergedFeatures.get(fk);
      if (existing) {
        existing.is_enabled = true;
      } else {
        const capType = overrideFeatureKeyToCapType.get(fk) || null;
        mergedFeatures.set(fk, {
          feature_key: fk,
          is_enabled: true,
          is_highlighted: false,
          capability_type_list: capType,
        });
      }
    }

    // Flexible override expansion: if an override grants {capability_key}_flexible,
    // expand to ALL features in that capability type (mirrors MV flexible_override_features CTE)
    for (const fk of overrideFeatureKeys) {
      if (!fk.endsWith('_flexible')) continue;
      const capType = overrideFeatureKeyToCapType.get(fk);
      if (!capType) continue;

      // Fetch all features linked to this capability type
      const allCapFeatures = await prisma.capability_features_list.findMany({
        where: { capability_type_id: overrideCapLinks.find(l => l.capability_type_list?.key === capType.key)?.capability_type_id, is_active: true },
        include: { features_list: { select: { key: true, is_active: true } } },
      });

      for (const cfl of allCapFeatures) {
        if (!cfl.features_list?.is_active) continue;
        const expandedKey = cfl.features_list.key;
        const existing = mergedFeatures.get(expandedKey);
        if (existing) {
          existing.is_enabled = true;
        } else {
          mergedFeatures.set(expandedKey, {
            feature_key: expandedKey,
            is_enabled: true,
            is_highlighted: false,
            capability_type_list: capType,
          });
        }
      }
    }
  }

  // Group by capability type
  const capabilities: Record<string, { capability_enabled: boolean; is_highlighted: boolean; features: Record<string, boolean> }> = {};
  const uncategorizedFeatures: string[] = [];

  for (const tf of mergedFeatures.values()) {
    const capKey = tf.capability_type_list?.key;
    if (capKey) {
      if (!capabilities[capKey]) {
        capabilities[capKey] = { capability_enabled: true, is_highlighted: false, features: {} };
      }
      capabilities[capKey].features[tf.feature_key] = tf.is_enabled;
      if (tf.is_highlighted) capabilities[capKey].is_highlighted = true;
    } else {
      uncategorizedFeatures.push(tf.feature_key);
    }
  }

  const effectiveTierKey = resolvedOrgTierKey || resolvedTenantTierKey || 'starter';
  const effectiveTier = tierMap.get(effectiveTierKey);

  return {
    tier_key: effectiveTierKey,
    tier_name: effectiveTier?.name || effectiveTierKey,
    tier_description: effectiveTier?.description || '',
    capabilities,
    uncategorized_features: uncategorizedFeatures,
    purchased_feature_keys: purchases.length > 0 ? purchases.map(p => p.feature_key) : [],
    override_feature_keys: overrideFeatureKeys.length > 0 ? overrideFeatureKeys : [],
  };
}

// ====================
// HELPER: Merchant Settings Bundle
// ====================

async function fetchMerchantSettings(tenantId: string): Promise<MerchantSettingsBundle> {
  const [
    commerce,
    paymentGateway,
    storefrontType,
    fulfillment,
    productType,
    productOptions,
    featuredOptions,
    integrationOptions,
    quickstartOptions,
    storefrontOptions,
    directoryEntry,
    faqOptions,
    crmOptions,
    chatbotOptions,
    barcodeScan,
    socialCommerceOptions,
    wholesaleMatching,
  ] = await Promise.all([
    safeQuery(() => prisma.tenant_commerce_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_payment_gateway_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_storefront_type_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_fulfillment_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_product_types_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_product_options_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_featured_options_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_integration_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_quickstart_options_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_storefront_options_settings.findUnique({ where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'storefront' } } })),
    safeQuery(() => prisma.tenant_storefront_options_settings.findUnique({ where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'directory_entry' } } })),
    safeQuery(() => prisma.tenant_faq_options_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_crm_options_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_chatbot_options_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_barcode_scan_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_social_commerce_options_settings.findUnique({ where: { tenant_id: tenantId } })),
    null,
  ]);

  return {
    commerce: commerce as any,
    paymentGateway: paymentGateway as any,
    storefrontType: storefrontType as any,
    fulfillment: fulfillment as any,
    productType: productType as any,
    productOptions: productOptions as any,
    featuredOptions: featuredOptions as any,
    integrationOptions: integrationOptions as any,
    quickstartOptions: quickstartOptions as any,
    storefrontOptions: storefrontOptions as any,
    directoryEntry: directoryEntry as any,
    faqOptions: faqOptions as any,
    crmOptions: crmOptions as any,
    chatbotOptions: chatbotOptions as any,
    barcodeScan: barcodeScan as any,
    socialCommerceOptions: socialCommerceOptions as any,
    wholesaleMatching: wholesaleMatching as any,
  };
}

async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    // Table may not exist in schema yet — return null gracefully
    return null;
  }
}

// ====================
// HELPER: Merchant Soft Gates (for detail=full)
// ====================

function buildMerchantSoftGates(bundle: MerchantSettingsBundle): Record<string, Record<string, boolean>> {
  const gates: Record<string, Record<string, boolean>> = {};

  if (bundle.commerce) {
    gates.commerce = {
      deposit_enabled: bundle.commerce.deposit_enabled ?? true,
      full_payment_enabled: bundle.commerce.full_payment_enabled ?? true,
    };
  }
  if (bundle.paymentGateway) {
    gates.payment_gateway = {
      gateway_enabled: bundle.paymentGateway.gateway_enabled ?? true,
      stripe_enabled: bundle.paymentGateway.stripe_enabled ?? true,
      paypal_enabled: bundle.paymentGateway.paypal_enabled ?? true,
      square_enabled: bundle.paymentGateway.square_enabled ?? true,
      clover_enabled: bundle.paymentGateway.clover_enabled ?? true,
    };
  }
  if (bundle.storefrontType) {
    gates.storefront = {
      storefront_type_enabled: bundle.storefrontType.storefront_type_enabled ?? true,
    };
  }
  if (bundle.fulfillment) {
    gates.fulfillment = {
      pickup_enabled: bundle.fulfillment.pickup_enabled ?? true,
      delivery_enabled: bundle.fulfillment.delivery_enabled ?? true,
      shipping_enabled: bundle.fulfillment.shipping_enabled ?? true,
    };
  }
  if (bundle.wholesaleMatching) {
    gates.wholesale_matching = {
      wholesale_matching_enabled: bundle.wholesaleMatching.wholesale_matching_enabled ?? true,
    };
  }

  return gates;
}
