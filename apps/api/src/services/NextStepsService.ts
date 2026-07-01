/**
 * Next Steps Service
 *
 * Tier-and-capability-aware onboarding task engine.
 *
 * Mirrors the multi-dimensional architecture of the growth tip engine:
 * - Tier level determines which tasks are relevant
 * - Effective capabilities (from EffectiveCapabilityResolver) determine feature availability
 * - Business state (products, FAQs, directory, profile completeness) determines completion
 * - Subscription status gates certain tasks
 *
 * All detection happens server-side in a single round-trip, replacing the
 * previous frontend hack of passing 15+ boolean props from scattered API calls.
 */

import { prisma } from '../prisma';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { logger } from '../logger';
import type { EffectiveCapabilities } from './resolvers/types';

// ====================
// TYPES
// ====================

export type TaskCategory = 'profile' | 'visibility' | 'commerce' | 'engagement' | 'subscription';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface NextStepTask {
  id: string;
  label: string;
  done: boolean;
  link: string;
  category: TaskCategory;
  priority: TaskPriority;
}

interface TaskContext {
  tenantId: string;
  tierKey: string;
  capabilities: EffectiveCapabilities | null;
  businessState: {
    hasProducts: boolean;
    totalItems: number;
    activeItems: number;
    hasPublishedDirectory: boolean;
    hasFeaturedProducts: boolean;
    hasFAQs: boolean;
    faqEnabled: boolean;
    hasHours: boolean;
    hasLogo: boolean;
    hasMap: boolean;
    hasStoreCategory: boolean;
    hasSlug: boolean;
    locationStatus: string;
    subscriptionStatus: string;
    ordersCount: number;
  };
}

interface TaskDefinition {
  id: string;
  label: (ctx: TaskContext) => string;
  link: (ctx: TaskContext) => string;
  category: TaskCategory;
  priority: TaskPriority;
  /** Whether this task should appear for this tenant */
  condition: (ctx: TaskContext) => boolean;
  /** Whether this task is completed */
  isDone: (ctx: TaskContext) => boolean;
  /** Sort score — higher appears first among incomplete tasks */
  score: (ctx: TaskContext) => number;
}

// ====================
// CAPABILITY HELPERS
// ====================

function hasCommerce(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.commerce.enabled ?? false;
}

function hasPaymentGateway(ctx: TaskContext): boolean {
  const pg = ctx.capabilities?.effective.payment_gateway;
  return !!pg && pg.enabled && pg.checkout_available;
}

function hasFulfillment(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.fulfillment.enabled ?? false;
}

function hasFAQ(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.faq.enabled ?? false;
}

function hasFeatured(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.featured.enabled ?? false;
}

function hasChatbot(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.chatbot.enabled ?? false;
}

function hasCRM(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.crm.enabled ?? false;
}

function hasStorefront(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.storefront.enabled ?? false;
}

function hasSocialCommerce(ctx: TaskContext): boolean {
  return ctx.capabilities?.effective.social_commerce_options.enabled ?? false;
}

function isReadOnly(ctx: TaskContext): boolean {
  return ctx.capabilities?.subscription_context.isReadOnly ?? false;
}

// ── Capability selection helpers ──

function needsStorefrontTypeSelection(ctx: TaskContext): boolean {
  const sf = ctx.capabilities?.effective.storefront;
  return !!sf && sf.enabled && sf.is_flexible && !sf.has_merchant_selection;
}

function needsProductTypeSelection(ctx: TaskContext): boolean {
  const pt = ctx.capabilities?.effective.product_types;
  return !!pt && pt.enabled && pt.is_flexible && !pt.has_merchant_selection;
}

function needsFulfillmentMethodSelection(ctx: TaskContext): boolean {
  const f = ctx.capabilities?.effective.fulfillment;
  if (!f || !f.enabled) return false;
  return !f.effective_shows_pickup && !f.effective_shows_delivery && !f.effective_shows_shipping;
}

// ====================
// TIER HELPERS
// ====================

const TIER_ORDER: string[] = [
  'google_only', 'starter', 'discovery', 'storefront', 'commitment',
  'omnichannel', 'professional', 'enterprise',
  'chain_starter', 'chain_professional', 'chain_enterprise', 'custom',
];

function tierIndex(key: string): number {
  const idx = TIER_ORDER.indexOf(key);
  return idx >= 0 ? idx : 0;
}

function isDiscoveryOrBelow(key: string): boolean {
  return tierIndex(key) <= tierIndex('discovery');
}

function isStorefrontOrBelow(key: string): boolean {
  return tierIndex(key) <= tierIndex('storefront');
}

function isCommitmentOrAbove(key: string): boolean {
  return tierIndex(key) >= tierIndex('commitment');
}

