/**
 * Tier-Aware Growth Tip Engine
 *
 * Multi-dimensional tip selection based on:
 * - Tier level (discovery → storefront → commitment → e-commerce → omnichannel → enterprise)
 * - Capability availability (commerce, payment gateway, storefront, chatbot, CRM, etc.)
 * - Usage state (products, orders, active items)
 * - Business model alignment (physical vs online vs omnichannel)
 * - Subscription status (trial, active, past_due, frozen, canceled)
 * - Visibility status (directory published, storefront enabled, Google indexing, slug/logo)
 * - Growth path from PLATFORM_STRATEGY_V2
 *
 * Tips are scored by relevance and the top N are returned for rotation.
 */

import type { AllCapabilitiesState } from '@/services/CapabilityResolutionService';
import type { TierInfo } from '@/lib/tiers/tier-resolver';

// ====================
// TYPES
// ====================

export type TipCategory = 'onboarding' | 'engagement' | 'upgrade' | 'optimization' | 'retention';
export type TipPriority = 'critical' | 'high' | 'medium' | 'low';

export interface GrowthTip {
  id: string;
  category: TipCategory;
  priority: TipPriority;
  title: string;
  body: string;
  cta: string;
  ctaLink: string;
  icon: string;
  gradient: string;
}

export interface TipContext {
  tierLevel: TierInfo['level'];
  tierName: string;
  canUpgrade: boolean;
  upgradeOptions: string[];
  capabilities: AllCapabilitiesState | null;
  usage: {
    totalItems: number;
    activeItems: number;
    orders: number;
  };
  businessState: {
    hasProducts: boolean;
    hasStorefront: boolean;
    hasPublishedDirectory: boolean;
    hasFAQs: boolean;
    hasHours: boolean;
    hasLogo: boolean;
    hasMap: boolean;
    hasStoreCategory: boolean;
    hasSlug: boolean;
  };
  subscriptionStatus: string;
  isTrial: boolean;
  trialDaysLeft: number | null;
  isReadOnly: boolean;
  isPastDue: boolean;
  locationStatus: 'pending' | 'active' | 'inactive' | 'closed' | 'archived' | string;
  reopeningDate: string | null;
  tenantId: string;
}

interface TipDefinition {
  id: string;
  category: TipCategory;
  priority: TipPriority;
  title: string;
  body: string;
  cta: string;
  ctaLink: (ctx: TipContext) => string;
  icon: string;
  gradient: string;
  condition: (ctx: TipContext) => boolean;
  score: (ctx: TipContext) => number;
}

// ====================
// TIER HELPERS
// ====================

const TIER_ORDER: TierInfo['level'][] = [
  'google_only', 'starter', 'discovery', 'storefront', 'commitment', 'ecommerce', 'omnichannel', 'professional', 'organization', 'enterprise',
  'chain_starter', 'chain_professional', 'chain_enterprise', 'custom',
];

function tierIndex(level: TierInfo['level']): number {
  const idx = TIER_ORDER.indexOf(level);
  return idx >= 0 ? idx : 0;
}

function isDiscoveryOrBelow(level: TierInfo['level']): boolean {
  return tierIndex(level) <= tierIndex('discovery');
}

function isStorefront(level: TierInfo['level']): boolean {
  return level === 'storefront' || level === 'chain_starter';
}

function isCommitment(level: TierInfo['level']): boolean {
  return level === 'commitment';
}

function isEcommerce(level: TierInfo['level']): boolean {
  return level === 'ecommerce';
}

function isEcommerceOrAbove(level: TierInfo['level']): boolean {
  return tierIndex(level) >= tierIndex('ecommerce');
}

function isEnterprise(level: TierInfo['level']): boolean {
  return level === 'enterprise' || level === 'chain_enterprise';
}

function nextTierName(level: TierInfo['level']): string | null {
  const map: Partial<Record<TierInfo['level'], string>> = {
    'google_only': 'Storefront',
    'starter': 'Storefront',
    'discovery': 'Storefront',
    'storefront': 'Commitment',
    'commitment': 'E-commerce',
    'ecommerce': 'Omnichannel',
    'omnichannel': 'Enterprise',
    'professional': 'Enterprise',
    'organization': 'Enterprise',
  };
  return map[level] ?? null;
}

