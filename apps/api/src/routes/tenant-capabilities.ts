/**
 * Tenant Capabilities API Routes
 * 
 * Public-facing endpoint that returns a tenant's tier capabilities
 * grouped by capability type. Used by storefront, checkout, and
 * tenant dashboard to make capability-aware decisions.
 * 
 * Unlike /api/admin/tier-capabilities (admin-only), this endpoint
 * is tenant-scoped and accessible with tenant or no auth.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { getEffectiveTier } from '../utils/trial-tier-transparency';
import { deriveInternalStatus } from '../utils/subscription-status';
import { resolveEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';

const router = Router({ mergeParams: true });

/**
 * Capability type feature prefix mapping
 * Used to determine which capability type a feature belongs to
 */
const CAPABILITY_TYPE_PREFIXES: Record<string, string> = {
  commerce_types: 'commerce_',
  payment_gateway_options: 'payment_gateway_',
  storefront_types: 'storefront_',
  storefront_options: 'storefront_opt_',
  featured_options: 'featured_',
  integration_options: 'integration_',
  quickstart_options: 'quickstart_',
  faq_options: 'faq_',
  chatbot_options: 'chatbot_',
};

/**
 * Resolve a slug or tenant ID to a tenant ID using the tenants table directly.
 * No dependency on directory_listings_list — works even if directory is unpublished.
 */
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

/**
 * GET /api/tenants/:tenantId/capabilities
 * 
 * Returns the tenant's tier capabilities grouped by capability type.
 * Accessible with tenant auth (for dashboard) or public (for storefront).
 * 
 * Response format:
 * {
 *   tier_key: "professional",
 *   capabilities: {
 *     commerce_types: {
 *       capability_enabled: true,
 *       is_flexible: true,
 *       features: { commerce_enabled: true, commerce_both_options: true, ... }
 *     },
 *     ...
 *   },
 *   uncategorized_features: ["business_logo", ...]
 * }
 */
/**
 * GET /api/tenants/resolve/:identifier
 * Resolve a slug or tenant ID to a tenant ID using the tenants table directly.
 * No dependency on directory_listings_list — works even if directory is unpublished.
 * Public access (no auth required) for storefront use.
 */
router.get('/resolve/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    if (!identifier) {
      return res.status(400).json({ success: false, error: 'identifier_required' });
    }

    const resolved = await resolveTenantIdentifier(identifier);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }

    return res.json({
      success: true,
      data: {
        tenantId: resolved.id,
        slug: resolved.slug,
        identifierType: identifier.startsWith('tid-') ? 'tenant_id' : 'slug'
      }
    });
  } catch (error: any) {
    console.error('[GET /api/tenants/resolve/:identifier] Error:', error);
    return res.status(500).json({ success: false, error: 'failed_to_resolve_tenant' });
  }
});

/**
 * GET /api/tenants/:tenantId/capabilities
 *
 * Returns the tenant's tier capabilities grouped by capability type.
 * Accepts both tenant IDs (tid-...) and slugs as the :tenantId parameter.
 * Accessible with tenant auth (for dashboard) or public (for storefront).
 */
