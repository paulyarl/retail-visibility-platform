/**
 * Organization-Aware Growth Tip Engine
 *
 * Multi-dimensional tip selection for organization dashboards based on:
 * - Org tier (chain_starter → chain_professional → chain_enterprise)
 * - Org capability availability (allowed tabs, panels, propagation types)
 * - Org data state (location count, SKU count, limits, status)
 * - Subscription status (trial, active, past_due, frozen)
 * - Locked tabs (capability gaps visible to user)
 * - Hero location setup and propagation state
 *
 * Mirrors the tenant tipEngine pattern but with org-specific dimensions.
 */

import type { OrgCapabilitiesState, OrgTabKey, OrgPanelKey } from '@/services/OrgCapabilityService';
import type { OrganizationData, BillingCounters } from '@/components/organization/types';

// ====================
// TYPES
// ====================

export type OrgTipCategory = 'onboarding' | 'engagement' | 'upgrade' | 'optimization' | 'retention';
export type OrgTipPriority = 'critical' | 'high' | 'medium' | 'low';

export interface OrgGrowthTip {
  id: string;
  category: OrgTipCategory;
  priority: OrgTipPriority;
  title: string;
  body: string;
  cta: string;
  ctaLink: string;
  icon: string;
  gradient: string;
}

export interface OrgTipContext {
  orgTier: string;
  orgTierName: string;
  orgCaps: OrgCapabilitiesState | null;
  orgData: OrganizationData | null;
  billingCounters: BillingCounters | null;
  subscriptionStatus: string;
  isTrial: boolean;
  trialDaysLeft: number | null;
  isReadOnly: boolean;
  isPastDue: boolean;
  lockedTabs: OrgTabKey[];
  lockedPanels: OrgPanelKey[];
  heroLocation?: { tenantId: string; tenantName: string; skuCount: number } | null;
  organizationId: string;
  tenantId?: string | null;
}

interface OrgTipDefinition {
  id: string;
  category: OrgTipCategory;
  priority: OrgTipPriority;
  title: string;
  body: string;
  cta: string;
  ctaLink: (ctx: OrgTipContext) => string;
  icon: string;
  gradient: string;
  condition: (ctx: OrgTipContext) => boolean;
  score: (ctx: OrgTipContext) => number;
}

// ====================
// TIER HELPERS
// ====================

const ORG_TIER_ORDER = ['chain_starter', 'chain_professional', 'chain_enterprise', 'custom'];

function orgTierIndex(tier: string): number {
  const idx = ORG_TIER_ORDER.indexOf(tier);
  return idx >= 0 ? idx : 0;
}

function isChainStarter(tier: string): boolean {
  return tier === 'chain_starter';
}

function isChainProfessional(tier: string): boolean {
  return tier === 'chain_professional';
}

function isChainEnterprise(tier: string): boolean {
  return tier === 'chain_enterprise';
}

function nextOrgTierName(tier: string): string | null {
  const map: Record<string, string> = {
    chain_starter: 'Chain Professional',
    chain_professional: 'Chain Enterprise',
  };
  return map[tier] ?? null;
}

// ====================
// CAPABILITY HELPERS
// ====================

function isTabLocked(ctx: OrgTipContext, tab: OrgTabKey): boolean {
  return ctx.lockedTabs.includes(tab);
}

function isPanelAllowed(ctx: OrgTipContext, panel: OrgPanelKey): boolean {
  if (!ctx.orgCaps) return true;
  return ctx.orgCaps.allowedPanels.includes(panel);
}

function hasPropagation(ctx: OrgTipContext): boolean {
  if (!ctx.orgCaps) return true;
  return ctx.orgCaps.allowedPropagationTypes.length > 0;
}

function isOrgEnabled(ctx: OrgTipContext): boolean {
  return ctx.orgCaps?.enabled ?? false;
}

function isFlexible(ctx: OrgTipContext): boolean {
  return ctx.orgCaps?.isFlexible ?? false;
}