// ====================
// TASK DEFINITIONS
// ====================

const TASKS: TaskDefinition[] = [

  // ── CAPABILITY SELECTIONS: Highest priority — tier enables feature but merchant hasn't chosen ──

  {
    id: 'storefront-type-selection',
    label: () => 'Select your storefront type',
    link: (ctx) => `/t/${ctx.tenantId}/settings/storefront-options`,
    category: 'visibility',
    priority: 'critical',
    condition: (ctx) => needsStorefrontTypeSelection(ctx),
    isDone: (ctx) => !needsStorefrontTypeSelection(ctx),
    score: () => 120,
  },

  {
    id: 'product-type-selection',
    label: () => 'Select your product type',
    link: (ctx) => `/t/${ctx.tenantId}/settings/product-options`,
    category: 'visibility',
    priority: 'critical',
    condition: (ctx) => needsProductTypeSelection(ctx),
    isDone: (ctx) => !needsProductTypeSelection(ctx),
    score: () => 115,
  },

  {
    id: 'fulfillment-method-selection',
    label: () => 'Choose your fulfillment methods',
    link: (ctx) => `/t/${ctx.tenantId}/settings/fulfillment`,
    category: 'commerce',
    priority: 'critical',
    condition: (ctx) => needsFulfillmentMethodSelection(ctx),
    isDone: (ctx) => !needsFulfillmentMethodSelection(ctx),
    score: () => 110,
  },

  // ── PROFILE: Business identity setup ──

  {
    id: 'location',
    label: () => 'Verify your business location',
    link: (ctx) => `/t/${ctx.tenantId}/settings/location-status`,
    category: 'profile',
    priority: 'critical',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.locationStatus === 'active',
    score: () => 100,
  },

  {
    id: 'logo',
    label: () => 'Upload your store logo',
    link: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    category: 'profile',
    priority: 'medium',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.hasLogo,
    score: () => 70,
  },

  {
    id: 'slug',
    label: () => 'Add your shop URL slug',
    link: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    category: 'profile',
    priority: 'medium',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.hasSlug,
    score: () => 65,
  },

  {
    id: 'store-location',
    label: () => 'Add your store location',
    link: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    category: 'profile',
    priority: 'high',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.hasMap,
    score: () => 82,
  },

  {
    id: 'category',
    label: () => 'Add your store category',
    link: (ctx) => `/t/${ctx.tenantId}/settings/gbp-category`,
    category: 'profile',
    priority: 'high',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.hasStoreCategory,
    score: () => 80,
  },

  {
    id: 'hours',
    label: () => 'Add your business hours',
    link: (ctx) => `/t/${ctx.tenantId}/settings/hours`,
    category: 'profile',
    priority: 'high',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.hasHours,
    score: () => 85,
  },

  // ── VISIBILITY: Products and directory ──

  {
    id: 'products',
    label: () => 'Add your first product',
    link: (ctx) => `/t/${ctx.tenantId}/items/create`,
    category: 'visibility',
    priority: 'critical',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.hasProducts,
    score: () => 95,
  },

  {
    id: 'directory',
    label: () => 'Publish your directory listing',
    link: (ctx) => `/t/${ctx.tenantId}/settings/directory`,
    category: 'visibility',
    priority: 'critical',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.hasPublishedDirectory,
    score: () => 90,
  },

  {
    id: 'featured',
    label: () => 'Feature your first product',
    link: (ctx) => `/t/${ctx.tenantId}/settings/featured-products`,
    category: 'visibility',
    priority: 'low',
    condition: (ctx) => hasFeatured(ctx) && ctx.businessState.hasProducts,
    isDone: (ctx) => ctx.businessState.hasFeaturedProducts,
    score: () => 40,
  },

  // ── COMMERCE: Payment and fulfillment (tier-gated) ──

  {
    id: 'payments',
    label: (ctx) => hasPaymentGateway(ctx) ? 'Connect payment providers' : 'Explore payment options',
    link: (ctx) => `/t/${ctx.tenantId}/settings/payment-gateways`,
    category: 'commerce',
    priority: 'critical',
    condition: (ctx) => hasCommerce(ctx) && !isDiscoveryOrBelow(ctx.tierKey),
    isDone: (ctx) => hasPaymentGateway(ctx),
    score: () => 92,
  },

  {
    id: 'shipping',
    label: () => 'Set up shipping rates',
    link: (ctx) => `/t/${ctx.tenantId}/settings/fulfillment`,
    category: 'commerce',
    priority: 'high',
    condition: (ctx) => hasFulfillment(ctx) && isCommitmentOrAbove(ctx.tierKey),
    isDone: (ctx) => {
      const f = ctx.capabilities?.effective.fulfillment;
      if (!f) return false;
      return f.effective_shows_pickup || f.effective_shows_delivery || f.effective_shows_shipping;
    },
    score: () => 75,
  },

  {
    id: 'discounts',
    label: () => 'Create your first discount',
    link: (ctx) => `/t/${ctx.tenantId}/settings/commerce`,
    category: 'commerce',
    priority: 'low',
    condition: (ctx) => hasCommerce(ctx) && isCommitmentOrAbove(ctx.tierKey),
    isDone: (ctx) => ctx.businessState.ordersCount > 0,
    score: () => 35,
  },

  // ── ENGAGEMENT: FAQs, chatbot, CRM (capability-gated) ──

  {
    id: 'faqs',
    label: (ctx) => {
      if (!hasFAQ(ctx)) return 'FAQs are not available on your plan';
      if (!ctx.businessState.faqEnabled) return 'Enable FAQs to manage them';
      return 'Add your first FAQs';
    },
    link: (ctx) => {
      if (!hasFAQ(ctx)) return `/t/${ctx.tenantId}/settings/subscription`;
      if (!ctx.businessState.faqEnabled) return `/t/${ctx.tenantId}/faq/options`;
      return `/t/${ctx.tenantId}/faq`;
    },
    category: 'engagement',
    priority: 'medium',
    condition: () => true,
    isDone: (ctx) => {
      if (!hasFAQ(ctx)) return true; // not available = not actionable
      if (!ctx.businessState.faqEnabled) return false;
      return ctx.businessState.hasFAQs;
    },
    score: (ctx) => {
      if (!hasFAQ(ctx)) return 10;
      return 60;
    },
  },

  {
    id: 'chatbot',
    label: () => 'Activate your AI chatbot',
    link: (ctx) => `/t/${ctx.tenantId}/bot`,
    category: 'engagement',
    priority: 'medium',
    condition: (ctx) => hasChatbot(ctx) && !isDiscoveryOrBelow(ctx.tierKey),
    isDone: (ctx) => {
      // Done if chatbot is configured — we check via bot_configurations existence
      // For now, mark as done if capability is enabled and tenant has FAQs (proxy for "engaged")
      return ctx.businessState.hasFAQs && hasChatbot(ctx);
    },
    score: () => 50,
  },

  {
    id: 'crm',
    label: () => 'Set up your support hub',
    link: (ctx) => `/t/${ctx.tenantId}/support`,
    category: 'engagement',
    priority: 'low',
    condition: (ctx) => hasCRM(ctx) && !isDiscoveryOrBelow(ctx.tierKey),
    isDone: (ctx) => hasCRM(ctx) && ctx.businessState.hasPublishedDirectory,
    score: () => 30,
  },

  {
    id: 'social-commerce',
    label: () => 'Connect your social commerce channels',
    link: (ctx) => `/t/${ctx.tenantId}/settings/social-commerce`,
    category: 'engagement',
    priority: 'low',
    condition: (ctx) => hasSocialCommerce(ctx) && ctx.businessState.hasProducts,
    isDone: (ctx) => false, // Always show as an opportunity until they connect
    score: () => 25,
  },

  // ── SUBSCRIPTION ──

  {
    id: 'subscription',
    label: () => 'Activate your subscription',
    link: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    category: 'subscription',
    priority: 'critical',
    condition: () => true,
    isDone: (ctx) => ctx.businessState.subscriptionStatus === 'active',
    score: () => 88,
  },

  {
    id: 'storefront',
    label: () => 'Enable your branded storefront',
    link: (ctx) => `/t/${ctx.tenantId}/settings/storefront-options`,
    category: 'visibility',
    priority: 'high',
    condition: (ctx) => hasStorefront(ctx) && !isDiscoveryOrBelow(ctx.tierKey) && !needsStorefrontTypeSelection(ctx),
    isDone: (ctx) => hasStorefront(ctx) && !needsStorefrontTypeSelection(ctx),
    score: () => 78,
  },
];

