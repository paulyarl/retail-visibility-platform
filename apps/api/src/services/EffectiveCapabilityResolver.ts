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

/**
 * Invalidate the in-memory cache for a tenant.
 * Call this from every settings PUT handler.
 */
export function invalidateEffectiveCapabilities(tenantId: string): void {
  MEMORY_CACHE.delete(tenantId);
  logger.debug('[EffectiveCapabilityResolver] Invalidated cache', undefined, { tenantId, correlationId: generateCorrelationId(tenantId) });
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
      product_options: effective[5],
      featured: effective[6],
      integrations: effective[7],
      quickstart: effective[8],
      storefront_options: effective[9],
      directory_entry: effective[10],
      faq: effective[11],
      crm: effective[12],
      chatbot: effective[13],
      org_options: effective[14],
      social_commerce_options: effective[15],
    },
    uncategorized_features: rawCaps.uncategorized_features,
    purchased_feature_keys: rawCaps.purchased_feature_keys || [],
  };

  // 6. Apply subscription-status-aware capability override
  const internalStatus = deriveInternalStatus({
    subscription_status: tenant.subscription_status,
    subscription_tier: tenant.subscription_tier,
    trialEndsAt: tenant.trial_ends_at,
    subscription_ends_at: tenant.subscription_ends_at,
  });

  const maintenanceState = getMaintenanceState({
    tier: tenant.subscription_tier,
    status: tenant.subscription_status,
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

    // Read-only capabilities — keep enabled=true so UI shows them (read-only mode)
    // Frontend checks subscription_context.writable to lock write operations
    // CRM, Storefront, Product Options, Featured, Storefront Options, Directory Entry, FAQ, Org Options
  }

  if (isLimited) {
    // Maintenance mode: disable write-heavy capabilities
    result.effective.barcode_scan.enabled = false;
    result.effective.quickstart.enabled = false;
    result.effective.featured.enabled = false;
    result.effective.chatbot.enabled = false;
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
// HELPER: Tenant Identifier Resolution
// ====================

async function resolveTenantIdentifier(identifier: string): Promise<{ id: string; slug: string | null } | null> {
  if (identifier.startsWith('tid-')) {
    const tenant = await prisma.tenants.findUnique({
      where: { id: identifier },
      select: { id: true, slug: true },
    });
    return tenant;
  }

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
  ] = await Promise.all([
    safeQuery(() => prisma.tenant_commerce_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_payment_gateway_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_storefront_type_settings.findUnique({ where: { tenant_id: tenantId } })),
    safeQuery(() => prisma.tenant_fulfillment_settings.findUnique({ where: { tenant_id: tenantId } })),
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
  ]);

  return {
    commerce: commerce as any,
    paymentGateway: paymentGateway as any,
    storefrontType: storefrontType as any,
    fulfillment: fulfillment as any,
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

  return gates;
}