function hasPurchasedFeatures(ctx: OrgTipContext): boolean {
  return (ctx.orgCaps?.purchasedFeatureKeys?.length ?? 0) > 0;
}

// ====================
// DATA HELPERS
// ====================

function locationCount(ctx: OrgTipContext): number {
  return ctx.orgData?.current.totalLocations ?? 0;
}

function maxLocations(ctx: OrgTipContext): number {
  return ctx.orgData?.limits.maxLocations ?? 0;
}

function totalSKUs(ctx: OrgTipContext): number {
  return ctx.orgData?.current.totalSKUs ?? 0;
}

function maxTotalSKUs(ctx: OrgTipContext): number {
  return ctx.orgData?.limits.maxTotalSKUs ?? 0;
}

function locPct(ctx: OrgTipContext): number {
  const max = maxLocations(ctx);
  if (max === 0) return 0;
  return (locationCount(ctx) / max) * 100;
}

function skuPct(ctx: OrgTipContext): number {
  const max = maxTotalSKUs(ctx);
  if (max === 0) return 0;
  return (totalSKUs(ctx) / max) * 100;
}

function hasHeroLocation(ctx: OrgTipContext): boolean {
  return !!ctx.heroLocation;
}

function heroHasProducts(ctx: OrgTipContext): boolean {
  return (ctx.heroLocation?.skuCount ?? 0) > 0;
}

function locationsWithoutProducts(ctx: OrgTipContext): number {
  if (!ctx.orgData || !ctx.heroLocation) return 0;
  return ctx.orgData.locationBreakdown.filter(
    (l) => l.tenantId !== ctx.heroLocation!.tenantId && l.skuCount === 0
  ).length;
}

// ====================
// TIP DEFINITIONS
// ====================