// ====================
// CAPABILITY HELPERS
// ====================

function hasCommerce(ctx: TipContext): boolean {
  return ctx.capabilities?.commerce?.enabled ?? false;
}

function hasDepositOnly(ctx: TipContext): boolean {
  const c = ctx.capabilities?.commerce;
  return !!c && c.enabled && c.effectivePaymentType === 'deposit';
}

function hasFullPayment(ctx: TipContext): boolean {
  const c = ctx.capabilities?.commerce;
  return !!c && c.enabled && (c.effectivePaymentType === 'full' || c.effectivePaymentType === 'flexible');
}

function hasBothPaymentPaths(ctx: TipContext): boolean {
  const c = ctx.capabilities?.commerce;
  return !!c && c.enabled && c.effectivePaymentType === 'flexible';
}

function hasChatbot(ctx: TipContext): boolean {
  return ctx.capabilities?.chatbotOptions?.enabled ?? false;
}

function hasCRM(ctx: TipContext): boolean {
  return ctx.capabilities?.crmOptions?.enabled ?? false;
}

function hasFAQ(ctx: TipContext): boolean {
  return ctx.capabilities?.faqOptions?.enabled ?? false;
}

function hasSocialCommerce(ctx: TipContext): boolean {
  return ctx.capabilities?.socialCommerceOptions?.enabled ?? false;
}

function hasFulfillment(ctx: TipContext): boolean {
  return ctx.capabilities?.fulfillment?.enabled ?? false;
}

function hasPaymentGateway(ctx: TipContext): boolean {
  return ctx.capabilities?.paymentGateway?.checkoutAvailable ?? false;
}

function hasStorefrontCapability(ctx: TipContext): boolean {
  const s = ctx.capabilities?.storefront;
  return !!s && s.enabled && s.effectiveType !== 'none';
}

function hasIntegrations(ctx: TipContext): boolean {
  return ctx.capabilities?.integrationOptions?.enabled ?? false;
}

// ====================
// TIP DEFINITIONS
// ====================

