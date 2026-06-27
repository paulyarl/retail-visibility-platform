/**
 * Quick Links Service
 *
 * Tier-and-capability-aware quick links engine.
 *
 * Mirrors the architecture of NextStepsService and GrowthTipService:
 * - Tier level determines which links are relevant
 * - Effective capabilities (from EffectiveCapabilityResolver) determine feature availability
 * - Business state (products, directory, FAQs) determines context-aware labels
 * - Subscription status gates certain links
 *
 * All detection happens server-side in a single round-trip, replacing the
 * previous frontend hardcoded Quick Links section in TenantDashboardV2.
 */

import { prisma } from '../prisma';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import { logger } from '../logger';
import type { EffectiveCapabilities } from './resolvers/types';

// ====================
// TYPES
// ====================

export type LinkCategory = 'store' | 'commerce' | 'engagement' | 'settings' | 'visibility';

export interface QuickLink {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: string;
  category: LinkCategory;
  badge?: string;
}

interface LinkContext {
  tenantId: string;
  slug: string | null;
  tierKey: string;
  capabilities: EffectiveCapabilities | null;
  businessState: {
    hasProducts: boolean;
    activeItems: number;
    hasPublishedDirectory: boolean;
    hasFAQs: boolean;
    faqEnabled: boolean;
    hasStorefront: boolean;
    locationStatus: string;
    subscriptionStatus: string;
    isReadOnly: boolean;
  };
}

interface LinkDefinition {
  id: string;
  label: (ctx: LinkContext) => string;
  description: (ctx: LinkContext) => string;
  href: (ctx: LinkContext) => string;
  icon: string;
  category: LinkCategory;
  badge?: (ctx: LinkContext) => string | undefined;
  condition: (ctx: LinkContext) => boolean;
  score: (ctx: LinkContext) => number;
}

// ====================
// CAPABILITY HELPERS
// ====================

function hasCommerce(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.commerce.enabled ?? false;
}

function hasPaymentGateway(ctx: LinkContext): boolean {
  const pg = ctx.capabilities?.effective.payment_gateway;
  return !!pg && pg.enabled;
}

function hasFulfillment(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.fulfillment.enabled ?? false;
}

function hasFAQ(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.faq.enabled ?? false;
}

function hasChatbot(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.chatbot.enabled ?? false;
}

function hasCRM(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.crm.enabled ?? false;
}

function hasStorefront(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.storefront.enabled ?? false;
}

function hasIntegrations(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.integrations.enabled ?? false;
}

function hasSocialCommerce(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.social_commerce_options.enabled ?? false;
}

function hasDirectoryEntry(ctx: LinkContext): boolean {
  return ctx.capabilities?.effective.directory_entry.enabled ?? false;
}

function isReadOnly(ctx: LinkContext): boolean {
  return ctx.capabilities?.subscription_context?.isReadOnly ?? false;
}

// ── Capability selection helpers ──

function needsStorefrontTypeSelection(ctx: LinkContext): boolean {
  const sf = ctx.capabilities?.effective.storefront;
  return !!sf && sf.enabled && sf.is_flexible && !sf.has_merchant_selection;
}

function needsProductTypeSelection(ctx: LinkContext): boolean {
  const pt = ctx.capabilities?.effective.product_types;
  return !!pt && pt.enabled && pt.is_flexible && !pt.has_merchant_selection;
}