router.get('/:tenantId/capabilities', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId required' });
    }

    // Resolve identifier: could be a tenant ID or a slug
    const resolved = await resolveTenantIdentifier(tenantId);

    if (!resolved) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Look up tenant and their tier using the resolved ID
    const tenant = await prisma.tenants.findUnique({
      where: { id: resolved.id },
      select: {
        id: true,
        subscription_tier: true,
        subscription_status: true,
        organization_id: true,
        organizations_list: {
          select: { subscription_tier: true },
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    const orgTierKey = tenant.organizations_list?.subscription_tier || null;
    const tenantTierKey = tenant.subscription_tier || null;

    // Proxy trial tiers to their base tiers for feature resolution
    // Trial tiers are pricing wrappers — real capabilities live on the base tier
    const resolvedOrgTierKey = orgTierKey ? getEffectiveTier(orgTierKey) : null;
    const resolvedTenantTierKey = tenantTierKey ? getEffectiveTier(tenantTierKey) : null;

    // Fetch features from both org tier and tenant tier, then merge (most-permissive-wins)
    const tierKeys = [resolvedOrgTierKey, resolvedTenantTierKey].filter((k): k is string => !!k);
    const tiers = await prisma.subscription_tiers_list.findMany({
      where: { tier_key: { in: tierKeys } },
    });

    // Build a map of tier_key -> tier record
    const tierMap = new Map(tiers.map(t => [t.tier_key, t]));

    // Collect features from all applicable tiers
    const allTierIds = tiers.map(t => t.id);

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

    // Merge features: tenant features override org features for same key (most-permissive-wins)
    // If a feature is enabled in ANY tier, it's enabled in the merged result
    const mergedFeatures = new Map<string, { feature_key: string; is_enabled: boolean; is_highlighted: boolean; capability_type_list: any }>();

    for (const tf of tierFeatures) {
      const existing = mergedFeatures.get(tf.feature_key);
      if (existing) {
        // Union: enabled if enabled in either tier, highlighted if highlighted in either
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

    // Group merged features by capability type
    const capabilities: Record<string, {
      capability_enabled: boolean;
      is_highlighted: boolean;
      features: Record<string, boolean>;
    }> = {};

    const uncategorizedFeatures: string[] = [];

    for (const tf of mergedFeatures.values()) {
      const capKey = tf.capability_type_list?.key;

      if (capKey) {
        if (!capabilities[capKey]) {
          capabilities[capKey] = {
            capability_enabled: true,
            is_highlighted: false,
            features: {},
          };
        }
        capabilities[capKey].features[tf.feature_key] = tf.is_enabled;
        if (tf.is_highlighted) {
          capabilities[capKey].is_highlighted = true;
        }
      } else {
        uncategorizedFeatures.push(tf.feature_key);
      }
    }

    // Report the higher tier as the effective tier_key
    // Org tier overrides tenant tier (same logic as /tenants/:id/tier endpoint)
    // Use resolved keys so trial tiers report their base tier for capabilities
    const effectiveTierKey = resolvedOrgTierKey || resolvedTenantTierKey || 'starter';

    // Look up tier display metadata
    const effectiveTier = tierMap.get(effectiveTierKey);
    const tierName = effectiveTier?.name || effectiveTierKey;
    const tierDescription = effectiveTier?.description || '';

    res.json({
      tier_key: effectiveTierKey,
      tier_name: tierName,
      tier_description: tierDescription,
      capabilities,
      uncategorized_features: uncategorizedFeatures,
    });
  } catch (error) {
    console.error('[GET /api/tenants/:tenantId/capabilities] Error:', error);
    res.status(500).json({ error: 'failed_to_get_tenant_capabilities' });
  }
});

/**
 * GET /api/tenants/capabilities/tiers-by-capability?capabilityTypeKey=...
 *
 * Returns all tiers that have a given capability type enabled.
 * Accessible with tenant auth (for upgrade messaging in tenant UI).
 *
 * Response: [{ tier_key, tier_name, tier_description, capability_enabled, features: [...] }]
 */
router.get('/capabilities/tiers-by-capability', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { capabilityTypeKey } = req.query;
    if (!capabilityTypeKey || typeof capabilityTypeKey !== 'string') {
      return res.status(400).json({ error: 'capabilityTypeKey required' });
    }

    const capType = await prisma.capability_type_list.findUnique({ where: { key: capabilityTypeKey } });
    if (!capType) return res.status(404).json({ error: 'capability_type_not_found' });

    const tierFeatures = await prisma.tier_features_list.findMany({
      where: { capability_type_id: capType.id, is_enabled: true },
      include: {
        subscription_tiers_list: { select: { tier_key: true, name: true, description: true } },
      },
      orderBy: { tier_id: 'asc' },
    });

    // Group by tier
    const tierMap = new Map<string, {
      tier_key: string;
      tier_name: string;
      tier_description: string;
      capability_enabled: boolean;
      features: { feature_key: string; feature_name: string; is_enabled: boolean }[];
    }>();

    for (const tf of tierFeatures) {
      const tierKey = tf.subscription_tiers_list?.tier_key;
      if (!tierKey) continue;

      if (!tierMap.has(tierKey)) {
        tierMap.set(tierKey, {
          tier_key: tierKey,
          tier_name: tf.subscription_tiers_list?.name || tierKey,
          tier_description: tf.subscription_tiers_list?.description || '',
          capability_enabled: true,
          features: [],
        });
      }
      tierMap.get(tierKey)!.features.push({
        feature_key: tf.feature_key,
        feature_name: tf.feature_name,
        is_enabled: tf.is_enabled,
      });
    }

    res.json(Array.from(tierMap.values()));
  } catch (error) {
    console.error('[GET /api/tenants/capabilities/tiers-by-capability] Error:', error);
    res.status(500).json({ error: 'failed_to_list_tiers_by_capability' });
  }
});

/**
 * Build a complete effective-capabilities response for a tenant that exists
 * but has no resolvable tier data (e.g. expired/canceled subscription with
 * no matching tier in subscription_tiers_list).
 *
 * All capabilities are disabled. The subscription_context reflects the
 * tenant's actual subscription status so the frontend can show appropriate
 * read-only / expired messaging.
 */
function buildExpiredCapabilitiesResponse(tenant: {
  id: string;
  subscription_status: string | null;
  subscription_tier: string | null;
  trial_ends_at: Date | null;
  subscription_ends_at: Date | null;
}) {
  const internalStatus = deriveInternalStatus({
    subscription_status: tenant.subscription_status,
    subscription_tier: tenant.subscription_tier,
    trialEndsAt: tenant.trial_ends_at,
    subscription_ends_at: tenant.subscription_ends_at,
  });
  const isReadOnly = internalStatus === 'frozen' || internalStatus === 'canceled' || internalStatus === 'expired';

  return {
    tenant_id: tenant.id,
    tier: {
      key: tenant.subscription_tier || 'unknown',
      name: tenant.subscription_tier || 'Unknown',
      description: '',
    },
    subscription_context: {
      internalStatus,
      maintenanceState: null,
      isReadOnly,
      isLimited: false,
      writable: !isReadOnly,
    },
    effective: {
      commerce: {
        enabled: false,
        cart_visible: false,
        payment_type: 'none' as const,
        effective_payment_type: 'none' as const,
        effective_cart_visible: false,
        checkout_available: false,
        checkout_mode: { mode: 'disabled' as const },
        merchant_preferences: { deposit_enabled: false, full_payment_enabled: false },
        is_flexible: false,
      },
      payment_gateway: {
        enabled: false,
        allowed_gateways: [],
        effective_gateways: [],
        checkout_available: false,
        merchant_preferences: { gateway_enabled: false, stripe_enabled: false, paypal_enabled: false, square_enabled: false, clover_enabled: false },
        is_flexible: false,
      },
      storefront: {
        enabled: false,
        type: 'none' as const,
        effective_type: 'none' as const,
        is_flexible: false,
        allowed_types: [],
        has_merchant_selection: false,
        merchant_preferences: { storefront_type_enabled: false, selected_storefront_type: 'none' as const },
      },
      fulfillment: {
        enabled: false,
        shows_pickup: false,
        shows_delivery: false,
        shows_shipping: false,
        shows_service: false,
        effective_shows_pickup: false,
        effective_shows_delivery: false,
        effective_shows_shipping: false,
        merchant_preferences: { pickup_enabled: false, delivery_enabled: false, shipping_enabled: false },
        is_flexible: false,
        delivery_radius_miles: null,
        delivery_fee_cents: 0,
        delivery_min_free_cents: null,
        delivery_time_hours: 0,
        shipping_flat_rate_cents: null,
        shipping_min_free_cents: null,
        shipping_handling_days: 0,
        pickup_ready_time_minutes: 0,
        pickup_instructions: null,
      },
      product_types: {
        enabled: false,
        type: 'none' as const,
        effective_type: 'none' as const,
        is_flexible: false,
        allowed_types: [],
        has_merchant_selection: false,
        merchant_preferences: {
          product_types_enabled: false,
          selected_product_type: 'none' as const,
        },
      },
      product_options: {
        enabled: false,
        allowed_types: [],
        effective_types: [],
        creation_enabled: false,
        shows_variants: false,
        shows_gallery: false,
        shows_video: false,
        effective_shows_variants: false,
        effective_shows_gallery: false,
        effective_shows_video: false,
        layout_enabled: false,
        allowed_layouts: [],
        effective_layout: 'classic' as const,
        can_use_layout_classic: false,
        can_use_layout_editorial: false,
        can_use_layout_immersive: false,
        sections_enabled: false,
        shows_recently_viewed: false,
        shows_qr_codes: false,
        shows_qr_logo: false,
        shows_recommended: false,
        shows_map_display: false,
        shows_location_display: false,
        shows_hours_display: false,
        shows_enhanced_seo: false,
        shows_reviews: false,
        shows_fulfillment: false,
        shows_categories: false,
        shows_location_availability: false,
        effective_shows_recently_viewed: false,
        effective_shows_qr_codes: false,
        effective_shows_qr_logo: false,
        effective_shows_recommended: false,
        effective_shows_map_display: false,
        effective_shows_location_display: false,
        effective_shows_hours_display: false,
        effective_shows_enhanced_seo: false,
        effective_shows_reviews: false,
        effective_shows_fulfillment: false,
        effective_shows_categories: false,
        effective_shows_location_availability: false,
        shows_supplier_catalog: false,
        effective_shows_supplier_catalog: false,
        merchant_preferences: {},
        is_flexible: false,
      },
      featured: {
        enabled: false,
        tenant_enabled: false,
        platform_enabled: false,
        allowed_tenant_types: [],
        allowed_platform_types: [],
        allowed_types: [],
        effective_tenant_types: [],
        effective_platform_types: [],
        effective_types: [],
        featured_available: false,
        effective_featured_available: false,
        expiry_monitor_enabled: false,
        merchant_preferences: {},
        is_flexible: false,
      },
      integrations: {
        enabled: false,
        pos_enabled: false,
        google_enabled: false,
        allowed_pos_types: [],
        allowed_google_types: [],
        allowed_types: [],
        effective_pos_types: [],
        effective_google_types: [],
        effective_types: [],
        integrations_available: false,
        effective_integrations_available: false,
        merchant_preferences: {},
        is_flexible: false,
      },
      quickstart: {
        enabled: false,
        is_flexible: false,
        product_enabled: false,
        allowed_product_types: [],
        category_enabled: false,
        allowed_category_types: [],
        ai_enabled: false,
        allowed_ai_types: [],
        can_use_wizard: false,
        can_use_ai_wizard: false,
        can_use_category_generator: false,
        can_generate_images: false,
        can_use_openai: false,
        can_use_gemini: false,
        can_use_hd_images: false,
        merchant_preferences: {},
      },
      storefront_options: {
        enabled: false,
        is_flexible: false,
        hours_enabled: false,
        allowed_hours_types: [],
        category_enabled: false,
        allowed_category_types: [],
        recommend_enabled: false,
        allowed_recommend_types: [],
        recently_viewed_enabled: false,
        info_enabled: false,
        allowed_info_types: [],
        qr_enabled: false,
        allowed_qr_resolutions: [],
        allowed_qr_content_types: [],
        gallery_enabled: false,
        allowed_gallery_types: [],
        advanced_enabled: false,
        allowed_advanced_types: [],
        layout_enabled: false,
        allowed_layouts: [],
        effective_layout: 'classic' as const,
        can_show_hours_display: false,
        can_use_animated_hours: false,
        can_show_hours_status: false,
        can_show_map_display: false,
        can_show_location_display: false,
        can_use_category_store: false,
        can_use_category_product: false,
        can_use_recommend_store: false,
        can_use_recommend_products: false,
        can_use_recently_viewed: false,
        can_use_social_media: false,
        can_use_contact: false,
        can_use_interactive_maps: false,
        can_use_qr_codes: false,
        can_use_enhanced_seo: false,
        can_use_storefront_actions: false,
        can_use_layout_classic: false,
        can_use_layout_editorial: false,
        can_use_layout_immersive: false,
        merchant_preferences: {},
      },
      directory_entry: {
        enabled: false,
        is_flexible: false,
        layout_enabled: false,
        allowed_layouts: [],
        effective_layout: 'classic' as const,
        can_use_layout_classic: false,
        can_use_layout_editorial: false,
        can_use_layout_immersive: false,
        can_use_layout_premium: false,
        hours_enabled: false,
        map_enabled: false,
        contact_enabled: false,
        gallery_enabled: false,
        qr_enabled: false,
        social_enabled: false,
        seo_enabled: false,
        can_show_hours: false,
        can_show_map: false,
        can_show_contact: false,
        can_show_gallery: false,
        can_show_qr: false,
        can_show_social: false,
        can_show_seo: false,
        can_show_external_link: false,
        external_link_enabled: false,
        merchant_preferences: {},
      },
      faq: {
        enabled: false,
        storefront_enabled: false,
        product_enabled: false,
        templates_enabled: false,
        management_enabled: false,
        preview_enabled: false,
        display_enabled: false,
        kb_enabled: false,
        allowed_management_types: [],
        allowed_preview_types: [],
        allowed_display_types: [],
        allowed_kb_types: [],
        is_flexible: false,
        faq_available: false,
        merchant_preferences: null,
      },
      crm: {
        enabled: false,
        inquiry_product_enabled: false,
        inquiry_storefront_enabled: false,
        inquiry_directory_enabled: false,
        contacts_enabled: false,
        ticket_features_enabled: false,
        message_features_enabled: false,
        customer_tickets_enabled: false,
        dashboard_enabled: false,
        allowed_inquiry_types: [],
        allowed_contact_types: [],
        allowed_ticket_types: [],
        allowed_message_types: [],
        allowed_customer_ticket_types: [],
        allowed_dashboard_types: [],
        is_flexible: false,
        crm_available: false,
        merchant_preferences: null,
      },
      chatbot: {
        enabled: false,
        static_enabled: false,
        dynamic_enabled: false,
        skills_enabled: false,
        kb_enabled: false,
        widget_enabled: false,
        allowed_response_engines: [],
        allowed_skill_types: [],
        allowed_kb_types: [],
        allowed_widget_types: [],
        is_flexible: false,
        chatbot_available: false,
        can_use_widget_custom_theme: false,
        can_use_widget_skill_cards: false,
        can_use_widget_after_hours: false,
        merchant_preferences: null,
      },
      barcode_scan: {
        enabled: false,
        allowed_modes: [],
        effective_modes: [],
        is_flexible: false,
        scan_available: false,
        effective_scan_available: false,
        merchant_preferences: { barcode_scan_enabled: false, barcode_manual_enabled: false, barcode_usb_enabled: false, barcode_camera_enabled: false },
      },
      org_options: {
        enabled: false,
        is_flexible: false,
        allowed_tabs: [],
        allowed_panels: [],
        allowed_propagation_types: [],
        org_available: false,
      },
      social_commerce_options: {
        enabled: false,
        is_flexible: false,
        meta_enabled: false,
        allowed_meta_types: [],
        tiktok_enabled: false,
        allowed_tiktok_types: [],
        experience_enabled: false,
        allowed_experience_types: [],
        can_use_meta_catalog: false,
        can_use_meta_shop: false,
        can_use_meta_pixel: false,
        can_use_tiktok_catalog: false,
        can_use_tiktok_shop: false,
        can_use_tiktok_pixel: false,
        can_use_share_buttons: false,
        can_use_social_proof: false,
        can_use_abandoned_cart: false,
        social_commerce_available: false,
        merchant_preferences: {},
      },
    },
    constraint_violations: [],
    constraint_status: {},
    uncategorized_features: [],
    purchased_feature_keys: [],
  };
}

/**
 * GET /api/tenants/:tenantId/effective-capabilities
 *
 * Unified capabilities endpoint — returns a flat "effective capability manifest"
 * with tier hard-gates + merchant soft-gates already resolved server-side.
 *
 * Query params:
 *   ?detail=full  — includes raw `gates` section for settings/debug pages
 */
router.get('/:tenantId/effective-capabilities', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const detail = req.query.detail === 'full' ? 'full' : 'summary';

    const result = await resolveEffectiveCapabilities(tenantId, { detail });

    if (!result) {
      // Tenant not resolved by the service — check if it exists but has no resolvable
      // capabilities (e.g. expired subscription with no tier data).
      // Try ID first, then slug fallback.
      const tenantData = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { id: true, subscription_status: true, subscription_tier: true, trial_ends_at: true, subscription_ends_at: true },
      }) ?? await prisma.tenants.findFirst({
        where: { slug: tenantId },
        select: { id: true, subscription_status: true, subscription_tier: true, trial_ends_at: true, subscription_ends_at: true },
      });

      if (tenantData) {
        return res.status(200).json({
          success: true,
          data: buildExpiredCapabilitiesResponse(tenantData),
        });
      }

      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.setHeader('Vary', 'Accept-Encoding, Accept-Language');
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[GET /effective-capabilities] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve effective capabilities',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/system-status
 *
 * Returns a capability-aware system status summary.
 * All detection logic runs server-side via EffectiveCapabilityResolver
 * + business state queries in a single round-trip.
 */
router.get('/:tenantId/system-status', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const { resolveSystemStatus } = await import('../services/SystemStatusService');
    const result = await resolveSystemStatus(tenantId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[GET /system-status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve system status',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/next-steps
 *
 * Returns a tier-and-capability-aware onboarding task list.
 * All detection logic runs server-side in a single round-trip.
 */
router.get('/:tenantId/next-steps', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const { resolveNextSteps } = await import('../services/NextStepsService');
    const tasks = await resolveNextSteps(tenantId);

    if (tasks === null) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('[GET /next-steps] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve next steps',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/growth-tips
 *
 * Returns tier-and-capability-aware growth tips.
 * Multi-dimensional: tier level, capabilities, usage, subscription status,
 * location status, visibility status, and growth path.
 *
 * Query params:
 *   ?limit=N  — max tips to return (default 5)
 */
router.get('/:tenantId/growth-tips', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);

    const { resolveGrowthTips } = await import('../services/GrowthTipService');
    const tips = await resolveGrowthTips(tenantId, limit);

    if (tips === null) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: tips,
    });
  } catch (error) {
    console.error('[GET /growth-tips] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve growth tips',
    });
  }
});

/**
 * GET /api/tenants/:tenantId/quick-links
 *
 * Returns a tier-and-capability-aware quick links list for the dashboard.
 * All detection logic runs server-side via EffectiveCapabilityResolver
 * + business state queries in a single round-trip.
 */
router.get('/:tenantId/quick-links', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    const { resolveQuickLinks } = await import('../services/QuickLinksService');
    const links = await resolveQuickLinks(tenantId);

    if (links === null) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    res.setHeader('Cache-Control', 'private, max-age=30, s-maxage=30');
    res.json({
      success: true,
      data: links,
    });
  } catch (error) {
    console.error('[GET /quick-links] Error:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve quick links',
    });
  }
});

export default router;