const TIPS: TipDefinition[] = [

  // ═══════════════════════════════════════════════════════
  // CRITICAL: Location Status (non-active = store invisible to shoppers)
  // ═══════════════════════════════════════════════════════

  {
    id: 'location-pending',
    category: 'retention',
    priority: 'critical',
    title: 'Your store isn\'t visible yet — activate your location',
    body: 'Your location status is pending. Shoppers can\'t find you on Google or the platform directory until your store is active. Complete your profile and set your status to active to go live.',
    cta: 'Activate store',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'MapPin',
    gradient: 'from-rose-600 to-red-700',
    condition: (ctx) => ctx.locationStatus === 'pending',
    score: () => 230,
  },

  {
    id: 'location-inactive',
    category: 'retention',
    priority: 'critical',
    title: 'Your store is temporarily closed',
    body: ((ctx: TipContext) => {
      if (ctx.reopeningDate) {
        const date = new Date(ctx.reopeningDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return `Your location is marked as temporarily closed (reopening ${date}). Shoppers see you as closed on Google and the directory. Reactivate when you reopen to restore visibility.`;
      }
      return 'Your location is marked as temporarily closed. Shoppers see you as closed on Google and the platform directory. Update your status to active when you reopen to restore your visibility and start receiving inquiries.';
    }) as unknown as string,
    cta: 'Update status',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Clock',
    gradient: 'from-orange-600 to-red-600',
    condition: (ctx) => ctx.locationStatus === 'inactive',
    score: () => 225,
  },

  {
    id: 'location-closed',
    category: 'retention',
    priority: 'critical',
    title: 'Your store is marked as permanently closed',
    body: 'Your location is marked as permanently closed. Google and the platform directory are showing you as closed to all shoppers. If this is incorrect, update your status immediately — otherwise consider archiving this location.',
    cta: 'Manage location',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Lock',
    gradient: 'from-red-700 to-gray-900',
    condition: (ctx) => ctx.locationStatus === 'closed',
    score: () => 235,
  },

  {
    id: 'location-archived',
    category: 'retention',
    priority: 'critical',
    title: 'This location is archived',
    body: 'Your location is archived and completely hidden from shoppers on Google and the platform directory. Reactivate it to restore your visibility, or manage it from your organization settings.',
    cta: 'Reactivate',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Archive',
    gradient: 'from-gray-700 to-gray-900',
    condition: (ctx) => ctx.locationStatus === 'archived',
    score: () => 228,
  },

  // ═══════════════════════════════════════════════════════
  // RETENTION: Subscription Status (highest priority — save the account first)
  // ═══════════════════════════════════════════════════════

  {
    id: 'trial-ending',
    category: 'retention',
    priority: 'critical',
    title: 'Your free trial ends soon',
    body: ((ctx: TipContext) => {
      const days = ctx.trialDaysLeft;
      if (days !== null && days <= 3) return `Your trial expires in ${days} day${days === 1 ? '' : 's'}. Add a payment method now to keep your store visible and avoid service interruption.`;
      return 'Your trial is ending soon. Add a payment method to keep your store live and avoid any interruption to your Google visibility and platform presence.';
    }) as unknown as string,
    cta: 'Add payment method',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
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
    id: 'subscription-past-due',
    category: 'retention',
    priority: 'critical',
    title: 'Payment needed — action required',
    body: 'Your subscription payment is past due. Update your payment method now to restore full platform access and keep your store visible to shoppers.',
    cta: 'Update payment',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'AlertTriangle',
    gradient: 'from-rose-600 to-red-700',
    condition: (ctx) => ctx.isPastDue,
    score: () => 210,
  },

  {
    id: 'subscription-frozen',
    category: 'retention',
    priority: 'critical',
    title: 'Account frozen — reactivate now',
    body: 'Your subscription has lapsed and your store is no longer visible to shoppers. Reactivate your subscription to restore your Google visibility, directory listing, and storefront.',
    cta: 'Reactivate',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'Lock',
    gradient: 'from-gray-700 to-gray-900',
    condition: (ctx) => ctx.isReadOnly && !ctx.isTrial,
    score: () => 220,
  },

  // ═══════════════════════════════════════════════════════
  // ONBOARDING: Critical visibility gaps
  // ═══════════════════════════════════════════════════════

  {
    id: 'add-products',
    category: 'onboarding',
    priority: 'critical',
    title: 'Add your first products',
    body: 'Your store is live but has no products yet. Add inventory from your POS or manually to start getting found on Google and the platform directory.',
    cta: 'Add products',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/items`,
    icon: 'Package',
    gradient: 'from-blue-600 to-indigo-700',
    condition: (ctx) => !ctx.businessState.hasProducts,
    score: () => 100,
  },

  {
    id: 'publish-directory',
    category: 'onboarding',
    priority: 'critical',
    title: 'Publish your directory listing',
    body: 'Your directory listing isn\'t published yet. Shoppers browsing the platform marketplace can\'t find you until it\'s live.',
    cta: 'Publish listing',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/directory`,
    icon: 'MapPin',
    gradient: 'from-emerald-600 to-teal-700',
    condition: (ctx) => !ctx.businessState.hasPublishedDirectory,
    score: () => 95,
  },

  {
    id: 'set-business-hours',
    category: 'onboarding',
    priority: 'high',
    title: 'Set your business hours',
    body: 'Shoppers need to know when you\'re open. Add your business hours so customers can plan visits and see your live status on the directory.',
    cta: 'Set hours',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Clock',
    gradient: 'from-amber-500 to-orange-600',
    condition: (ctx) => !ctx.businessState.hasHours,
    score: () => 85,
  },

  {
    id: 'add-store-logo',
    category: 'onboarding',
    priority: 'medium',
    title: 'Add your store logo',
    body: 'A logo makes your store recognizable across Google, the platform directory, and your storefront. Upload one to strengthen your brand presence.',
    cta: 'Upload logo',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Image',
    gradient: 'from-violet-500 to-purple-600',
    condition: (ctx) => !ctx.businessState.hasLogo,
    score: () => 70,
  },

  {
    id: 'set-store-category',
    category: 'onboarding',
    priority: 'high',
    title: 'Set your Google Business category',
    body: 'Choosing the right Google Business category helps you appear in more relevant searches and improves your directory placement.',
    cta: 'Set category',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Tag',
    gradient: 'from-cyan-500 to-blue-600',
    condition: (ctx) => !ctx.businessState.hasStoreCategory,
    score: () => 80,
  },

  {
    id: 'add-store-location',
    category: 'onboarding',
    priority: 'high',
    title: 'Add your store location',
    body: 'Pin your store on the map so nearby shoppers can find you. Your location powers Google Maps visibility and directory proximity searches.',
    cta: 'Set location',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'MapPin',
    gradient: 'from-emerald-500 to-green-600',
    condition: (ctx) => !ctx.businessState.hasMap,
    score: () => 82,
  },

  {
    id: 'create-store-slug',
    category: 'onboarding',
    priority: 'medium',
    title: 'Create your store URL slug',
    body: 'A custom slug gives you a clean, shareable storefront URL like /directory/your-store-name. Set one to make your store easy to find and share.',
    cta: 'Set URL slug',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Link',
    gradient: 'from-indigo-500 to-blue-600',
    condition: (ctx) => !ctx.businessState.hasSlug,
    score: () => 65,
  },

  // ═══════════════════════════════════════════════════════
  // TIER-SPECIFIC: Discovery (Tier 1) — "Get Found on Google"
  // ═══════════════════════════════════════════════════════

  {
    id: 'discovery-to-storefront',
    category: 'upgrade',
    priority: 'high',
    title: `Upgrade to Storefront — own your platform presence`,
    body: 'You\'re getting found on Google. Now add a branded storefront page, platform product visibility, and shopper inquiries to convert browsers into customers.',
    cta: 'Explore Storefront',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'Store',
    gradient: 'from-blue-600 to-indigo-700',
    condition: (ctx) => isDiscoveryOrBelow(ctx.tierLevel) && ctx.canUpgrade && ctx.businessState.hasProducts,
    score: (ctx) => {
      let s = 75;
      if (ctx.businessState.hasPublishedDirectory) s += 10;
      if (ctx.usage.activeItems > 10) s += 10;
      return s;
    },
  },

  {
    id: 'discovery-complete-profile',
    category: 'optimization',
    priority: 'medium',
    title: 'Complete your Google visibility profile',
    body: 'You\'re on the Discovery tier — maximize your Google presence by ensuring all products are indexed, your hours are set, and your category is accurate.',
    cta: 'Review profile',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/tenant`,
    icon: 'Search',
    gradient: 'from-blue-500 to-cyan-600',
    condition: (ctx) => isDiscoveryOrBelow(ctx.tierLevel) && (!ctx.businessState.hasHours || !ctx.businessState.hasStoreCategory || !ctx.businessState.hasMap),
    score: (ctx) => {
      let s = 50;
      if (!ctx.businessState.hasHours) s += 15;
      if (!ctx.businessState.hasStoreCategory) s += 15;
      if (!ctx.businessState.hasMap) s += 10;
      return s;
    },
  },

  // ═══════════════════════════════════════════════════════
  // TIER-SPECIFIC: Storefront (Tier 2) — "Own Your Platform Presence"
  // ═══════════════════════════════════════════════════════

  {
    id: 'storefront-to-commerce',
    category: 'upgrade',
    priority: 'high',
    title: ((ctx: TipContext) => {
      const next = nextTierName(ctx.tierLevel);
      return `Ready for commerce? Upgrade to ${next}`;
    }) as unknown as string,
    body: ((ctx: TipContext) => {
      const next = nextTierName(ctx.tierLevel);
      if (next === 'Commitment') return 'Shoppers are browsing your store — but can\'t act on it. Add deposit checkout to capture intent and drive foot traffic to your physical store.';
      if (next === 'E-commerce') return 'Shoppers are browsing your store — but can\'t act on it. Add full online checkout to start selling to shoppers who want to buy completely online.';
      if (next === 'Omnichannel') return 'You\'re successfully using deposit commerce. Now add full online payment and delivery to sell to shoppers who want to buy completely online.';
      return 'Shoppers are browsing — now give them a way to buy. Upgrade to start converting browsers into customers.';
    }) as unknown as string,
    cta: 'Explore upgrade',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'ShoppingCart',
    gradient: 'from-violet-600 to-purple-700',
    condition: (ctx) => isStorefront(ctx.tierLevel) && ctx.canUpgrade && ctx.businessState.hasProducts && ctx.businessState.hasPublishedDirectory,
    score: (ctx) => {
      let s = 78;
      if (ctx.usage.activeItems > 20) s += 10;
      if (ctx.businessState.hasFAQs) s += 5;
      return s;
    },
  },

  {
    id: 'storefront-enable-inquiries',
    category: 'engagement',
    priority: 'medium',
    title: 'Enable shopper inquiries',
    body: 'Your Storefront tier includes shopper inquiry / contact seller. Make sure it\'s enabled so browsers can reach out about products they\'re interested in.',
    cta: 'Check settings',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/storefront`,
    icon: 'MessageSquare',
    gradient: 'from-teal-500 to-cyan-600',
    condition: (ctx) => isStorefront(ctx.tierLevel) && hasStorefrontCapability(ctx),
    score: () => 55,
  },

  {
    id: 'storefront-add-faqs',
    category: 'engagement',
    priority: 'medium',
    title: 'Add FAQs to answer common shopper questions',
    body: 'FAQs help shoppers decide and boost your SEO. Add answers to questions like shipping, returns, store hours, and product availability.',
    cta: 'Add FAQs',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/faq`,
    icon: 'HelpCircle',
    gradient: 'from-cyan-500 to-blue-600',
    condition: (ctx) => !ctx.businessState.hasFAQs && hasFAQ(ctx) && !isDiscoveryOrBelow(ctx.tierLevel),
    score: () => 60,
  },

  // ═══════════════════════════════════════════════════════
  // TIER-SPECIFIC: E-commerce (Tier 4) — "Sell Online — Fully & Simply"
  // ═══════════════════════════════════════════════════════

  {
    id: 'ecommerce-to-omnichannel',
    category: 'upgrade',
    priority: 'high',
    title: 'Add physical pickup options with Omnichannel',
    body: 'You\'re selling online successfully — now add deposit/pickup options for local customers. Upgrade to Omnichannel to offer both full payment with delivery AND deposit with in-store pickup.',
    cta: 'Explore Omnichannel',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'ArrowUpCircle',
    gradient: 'from-violet-600 to-purple-700',
    condition: (ctx) => isEcommerce(ctx.tierLevel) && ctx.canUpgrade && ctx.usage.orders > 0,
    score: (ctx) => {
      let s = 80;
      if (ctx.usage.orders > 5) s += 15;
      if (ctx.usage.orders > 20) s += 10;
      return s;
    },
  },

  // ═══════════════════════════════════════════════════════
  // TIER-SPECIFIC: Commitment (Tier 3) — "Capture Intent & Drive Foot Traffic"
  // ═══════════════════════════════════════════════════════

  {
    id: 'commitment-setup-deposit',
    category: 'onboarding',
    priority: 'critical',
    title: 'Configure your deposit checkout',
    body: 'Your Commitment tier includes deposit commerce — shoppers pay a 10–15% holding fee to reserve items. Configure your deposit settings to start capturing intent and driving foot traffic.',
    cta: 'Configure checkout',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/commerce`,
    icon: 'ShoppingCart',
    gradient: 'from-blue-600 to-indigo-700',
    condition: (ctx) => isCommitment(ctx.tierLevel) && hasDepositOnly(ctx) && ctx.usage.orders === 0,
    score: () => 90,
  },

  {
    id: 'commitment-to-omnichannel',
    category: 'upgrade',
    priority: 'high',
    title: 'Add full online payment with Omnichannel',
    body: 'Shoppers are reserving and showing up — but some want to pay fully online. Upgrade to Omnichannel to offer both deposit/pickup AND full payment/delivery, letting shoppers choose their path.',
    cta: 'Explore Omnichannel',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'ArrowUpCircle',
    gradient: 'from-violet-600 to-purple-700',
    condition: (ctx) => isCommitment(ctx.tierLevel) && ctx.canUpgrade && ctx.usage.orders > 0,
    score: (ctx) => {
      let s = 80;
      if (ctx.usage.orders > 5) s += 15;
      if (ctx.usage.orders > 20) s += 10;
      return s;
    },
  },

  {
    id: 'commitment-bopis',
    category: 'optimization',
    priority: 'medium',
    title: 'Promote BOPIS to your customers',
    body: 'Your tier supports Buy Online, Pick Up In Store. Let your shoppers know they can reserve online and pick up in-store — it drives foot traffic and increases in-store sales.',
    cta: 'View fulfillment settings',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/fulfillment`,
    icon: 'PackageCheck',
    gradient: 'from-amber-500 to-orange-600',
    condition: (ctx) => isCommitment(ctx.tierLevel) && hasFulfillment(ctx) && ctx.usage.orders > 0,
    score: () => 55,
  },

  // ═══════════════════════════════════════════════════════
  // TIER-SPECIFIC: E-commerce / Omnichannel (Tier 4-5)
  // ═══════════════════════════════════════════════════════

  {
    id: 'omnichannel-both-paths',
    category: 'optimization',
    priority: 'medium',
    title: 'You offer both payment paths — promote it!',
    body: 'Shoppers can choose: pay in full with delivery, or pay a deposit and pick up in store. Highlight this flexibility on your storefront to maximize conversions.',
    cta: 'Customize storefront',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/storefront`,
    icon: 'Sparkles',
    gradient: 'from-indigo-500 to-purple-600',
    condition: (ctx) => hasBothPaymentPaths(ctx),
    score: (ctx) => isEcommerceOrAbove(ctx.tierLevel) ? 50 : 30,
  },

  {
    id: 'omnichannel-to-enterprise',
    category: 'upgrade',
    priority: 'medium',
    title: 'Need multi-location support? Consider Enterprise',
    body: 'Enterprise adds multi-location management, advanced analytics, API access, dedicated support, and white-label options — everything for scaling your retail business.',
    cta: 'Explore Enterprise',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/subscription`,
    icon: 'Building2',
    gradient: 'from-slate-700 to-gray-800',
    condition: (ctx) => isEcommerceOrAbove(ctx.tierLevel) && !isEnterprise(ctx.tierLevel) && ctx.canUpgrade,
    score: (ctx) => {
      let s = 45;
      if (ctx.usage.activeItems > 200) s += 15;
      if (ctx.usage.orders > 50) s += 15;
      return s;
    },
  },

  // ═══════════════════════════════════════════════════════
  // CAPABILITY-AWARE: Chatbot
  // ═══════════════════════════════════════════════════════

  {
    id: 'enable-chatbot',
    category: 'engagement',
    priority: 'medium',
    title: 'Activate your AI chatbot',
    body: 'Your plan includes an AI chatbot that answers shopper questions 24/7, captures leads, and routes complex inquiries to you. Turn it on to engage visitors even when you\'re busy.',
    cta: 'Configure bot',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/bot`,
    icon: 'Bot',
    gradient: 'from-indigo-500 to-blue-600',
    condition: (ctx) => hasChatbot(ctx) && !ctx.businessState.hasFAQs,
    score: (ctx) => {
      let s = 50;
      if (ctx.businessState.hasProducts) s += 10;
      if (ctx.businessState.hasPublishedDirectory) s += 5;
      return s;
    },
  },

  {
    id: 'chatbot-add-faqs',
    category: 'optimization',
    priority: 'medium',
    title: 'Feed your chatbot with FAQs',
    body: 'Your chatbot gets smarter when you add FAQs. It can answer product questions, store hours, and policies automatically — reducing your support burden.',
    cta: 'Add FAQs',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/faq`,
    icon: 'Bot',
    gradient: 'from-indigo-500 to-blue-600',
    condition: (ctx) => hasChatbot(ctx) && ctx.businessState.hasFAQs === false,
    score: () => 55,
  },

  // ═══════════════════════════════════════════════════════
  // CAPABILITY-AWARE: CRM
  // ═══════════════════════════════════════════════════════

  {
    id: 'use-crm-tickets',
    category: 'engagement',
    priority: 'low',
    title: 'Track customer inquiries with CRM',
    body: 'Your plan includes a CRM system. Use it to track shopper tickets, manage tasks, and respond to inquiries — all from one dashboard.',
    cta: 'Open CRM',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/support`,
    icon: 'Headset',
    gradient: 'from-orange-500 to-amber-600',
    condition: (ctx) => hasCRM(ctx) && ctx.businessState.hasPublishedDirectory,
    score: () => 35,
  },

  // ═══════════════════════════════════════════════════════
  // CAPABILITY-AWARE: Social Commerce
  // ═══════════════════════════════════════════════════════

  {
    id: 'social-commerce-setup',
    category: 'engagement',
    priority: 'medium',
    title: 'Connect your social commerce channels',
    body: 'Sync your product catalog to Instagram Shopping, Facebook Shop, and TikTok Shop. Reach shoppers where they discover products on social media.',
    cta: 'Set up social',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/integrations`,
    icon: 'Share2',
    gradient: 'from-pink-500 to-rose-600',
    condition: (ctx) => hasSocialCommerce(ctx) && ctx.businessState.hasProducts,
    score: (ctx) => {
      let s = 45;
      if (ctx.usage.activeItems > 20) s += 10;
      return s;
    },
  },

  // ═══════════════════════════════════════════════════════
  // CAPABILITY-AWARE: Payment Gateway
  // ═══════════════════════════════════════════════════════

  {
    id: 'setup-payment-gateway',
    category: 'onboarding',
    priority: 'critical',
    title: 'Connect a payment gateway',
    body: 'You have commerce enabled but no payment gateway connected. Add Stripe, Square, or another gateway to start accepting online payments and deposits.',
    cta: 'Set up payments',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/payments`,
    icon: 'CreditCard',
    gradient: 'from-emerald-600 to-green-700',
    condition: (ctx) => hasCommerce(ctx) && !hasPaymentGateway(ctx),
    score: () => 92,
  },

  // ═══════════════════════════════════════════════════════
  // USAGE-AWARE: Product optimization
  // ═══════════════════════════════════════════════════════

  {
    id: 'feature-products',
    category: 'optimization',
    priority: 'low',
    title: 'Feature your best products',
    body: 'You have products live but none featured. Featuring products on your storefront and directory listing increases visibility and drives more shopper engagement.',
    cta: 'Manage featured',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/items?filter=featured`,
    icon: 'Star',
    gradient: 'from-amber-400 to-yellow-500',
    condition: (ctx) => ctx.businessState.hasProducts && ctx.usage.activeItems > 5 && !isDiscoveryOrBelow(ctx.tierLevel),
    score: (ctx) => {
      let s = 30;
      if (ctx.usage.activeItems > 20) s += 10;
      if (ctx.usage.activeItems > 50) s += 10;
      return s;
    },
  },

  {
    id: 'product-count-low',
    category: 'optimization',
    priority: 'medium',
    title: 'Add more products to increase visibility',
    body: ((ctx: TipContext) => `You have ${ctx.usage.activeItems} product${ctx.usage.activeItems === 1 ? '' : 's'} live. Stores with more products get significantly more views on Google and the platform directory.`) as unknown as string,
    cta: 'Add products',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/items`,
    icon: 'TrendingUp',
    gradient: 'from-blue-500 to-cyan-600',
    condition: (ctx) => ctx.businessState.hasProducts && ctx.usage.activeItems > 0 && ctx.usage.activeItems < 10,
    score: (ctx) => 60 - (ctx.usage.activeItems * 3),
  },

  // ═══════════════════════════════════════════════════════
  // VISIBILITY: Storefront & Google
  // ═══════════════════════════════════════════════════════

  {
    id: 'enable-storefront',
    category: 'onboarding',
    priority: 'high',
    title: 'Enable your branded storefront',
    body: 'Your tier includes a branded storefront page. Enable it to give shoppers a full store experience with products, categories, and store details.',
    cta: 'Enable storefront',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/storefront`,
    icon: 'Store',
    gradient: 'from-violet-500 to-purple-600',
    condition: (ctx) => !ctx.businessState.hasStorefront && !isDiscoveryOrBelow(ctx.tierLevel),
    score: () => 78,
  },

  {
    id: 'google-integration-check',
    category: 'optimization',
    priority: 'medium',
    title: 'Verify your Google integration',
    body: 'Ensure your Google Business Profile and Google Shopping feeds are synced. This powers your Google Search visibility, Maps listing, and Shopping ads.',
    cta: 'Check integration',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/integrations/google`,
    icon: 'Globe',
    gradient: 'from-blue-500 to-cyan-600',
    condition: (ctx) => hasIntegrations(ctx) && ctx.businessState.hasProducts,
    score: (ctx) => {
      let s = 40;
      if (ctx.businessState.hasPublishedDirectory) s += 10;
      if (ctx.businessState.hasStoreCategory) s += 5;
      return s;
    },
  },

  // ═══════════════════════════════════════════════════════
  // ENTERPRISE
  // ═══════════════════════════════════════════════════════

  {
    id: 'enterprise-api-access',
    category: 'optimization',
    priority: 'low',
    title: 'Leverage your API access',
    body: 'Your Enterprise tier includes API access for custom integrations. Build custom workflows, sync with external systems, and automate your operations.',
    cta: 'API docs',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/integrations`,
    icon: 'Code',
    gradient: 'from-slate-600 to-gray-700',
    condition: (ctx) => isEnterprise(ctx.tierLevel),
    score: () => 25,
  },

  {
    id: 'enterprise-multi-location',
    category: 'optimization',
    priority: 'medium',
    title: 'Manage multiple locations',
    body: 'Your Enterprise tier supports multi-location management. Add and manage all your store locations from a single dashboard with unified billing.',
    cta: 'Manage locations',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/settings/organization`,
    icon: 'Building2',
    gradient: 'from-slate-600 to-gray-700',
    condition: (ctx) => isEnterprise(ctx.tierLevel),
    score: () => 30,
  },

  // ═══════════════════════════════════════════════════════
  // ENGAGEMENT: Orders
  // ═══════════════════════════════════════════════════════

  {
    id: 'first-order-insights',
    category: 'engagement',
    priority: 'medium',
    title: 'Review your first order insights',
    body: 'You\'ve received your first orders. Check your conversion analytics to understand shopper behavior and optimize your product listings.',
    cta: 'View analytics',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/insights`,
    icon: 'BarChart3',
    gradient: 'from-emerald-500 to-teal-600',
    condition: (ctx) => ctx.usage.orders > 0 && ctx.usage.orders <= 5 && !isDiscoveryOrBelow(ctx.tierLevel),
    score: () => 50,
  },

  {
    id: 'growing-orders',
    category: 'optimization',
    priority: 'low',
    title: 'Your orders are growing — scale with analytics',
    body: 'You\'re building momentum. Use conversion analytics to identify your best-selling products, track abandonment rates, and optimize your checkout flow.',
    cta: 'View analytics',
    ctaLink: (ctx) => `/t/${ctx.tenantId}/insights`,
    icon: 'TrendingUp',
    gradient: 'from-emerald-500 to-teal-600',
    condition: (ctx) => ctx.usage.orders > 5 && !isDiscoveryOrBelow(ctx.tierLevel),
    score: (ctx) => {
      let s = 35;
      if (ctx.usage.orders > 20) s += 10;
      if (ctx.usage.orders > 50) s += 10;
      return s;
    },
  },
];

// ====================
// ENGINE
// ====================

/**
 * Resolve applicable growth tips for a given context.
 * Returns tips sorted by score (descending), limited to maxResults.
 */
export function resolveGrowthTips(ctx: TipContext, maxResults: number = 5): GrowthTip[] {
  const applicable = TIPS
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
    // Handle dynamic body/title that are functions (cast as unknown as string in definitions)
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
 * Pick a single tip for display, optionally using a seed for rotation.
 * Falls back to a generic tip if no tips are applicable.
 */
export function pickGrowthTip(ctx: TipContext, seed: number = 0): GrowthTip {
  const tips = resolveGrowthTips(ctx, 5);
  if (tips.length === 0) {
    return {
      id: 'default',
      category: 'engagement',
      priority: 'low',
      title: 'Grow your store with Visible Shelf',
      body: 'Complete your store profile, add products, and keep your information up to date to maximize your visibility on Google and the platform directory.',
      cta: 'View settings',
      ctaLink: `/t/${ctx.tenantId}/settings/tenant`,
      icon: 'Sparkles',
      gradient: 'from-blue-600 to-indigo-700',
    };
  }
  return tips[seed % tips.length];
}