// ====================
// CORE SERVICE
// ====================

/**
 * Resolve next-steps tasks for a tenant.
 *
 * Performs a single round of DB queries + capability resolution,
 * then evaluates all task definitions to produce a sorted list.
 *
 * @param tenantIdOrSlug  Tenant ID or slug
 * @returns Array of NextStepTask sorted by: incomplete first (by score desc), then complete
 */
export async function resolveNextSteps(
  tenantIdOrSlug: string
): Promise<NextStepTask[] | null> {
  try {
    // 1. Resolve tenant identifier
    const tenantId = await resolveTenantId(tenantIdOrSlug);
    if (!tenantId) {
      logger.warn('[NextStepsService] Tenant not found', undefined, { identifier: tenantIdOrSlug });
      return null;
    }

    // 2. Fetch effective capabilities + business state in parallel
    const [capabilities, businessState] = await Promise.all([
      resolveEffectiveCapabilities(tenantId).catch(() => null),
      fetchBusinessState(tenantId),
    ]);

    const tierKey = capabilities?.tier.key || 'starter';

    // 3. Build context
    const ctx: TaskContext = {
      tenantId,
      tierKey,
      capabilities,
      businessState,
    };

    // 4. Evaluate all tasks
    const tasks: NextStepTask[] = TASKS
      .filter((def) => {
        try { return def.condition(ctx); } catch { return false; }
      })
      .map((def) => {
        let done = false;
        try { done = def.isDone(ctx); } catch { done = false; }
        let s = 0;
        try { s = def.score(ctx); } catch { s = 0; }
        return {
          task: def,
          done,
          score: s,
        };
      })
      .sort((a, b) => {
        // Incomplete tasks first, sorted by score desc
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (!a.done) return b.score - a.score;
        // Complete tasks keep original order
        return 0;
      })
      .map(({ task, done }) => ({
        id: task.id,
        label: task.label(ctx),
        done,
        link: task.link(ctx),
        category: task.category,
        priority: task.priority,
      }));

    return tasks;
  } catch (error) {
    logger.error('[NextStepsService] Failed to resolve next steps: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error, tenantIdOrSlug });
    return null;
  }
}

// ====================
// HELPERS
// ====================

async function resolveTenantId(identifier: string): Promise<string | null> {
  // Try ID lookup first
  const byId = await prisma.tenants.findUnique({
    where: { id: identifier },
    select: { id: true },
  });
  if (byId) return byId.id;

  // Fall back to slug lookup
  const bySlug = await prisma.tenants.findFirst({
    where: { slug: identifier },
    select: { id: true },
  });
  return bySlug?.id ?? null;
}

async function fetchBusinessState(tenantId: string): Promise<TaskContext['businessState']> {
  const [
    tenant,
    businessProfile,
    itemCounts,
    directoryListing,
    featuredCount,
    faqCount,
    faqOptions,
    ordersCount,
  ] = await Promise.all([
    // Tenant record
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        subscription_status: true,
        location_status: true,
        gbp_primary_category_id: true,
      },
    }),

    // Business profile
    prisma.tenant_business_profiles_list.findUnique({
      where: { tenant_id: tenantId },
      select: {
        logo_url: true,
        latitude: true,
        longitude: true,
        hours: true,
        gbp_category_id: true,
      },
    }).catch(() => null),

    // Item counts
    Promise.all([
      prisma.inventory_items.count({ where: { tenant_id: tenantId } }),
      prisma.inventory_items.count({ where: { tenant_id: tenantId, item_status: 'active' } }),
    ]).catch(() => [0, 0] as [number, number]),

    // Directory listing (published check)
    prisma.directory_listings_list.findFirst({
      where: { tenant_id: tenantId },
      select: { is_published: true },
    }).catch(() => null),

    // Featured products count
    prisma.featured_products.count({
      where: { tenant_id: tenantId, is_active: true },
    }).catch(() => 0),

    // FAQ count
    prisma.faqs.count({
      where: { tenant_id: tenantId },
    }).catch(() => 0),

    // FAQ options (faq_enabled master switch)
    prisma.tenant_faq_options_settings.findUnique({
      where: { tenant_id: tenantId },
      select: { faq_enabled: true },
    }).catch(() => null),

    // Orders count
    prisma.orders.count({
      where: { tenant_id: tenantId },
    }).catch(() => 0),
  ]);

  const [totalItems, activeItems] = itemCounts as [number, number];

  const hasHours = !!businessProfile?.hours &&
    typeof businessProfile.hours === 'object' &&
    Object.keys(businessProfile.hours as object).length > 0;

  return {
    hasProducts: totalItems > 0,
    totalItems,
    activeItems,
    hasPublishedDirectory: directoryListing?.is_published === true,
    hasFeaturedProducts: featuredCount > 0,
    hasFAQs: faqCount > 0,
    faqEnabled: faqOptions?.faq_enabled ?? true,
    hasHours,
    hasLogo: !!businessProfile?.logo_url,
    hasMap: !!(businessProfile?.latitude && businessProfile?.longitude),
    hasStoreCategory: !!(businessProfile?.gbp_category_id || tenant?.gbp_primary_category_id),
    hasSlug: !!tenant?.slug,
    locationStatus: tenant?.location_status || 'active',
    subscriptionStatus: tenant?.subscription_status || 'active',
    ordersCount,
  };
}