const ORG_TIPS: OrgTipDefinition[] = [

  // ═══════════════════════════════════════════════════════
  // RETENTION: Subscription Status
  // ═══════════════════════════════════════════════════════

  {
    id: 'org-trial-ending',
    category: 'retention',
    priority: 'critical',
    title: 'Your organization trial ends soon',
    body: ((ctx: OrgTipContext) => {
      const days = ctx.trialDaysLeft;
      if (days !== null && days <= 3) return `Your trial expires in ${days} day${days === 1 ? '' : 's'}. Add a payment method now to keep all your locations visible and avoid service interruption.`;
      return 'Your organization trial is ending soon. Add a payment method to keep all locations live and avoid any interruption to your chain operations.';
    }) as unknown as string,
    cta: 'Add payment method',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'CreditCard',
    gradient: 'from-rose-600 to-red-700',
    condition: (ctx) => ctx.isTrial && ctx.trialDaysLeft !== null && ctx.trialDaysLeft <= 7,
    score: (ctx) => {
      if (ctx.trialDaysLeft === null) return 0;
      if (ctx.trialDaysLeft <= 1) return 200;
      if (ctx.trialDaysLeft <= 3) return 190;
      return 180;
    },
  },

  {
    id: 'org-past-due',
    category: 'retention',
    priority: 'critical',
    title: 'Payment needed — organization action required',
    body: 'Your organization subscription payment is past due. Update your payment method now to restore full platform access and keep all your locations visible.',
    cta: 'Update payment',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'AlertTriangle',
    gradient: 'from-rose-600 to-red-700',
    condition: (ctx) => ctx.isPastDue,
    score: () => 210,
  },

  {
    id: 'org-frozen',
    category: 'retention',
    priority: 'critical',
    title: 'Organization frozen — reactivate now',
    body: 'Your organization subscription has lapsed and your locations are no longer visible to shoppers. Reactivate to restore visibility, directory listings, and storefronts across all your locations.',
    cta: 'Reactivate',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'Lock',
    gradient: 'from-gray-700 to-gray-900',
    condition: (ctx) => ctx.isReadOnly && !ctx.isTrial,
    score: () => 220,
  },

  // ═══════════════════════════════════════════════════════
  // ONBOARDING: Critical org setup
  // ═══════════════════════════════════════════════════════

  {
    id: 'org-set-hero-location',
    category: 'onboarding',
    priority: 'critical',
    title: 'Set your hero location',
    body: 'Your organization needs a hero location — the primary store that serves as the template for product propagation, category sync, and business info across all your locations.',
    cta: 'Set hero location',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization` : '/settings/organization',
    icon: 'Store',
    gradient: 'from-blue-600 to-indigo-700',
    condition: (ctx) => !hasHeroLocation(ctx) && locationCount(ctx) > 0,
    score: () => 100,
  },

  {
    id: 'org-add-products-to-hero',
    category: 'onboarding',
    priority: 'critical',
    title: 'Add products to your hero location',
    body: 'Your hero location has no products yet. Add inventory to your hero location first, then propagate it to all other locations with one click.',
    cta: 'Add products',
    ctaLink: (ctx) => ctx.heroLocation ? `/t/${ctx.heroLocation.tenantId}/items` : '/settings/organization',
    icon: 'Package',
    gradient: 'from-blue-600 to-indigo-700',
    condition: (ctx) => hasHeroLocation(ctx) && !heroHasProducts(ctx),
    score: () => 95,
  },

  {
    id: 'org-add-more-locations',
    category: 'onboarding',
    priority: 'high',
    title: 'Add more locations to your chain',
    body: ((ctx: OrgTipContext) => {
      const max = maxLocations(ctx);
      const current = locationCount(ctx);
      if (max > 0) return `You have ${current} of ${max} locations. Add more stores to maximize your chain's visibility and unified management.`;
      return 'Add more store locations to your organization to manage them from a single dashboard with unified billing and propagation.';
    }) as unknown as string,
    cta: 'Add location',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization/locations` : '/settings/organization',
    icon: 'MapPin',
    gradient: 'from-emerald-600 to-teal-700',
    condition: (ctx) => locationCount(ctx) < 2,
    score: () => 85,
  },

  // ═══════════════════════════════════════════════════════
  // ENGAGEMENT: Propagation & Sync
  // ═══════════════════════════════════════════════════════

  {
    id: 'org-propagate-products',
    category: 'engagement',
    priority: 'high',
    title: 'Propagate products to all locations',
    body: ((ctx: OrgTipContext) => {
      const count = locationsWithoutProducts(ctx);
      return `${count} location${count === 1 ? '' : 's'} still ${count === 1 ? 'has' : 'have'} no products. Sync from your hero location to populate them instantly.`;
    }) as unknown as string,
    cta: 'Sync now',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization?tab=propagation` : '/settings/organization',
    icon: 'Zap',
    gradient: 'from-violet-600 to-purple-700',
    condition: (ctx) => hasHeroLocation(ctx) && heroHasProducts(ctx) && locationsWithoutProducts(ctx) > 0 && hasPropagation(ctx),
    score: (ctx) => {
      let s = 80;
      const count = locationsWithoutProducts(ctx);
      if (count > 2) s += 10;
      if (count > 5) s += 10;
      return s;
    },
  },

  {
    id: 'org-sync-categories',
    category: 'engagement',
    priority: 'medium',
    title: 'Sync Google Business categories across locations',
    body: 'Keep your Google Business Profile categories consistent across all locations. Sync categories from your hero location to ensure uniform branding and search visibility.',
    cta: 'Sync categories',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization?tab=propagation` : '/settings/organization',
    icon: 'Tag',
    gradient: 'from-cyan-500 to-blue-600',
    condition: (ctx) => hasHeroLocation(ctx) && heroHasProducts(ctx) && locationCount(ctx) > 1 && hasPropagation(ctx),
    score: () => 55,
  },

  {
    id: 'org-invite-team',
    category: 'engagement',
    priority: 'medium',
    title: 'Invite team members to manage your chain',
    body: 'Add organization admins and location managers to delegate tasks. Team members can manage specific locations, view analytics, and handle customer inquiries.',
    cta: 'Manage team',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization/users` : '/settings/organization',
    icon: 'Users',
    gradient: 'from-blue-500 to-cyan-600',
    condition: (ctx) => !isTabLocked(ctx, 'team') && locationCount(ctx) > 0,
    score: () => 50,
  },

  {
    id: 'org-configure-bot',
    category: 'engagement',
    priority: 'medium',
    title: 'Activate your organization chatbot',
    body: 'Your plan includes an AI chatbot that can answer shopper questions across all your locations. Configure it to engage visitors 24/7 and capture leads even when you\'re busy.',
    cta: 'Configure bot',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/bot` : '/settings/organization',
    icon: 'Bot',
    gradient: 'from-indigo-500 to-blue-600',
    condition: (ctx) => isOrgEnabled(ctx) && !isTabLocked(ctx, 'capabilities'),
    score: (ctx) => {
      let s = 45;
      if (locationCount(ctx) > 2) s += 10;
      return s;
    },
  },

  // ═══════════════════════════════════════════════════════
  // UPGRADE: Tier-specific
  // ═══════════════════════════════════════════════════════

  {
    id: 'org-upgrade-to-professional',
    category: 'upgrade',
    priority: 'high',
    title: 'Upgrade to Chain Professional',
    body: 'Unlock advanced propagation (products, categories, business info, settings), team management, commerce configuration, and billing controls across all your locations.',
    cta: 'Explore upgrade',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'ArrowUpCircle',
    gradient: 'from-violet-600 to-purple-700',
    condition: (ctx) => isChainStarter(ctx.orgTier) && (lockedTabsCount(ctx) > 0 || locPct(ctx) >= 70),
    score: (ctx) => {
      let s = 78;
      if (lockedTabsCount(ctx) > 2) s += 15;
      if (locPct(ctx) >= 80) s += 10;
      return s;
    },
  },

  {
    id: 'org-upgrade-to-enterprise',
    category: 'upgrade',
    priority: 'medium',
    title: 'Upgrade to Chain Enterprise',
    body: 'Get unlimited locations, advanced analytics, API access, dedicated support, and white-label options. Everything you need to scale your chain across all markets.',
    cta: 'Explore Enterprise',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'Building2',
    gradient: 'from-slate-700 to-gray-800',
    condition: (ctx) => isChainProfessional(ctx.orgTier) && (locPct(ctx) >= 70 || skuPct(ctx) >= 70),
    score: (ctx) => {
      let s = 65;
      if (locPct(ctx) >= 80) s += 15;
      if (skuPct(ctx) >= 80) s += 10;
      if (locationCount(ctx) > 10) s += 10;
      return s;
    },
  },

  {
    id: 'org-near-location-limit',
    category: 'upgrade',
    priority: 'high',
    title: 'You\'re approaching your location limit',
    body: ((ctx: OrgTipContext) => {
      const pct = locPct(ctx);
      const current = locationCount(ctx);
      const max = maxLocations(ctx);
      return `You're using ${current} of ${max} locations (${pct.toFixed(0)}% capacity). Upgrade your plan to add more locations and continue scaling your chain.`;
    }) as unknown as string,
    cta: 'View plans',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'CreditCard',
    gradient: 'from-amber-500 to-orange-600',
    condition: (ctx) => locPct(ctx) >= 80 && !isChainEnterprise(ctx.orgTier),
    score: (ctx) => {
      let s = 75;
      if (locPct(ctx) >= 90) s += 15;
      if (locPct(ctx) >= 100) s += 10;
      return s;
    },
  },

  {
    id: 'org-near-sku-limit',
    category: 'upgrade',
    priority: 'medium',
    title: 'You\'re approaching your total SKU limit',
    body: ((ctx: OrgTipContext) => {
      const pct = skuPct(ctx);
      const current = totalSKUs(ctx);
      const max = maxTotalSKUs(ctx);
      return `You have ${current} of ${max} total SKUs (${pct.toFixed(0)}% capacity). Upgrade to add more products across your chain.`;
    }) as unknown as string,
    cta: 'View plans',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'CreditCard',
    gradient: 'from-amber-500 to-orange-600',
    condition: (ctx) => skuPct(ctx) >= 80 && !isChainEnterprise(ctx.orgTier),
    score: (ctx) => {
      let s = 60;
      if (skuPct(ctx) >= 90) s += 15;
      return s;
    },
  },

  // ═══════════════════════════════════════════════════════
  // CAPABILITY-AWARE: Locked tab nudges
  // ═══════════════════════════════════════════════════════

  {
    id: 'org-locked-propagation',
    category: 'upgrade',
    priority: 'high',
    title: 'Unlock product propagation across your chain',
    body: 'Propagation is locked on your current plan. Upgrade to sync products, categories, and business info from your hero location to all locations with one click.',
    cta: 'Upgrade plan',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'Lock',
    gradient: 'from-violet-600 to-purple-700',
    condition: (ctx) => isTabLocked(ctx, 'propagation'),
    score: () => 82,
  },

  {
    id: 'org-locked-team',
    category: 'upgrade',
    priority: 'medium',
    title: 'Unlock team management',
    body: 'Team management is locked on your current plan. Upgrade to invite team members, assign roles, and delegate management across your chain locations.',
    cta: 'Upgrade plan',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'Lock',
    gradient: 'from-blue-600 to-indigo-700',
    condition: (ctx) => isTabLocked(ctx, 'team'),
    score: () => 65,
  },

  {
    id: 'org-locked-commerce',
    category: 'upgrade',
    priority: 'medium',
    title: 'Unlock unified commerce settings',
    body: 'Commerce configuration is locked on your current plan. Upgrade to configure payment options, order settings, and checkout flows across all your locations.',
    cta: 'Upgrade plan',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'Lock',
    gradient: 'from-cyan-500 to-blue-600',
    condition: (ctx) => isTabLocked(ctx, 'commerce'),
    score: () => 60,
  },

  {
    id: 'org-locked-billing',
    category: 'upgrade',
    priority: 'low',
    title: 'Unlock billing management',
    body: 'Billing controls are locked on your current plan. Upgrade to view detailed billing, manage invoices, and control payment methods for your entire organization.',
    cta: 'Upgrade plan',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/subscription` : '/settings/subscription',
    icon: 'Lock',
    gradient: 'from-slate-600 to-gray-700',
    condition: (ctx) => isTabLocked(ctx, 'billing'),
    score: () => 40,
  },

  // ═══════════════════════════════════════════════════════
  // OPTIMIZATION
  // ═══════════════════════════════════════════════════════

  {
    id: 'org-review-capability-rollup',
    category: 'optimization',
    priority: 'medium',
    title: 'Review your capability rollup across locations',
    body: 'Some locations may have capabilities disabled that others have enabled. Check your capability rollup to ensure consistent commerce, bot, and CRM settings across your chain.',
    cta: 'View capabilities',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization?tab=capabilities` : '/settings/organization',
    icon: 'BarChart3',
    gradient: 'from-indigo-500 to-purple-600',
    condition: (ctx) => !isTabLocked(ctx, 'capabilities') && locationCount(ctx) > 1,
    score: (ctx) => {
      let s = 40;
      if (locationCount(ctx) > 3) s += 10;
      if (locationCount(ctx) > 10) s += 10;
      return s;
    },
  },

  {
    id: 'org-purchase-features',
    category: 'optimization',
    priority: 'medium',
    title: 'Boost your chain with à la carte features',
    body: 'Your plan supports flexible feature purchases. Add capabilities like advanced CRM, social commerce, or directory promotion to individual locations or across your chain.',
    cta: 'Browse feature store',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/feature-store` : '/settings/feature-store',
    icon: 'Sparkles',
    gradient: 'from-pink-500 to-rose-600',
    condition: (ctx) => isFlexible(ctx) && !hasPurchasedFeatures(ctx),
    score: () => 45,
  },

  {
    id: 'org-configure-commerce',
    category: 'optimization',
    priority: 'medium',
    title: 'Configure commerce settings for all locations',
    body: 'Set up payment gateways, checkout flows, and order management across your chain. Consistent commerce settings ensure a unified shopping experience.',
    cta: 'Configure commerce',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization?tab=commerce` : '/settings/organization',
    icon: 'ShoppingCart',
    gradient: 'from-emerald-500 to-teal-600',
    condition: (ctx) => !isTabLocked(ctx, 'commerce') && heroHasProducts(ctx),
    score: () => 50,
  },

  {
    id: 'org-set-up-crm',
    category: 'engagement',
    priority: 'low',
    title: 'Set up CRM for cross-location support',
    body: 'Manage customer tickets, inquiries, and tasks across all your locations from one unified CRM dashboard. Enable it to streamline your customer support.',
    cta: 'View capabilities',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization?tab=capabilities` : '/settings/organization',
    icon: 'Headset',
    gradient: 'from-orange-500 to-amber-600',
    condition: (ctx) => isPanelAllowed(ctx, 'crm_summary') && locationCount(ctx) > 0,
    score: () => 35,
  },

  {
    id: 'org-enterprise-api',
    category: 'optimization',
    priority: 'low',
    title: 'Leverage your API access for chain integrations',
    body: 'Your Chain Enterprise tier includes API access. Build custom integrations, sync with external POS systems, and automate operations across all your locations.',
    cta: 'API settings',
    ctaLink: (ctx) => ctx.tenantId ? `/t/${ctx.tenantId}/settings/integrations` : '/settings/organization',
    icon: 'Code',
    gradient: 'from-slate-600 to-gray-700',
    condition: (ctx) => isChainEnterprise(ctx.orgTier),
    score: () => 25,
  },
];

// ====================
// HELPERS
// ====================

function lockedTabsCount(ctx: OrgTipContext): number {
  return ctx.lockedTabs.length;
}

// ====================
// ENGINE
// ====================

/**
 * Resolve applicable org growth tips for a given org context.
 * Returns tips sorted by score (descending), limited to maxResults.
 */
export function resolveOrgGrowthTips(ctx: OrgTipContext, maxResults: number = 5): OrgGrowthTip[] {
  const applicable = ORG_TIPS
    .filter((tip) => {
      try {
        return tip.condition(ctx);
      } catch {
        return false;
      }
    })
    .map((tip) => {
      let s = 0;
      try {
        s = tip.score(ctx);
      } catch {
        s = 0;
      }
      return { tip, score: s };
    })
    .sort((a, b) => b.score - a.score);

  return applicable.slice(0, maxResults).map(({ tip }) => {
    const body = typeof tip.body === 'string' ? tip.body : (tip.body as any)(ctx);
    const title = typeof tip.title === 'string' ? tip.title : (tip.title as any)(ctx);

    return {
      id: tip.id,
      category: tip.category,
      priority: tip.priority,
      title,
      body,
      cta: tip.cta,
      ctaLink: tip.ctaLink(ctx),
      icon: tip.icon,
      gradient: tip.gradient,
    };
  });
}

/**
 * Pick a single org tip for display, optionally using a seed for rotation.
 * Falls back to a generic tip if no tips are applicable.
 */
export function pickOrgGrowthTip(ctx: OrgTipContext, seed: number = 0): OrgGrowthTip {
  const tips = resolveOrgGrowthTips(ctx, 5);
  if (tips.length === 0) {
    return {
      id: 'org-default',
      category: 'engagement',
      priority: 'low',
      title: 'Grow your chain with Visible Shelf',
      body: 'Set up your hero location, add products, and propagate across all locations to maximize your chain\'s visibility on Google and the platform directory.',
      cta: 'View settings',
      ctaLink: ctx.tenantId ? `/t/${ctx.tenantId}/settings/organization` : '/settings/organization',
      icon: 'Sparkles',
      gradient: 'from-blue-600 to-indigo-700',
    };
  }
  return tips[seed % tips.length];
}