function needsFulfillmentMethodSelection(ctx: LinkContext): boolean {
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

function isCommitmentOrAbove(key: string): boolean {
  return tierIndex(key) >= tierIndex('commitment');
}

// ====================
// LINK DEFINITIONS
// ====================

const LINKS: LinkDefinition[] = [

  // ── CAPABILITY SELECTIONS: Highest priority — tier enables feature but merchant hasn't chosen ──

  {
    id: 'storefront-type-setup',
    label: () => 'Select Storefront Type',
    description: () => 'Choose your storefront type to activate key features',
    href: (ctx) => `/t/${ctx.tenantId}/settings/storefront-options`,
    icon: 'Store',
    category: 'store',
    badge: () => 'Action needed',
    condition: (ctx) => needsStorefrontTypeSelection(ctx),
    score: () => 120,
  },

  {
    id: 'product-type-setup',
    label: () => 'Select Product Type',
    description: () => 'Choose your product type to configure inventory',
    href: (ctx) => `/t/${ctx.tenantId}/settings/product-options`,
    icon: 'Package',
    category: 'store',
    badge: () => 'Action needed',
    condition: (ctx) => needsProductTypeSelection(ctx),
    score: () => 115,
  },

  {
    id: 'fulfillment-method-setup',
    label: () => 'Choose Fulfillment Methods',
    description: () => 'Select pickup, delivery, or shipping options',
    href: (ctx) => `/t/${ctx.tenantId}/settings/fulfillment`,
    icon: 'Truck',
    category: 'commerce',
    badge: () => 'Action needed',
    condition: (ctx) => needsFulfillmentMethodSelection(ctx),
    score: () => 110,
  },

  // ── STORE: Core storefront links ──

  {
    id: 'storefront',
    label: () => 'Storefront',
    description: (ctx) => ctx.businessState.hasStorefront ? 'View your public store' : 'Preview your store page',
    href: (ctx) => `/tenant/${ctx.tenantId}`,
    icon: 'Store',
    category: 'store',
    condition: (ctx) => hasStorefront(ctx),
    score: () => 100,
  },

  {
    id: 'directory',
    label: () => 'Directory Entry',
    description: (ctx) => ctx.businessState.hasPublishedDirectory ? 'Your public directory listing' : 'Publish your directory listing',
    href: (ctx) => ctx.businessState.hasPublishedDirectory
      ? `/directory/${ctx.slug || ctx.tenantId}`
      : `/t/${ctx.tenantId}/settings/directory`,
    icon: 'MapPin',
    category: 'visibility',
    badge: (ctx) => ctx.businessState.hasPublishedDirectory ? 'Live' : undefined,
    condition: (ctx) => hasDirectoryEntry(ctx),
    score: () => 92,
  },

  {
    id: 'items',
    label: () => 'Products',
    description: (ctx) => ctx.businessState.hasProducts
      ? `${ctx.businessState.activeItems} active product${ctx.businessState.activeItems !== 1 ? 's' : ''}`
      : 'Add your first product',
    href: (ctx) => `/t/${ctx.tenantId}/items`,
    icon: 'Package',
    category: 'store',
    condition: () => true,
    score: () => 88,
  },

  // ── COMMERCE: Payment and fulfillment (tier-gated) ──

  {
    id: 'payment-gateways',
    label: () => 'Payment Gateways',
    description: (ctx) => {
      const gateways = ctx.capabilities?.effective.payment_gateway?.effective_gateways ?? [];
      if (gateways.length > 0) return `${gateways.map(capitalize).join(', ')} connected`;
      return 'Connect a payment provider';
    },
    href: (ctx) => `/t/${ctx.tenantId}/settings/payment-gateways`,
    icon: 'CreditCard',
    category: 'commerce',
    condition: (ctx) => hasCommerce(ctx) && hasPaymentGateway(ctx) && !isDiscoveryOrBelow(ctx.tierKey),
    score: () => 80,
  },

  {
    id: 'fulfillment',
    label: () => 'Fulfillment',
    description: () => 'Shipping, delivery & pickup',
    href: (ctx) => `/t/${ctx.tenantId}/settings/fulfillment`,
    icon: 'Truck',
    category: 'commerce',
    condition: (ctx) => hasFulfillment(ctx) && isCommitmentOrAbove(ctx.tierKey),
    score: () => 70,
  },

  {
    id: 'commerce-settings',
    label: () => 'Commerce Settings',
    description: () => 'Checkout, deposits & orders',
    href: (ctx) => `/t/${ctx.tenantId}/settings/commerce`,
    icon: 'ShoppingCart',
    category: 'commerce',
    condition: (ctx) => hasCommerce(ctx) && !isDiscoveryOrBelow(ctx.tierKey),
    score: () => 65,
  },

  // ── ENGAGEMENT: FAQs, chatbot, CRM (capability-gated) ──

  {
    id: 'faq',
    label: () => 'FAQs',
    description: (ctx) => {
      if (!ctx.businessState.faqEnabled) return 'Enable FAQs to manage them';
      if (ctx.businessState.hasFAQs) return 'Manage your FAQs';
      return 'Add your first FAQs';
    },
    href: (ctx) => {
      if (!ctx.businessState.faqEnabled) return `/t/${ctx.tenantId}/faq/options`;
      return `/t/${ctx.tenantId}/faq`;
    },
    icon: 'HelpCircle',
    category: 'engagement',
    condition: (ctx) => hasFAQ(ctx),
    score: () => 60,
  },

  {
    id: 'chatbot',
    label: () => 'AI Chatbot',
    description: () => 'Configure your AI assistant',
    href: (ctx) => `/t/${ctx.tenantId}/bot`,
    icon: 'Bot',
    category: 'engagement',
    condition: (ctx) => hasChatbot(ctx) && !isDiscoveryOrBelow(ctx.tierKey),
    score: () => 55,
  },

  {
    id: 'support-hub',
    label: () => 'Support Hub',
    description: () => 'Tickets, tasks & help',
    href: (ctx) => `/t/${ctx.tenantId}/support`,
    icon: 'Headset',
    category: 'engagement',
    condition: (ctx) => hasCRM(ctx) && !isDiscoveryOrBelow(ctx.tierKey),
    score: () => 50,
  },

  // ── VISIBILITY: Integrations & analytics ──

  {
    id: 'integrations',
    label: () => 'Integrations',
    description: () => 'Google, POS & external syncs',
    href: (ctx) => `/t/${ctx.tenantId}/settings/integrations`,
    icon: 'Globe',
    category: 'visibility',
    condition: (ctx) => hasIntegrations(ctx),
    score: () => 45,
  },

  {
    id: 'social-commerce',
    label: () => 'Social Commerce',
    description: (ctx) => {
      const scc = ctx.capabilities?.effective.social_commerce_options;
      const parts: string[] = [];
      if (scc?.meta_enabled) parts.push('Meta');
      if (scc?.tiktok_enabled) parts.push('TikTok');
      if (scc?.can_use_share_buttons) parts.push('Share');
      if (scc?.can_use_social_proof) parts.push('Social Proof');
      return parts.length > 0 ? parts.join(', ') : 'Meta & TikTok integrations';
    },
    href: (ctx) => `/t/${ctx.tenantId}/settings/social-commerce`,
    icon: 'Share2',
    category: 'visibility',
    condition: (ctx) => hasSocialCommerce(ctx),
    score: () => 43,
  },

  {
    id: 'reviews',
    label: () => 'Reviews',
    description: () => 'Manage customer reviews',
    href: (ctx) => `/t/${ctx.tenantId}/reviews`,
    icon: 'Star',
    category: 'visibility',
    condition: () => true,
    score: () => 42,
  },

  // ── SETTINGS: Always-available admin links ──

  {
    id: 'team',
    label: () => 'Team',
    description: () => 'Manage your team members',
    href: (ctx) => `/t/${ctx.tenantId}/settings/users`,
    icon: 'Users',
    category: 'settings',
    condition: () => true,
    score: () => 30,
  },

  {
    id: 'store-settings',
    label: () => 'Store Settings',
    description: () => 'Profile, hours & location',
    href: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Settings',
    category: 'settings',
    condition: () => true,
    score: () => 25,
  },

  {
    id: 'subscription',
    label: () => 'Subscription',
    description: (ctx) => {
      const tierName = ctx.capabilities?.tier?.name;
      return tierName ? `${tierName} plan` : 'Manage your plan';
    },
    href: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'CreditCard',
    category: 'settings',
    condition: () => true,
    score: () => 20,
  },
];

// ====================
// CORE SERVICE
// ====================

/**
 * Resolve quick links for a tenant.
 *
 * Performs a single round of DB queries + capability resolution,
 * then evaluates all link definitions to produce a sorted list.
 *
 * @param tenantIdOrSlug  Tenant ID or slug
 * @returns Array of QuickLink sorted by score (descending)
 */
export async function resolveQuickLinks(
  tenantIdOrSlug: string
): Promise<QuickLink[] | null> {
  try {
    const tenantId = await resolveTenantId(tenantIdOrSlug);
    if (!tenantId) {
      logger.warn('[QuickLinksService] Tenant not found', undefined, { identifier: tenantIdOrSlug });
      return null;
    }

    const [capabilities, businessState] = await Promise.all([
      resolveEffectiveCapabilities(tenantId).catch(() => null),
      fetchBusinessState(tenantId),
    ]);

    const tierKey = capabilities?.tier.key || 'starter';

    const ctx: LinkContext = {
      tenantId,
      slug: businessState.slug,
      tierKey,
      capabilities,
      businessState,
    };

    const links: QuickLink[] = LINKS
      .filter((def) => {
        try { return def.condition(ctx); } catch { return false; }
      })
      .map((def) => {
        let s = 0;
        try { s = def.score(ctx); } catch { s = 0; }
        return { def, score: s };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ def }) => ({
        id: def.id,
        label: def.label(ctx),
        description: def.description(ctx),
        href: def.href(ctx),
        icon: def.icon,
        category: def.category,
        badge: def.badge ? def.badge(ctx) : undefined,
      }));

    return links;
  } catch (error) {
    logger.error('[QuickLinksService] Failed to resolve quick links: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error, tenantIdOrSlug });
    return null;
  }
}

// ====================
// HELPERS
// ====================

async function resolveTenantId(identifier: string): Promise<string | null> {
  const byId = await prisma.tenants.findUnique({
    where: { id: identifier },
    select: { id: true },
  });
  if (byId) return byId.id;

  const bySlug = await prisma.tenants.findFirst({
    where: { slug: identifier },
    select: { id: true },
  });
  return bySlug?.id ?? null;
}

interface BusinessState {
  slug: string | null;
  hasProducts: boolean;
  activeItems: number;
  hasPublishedDirectory: boolean;
  hasFAQs: boolean;
  faqEnabled: boolean;
  hasStorefront: boolean;
  locationStatus: string;
  subscriptionStatus: string;
  isReadOnly: boolean;
}

async function fetchBusinessState(tenantId: string): Promise<BusinessState> {
  const [
    tenant,
    itemCounts,
    directoryListing,
    faqCount,
    faqOptions,
  ] = await Promise.all([
    prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        slug: true,
        subscription_status: true,
        location_status: true,
      },
    }).catch(() => null),

    Promise.all([
      prisma.inventory_items.count({ where: { tenant_id: tenantId } }),
      prisma.inventory_items.count({ where: { tenant_id: tenantId, item_status: 'active' } }),
    ]).catch(() => [0, 0] as [number, number]),

    prisma.directory_listings_list.findFirst({
      where: { tenant_id: tenantId },
      select: { is_published: true },
    }).catch(() => null),

    prisma.faqs.count({
      where: { tenant_id: tenantId },
    }).catch(() => 0),

    prisma.tenant_faq_options_settings.findUnique({
      where: { tenant_id: tenantId },
      select: { faq_enabled: true },
    }).catch(() => null),
  ]);

  const [totalItems, activeItems] = itemCounts as [number, number];

  return {
    slug: tenant?.slug ?? null,
    hasProducts: totalItems > 0,
    activeItems,
    hasPublishedDirectory: directoryListing?.is_published === true,
    hasFAQs: faqCount > 0,
    faqEnabled: faqOptions?.faq_enabled ?? true,
    hasStorefront: false,
    locationStatus: tenant?.location_status || 'active',
    subscriptionStatus: tenant?.subscription_status || 'active',
    isReadOnly: false,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
