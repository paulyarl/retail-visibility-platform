/**
 * Chain Pricing Structure
 * Separate chain pricing from individual subscriptions with proper tier mapping
 */

export interface ChainTier {
  name: string;
  price: string;
  period: string;
  tagline: string;
  description: string;
  identity: string;
  realization: string;
  upgradeTrigger: string;
  features: string[];
  excluded: string[];
  cta: string;
  popular: boolean;
  badge: string;
  color: string;
  minLocations: number;
  maxLocations: number;
  discount: string;
}

export const CHAIN_TIERS: ChainTier[] = [
  {
    name: 'Chain Discovery',
    price: '$19',
    period: '/location/month',
    tagline: 'Get Found on Google',
    description: 'Complete Google visibility stack for multi-location retailers',
    identity: 'I exist online',
    realization: 'People are finding my products on Google',
    upgradeTrigger: 'Now I want them to find my whole store',
    features: [
      'Clover POS integration & real-time inventory sync',
      'SEO-optimised product pages (hosted on platform)',
      'Google Search indexing',
      'Google Shopping visibility',
      'Google Maps / SWIS (See What\'s In Store)',
      'Platform directory listing',
      'Basic QR codes (product, storefront, directory)',
      '14-day free trial',
      'Multi-location management dashboard',
      'Centralized product catalog',
      'Bulk operations across locations'
    ],
    excluded: [
      'Platform product visibility',
      'Branded storefront page',
      'Store logo on QR codes',
      'Add to cart / checkout',
      'Conversion features'
    ],
    cta: 'Start Free Trial',
    popular: false,
    badge: 'CHAIN STARTER',
    color: 'from-blue-500 to-purple-600',
    minLocations: 2,
    maxLocations: 10,
    discount: '35% off individual pricing'
  },
  {
    name: 'Chain Storefront',
    price: '$39',
    period: '/location/month',
    tagline: 'Own Your Platform Presence',
    description: 'Branded storefront inside Visible Shelf marketplace for chains',
    identity: 'I have a store online',
    realization: 'Shoppers are browsing — but can\'t act on it',
    upgradeTrigger: 'I want shoppers to commit to buying',
    features: [
      'Everything in Chain Discovery',
      'Branded public storefront page',
      'Platform product visibility',
      'Platform search & browse',
      'Product categories & filtering',
      'Store profile, hours & details',
      'Shopper inquiry / contact seller',
      'Enhanced directory listing',
      'Basic QR codes (product, storefront, directory)',
      '14-day free trial',
      'Chain-level branding consistency',
      'Centralized storefront management'
    ],
    excluded: [
      'Store logo on QR codes',
      'Add to cart / checkout',
      'Conversion features'
    ],
    cta: 'Upgrade to Storefront',
    popular: false,
    badge: 'CHAIN GROWTH',
    color: 'from-purple-500 to-indigo-600',
    minLocations: 2,
    maxLocations: 25,
    discount: '34% off individual pricing'
  },
  {
    name: 'Chain Commitment',
    price: '$69',
    period: '/location/month',
    tagline: 'Capture Intent and Drive Foot Traffic',
    description: 'Commerce features with holding deposits for multi-location retailers',
    identity: 'I am selling online',
    realization: 'Shoppers reserve and show up — but some want to pay fully online',
    upgradeTrigger: 'I want to close the full sale online',
    features: [
      'Everything in Chain Storefront',
      'Add to cart functionality',
      'Shopping cart management',
      'Holding / commitment fee (10–15%)',
      'Reserve / BOPIS / click & collect',
      'Conversion analytics & reporting',
      'Store logo on QR codes',
      '14-day free trial',
      'Chain-wide commerce policies',
      'Centralized order management',
      'Cross-location fulfillment options'
    ],
    excluded: [
      'Full online payment collection',
      'Delivery / fulfilment',
      'Advanced analytics'
    ],
    cta: 'Upgrade to Commitment',
    popular: true,
    badge: 'CHAIN POPULAR',
    color: 'from-green-500 to-emerald-600',
    minLocations: 2,
    maxLocations: 50,
    discount: '30% off individual pricing'
  },
  {
    name: 'Chain Professional',
    price: '$149',
    period: '/location/month',
    tagline: 'Full E-Commerce Platform',
    description: 'Complete e-commerce platform with advanced features for chains',
    identity: 'I am a full online retailer',
    realization: 'I have everything I need for online sales',
    upgradeTrigger: 'I want advanced features and multi-location support',
    features: [
      'Everything in Chain Commitment',
      'Full online payment collection',
      'Shopper payment path choice',
      'Delivery / fulfilment',
      'Advanced analytics dashboard',
      'API access & custom integrations',
      'Priority directory placement',
      '14-day free trial',
      'Chain-level API access',
      'Advanced chain analytics',
      'Custom integration support'
    ],
    excluded: [
      'Multi-location support (already included)',
      'Dedicated onboarding',
      'Enterprise security'
    ],
    cta: 'Upgrade to Professional',
    popular: false,
    badge: 'CHAIN ADVANCED',
    color: 'from-amber-500 to-red-600',
    minLocations: 3,
    maxLocations: 100,
    discount: '25% off individual pricing'
  },
  {
    name: 'Chain Enterprise',
    price: '$399',
    period: '/location/month',
    tagline: 'Complete Business Solution',
    description: 'Enterprise-grade tools and support for large chains and franchises',
    identity: 'I am running a complete business operation',
    realization: 'I have enterprise-grade tools and support',
    upgradeTrigger: 'Growth, scale, and advanced business needs',
    features: [
      'Everything in Chain Professional',
      'Multi-location support (unlimited)',
      'Advanced analytics dashboard',
      'Dedicated onboarding & support',
      'Enterprise security & compliance',
      'Custom contracts & pricing',
      'White-label options',
      '14-day free trial',
      'Unlimited locations',
      'Enterprise-grade analytics',
      'Dedicated account manager',
      'Custom integration development',
      'White-label platform options'
    ],
    excluded: [],
    cta: 'Contact Sales',
    popular: false,
    badge: 'CHAIN ENTERPRISE',
    color: 'from-red-500 to-pink-600',
    minLocations: 5,
    maxLocations: 999,
    discount: '20% off individual pricing'
  }
];

// Helper functions
export function getChainTierByName(name: string): ChainTier | undefined {
  return CHAIN_TIERS.find(tier => tier.name.toLowerCase().includes(name.toLowerCase()));
}

export function getChainTiersByLocationCount(locationCount: number): ChainTier[] {
  return CHAIN_TIERS.filter(tier => 
    locationCount >= tier.minLocations && locationCount <= tier.maxLocations
  );
}

export function calculateChainSavings(individualPrice: number, chainPrice: number, locationCount: number): {
  monthlySavings: number;
  annualSavings: number;
  discountPercentage: number;
} {
  const individualMonthlyTotal = individualPrice * locationCount;
  const chainMonthlyTotal = chainPrice * locationCount;
  const monthlySavings = individualMonthlyTotal - chainMonthlyTotal;
  const annualSavings = monthlySavings * 12;
  const discountPercentage = Math.round((monthlySavings / individualMonthlyTotal) * 100);

  return {
    monthlySavings,
    annualSavings,
    discountPercentage
  };
}

export function getChainPricingSummary(locationCount: number): {
  tier: ChainTier;
  monthlyTotal: number;
  annualTotal: number;
  savings: ReturnType<typeof calculateChainSavings>;
} | null {
  const eligibleTiers = getChainTiersByLocationCount(locationCount);
  if (!eligibleTiers.length) return null;

  // Get the highest tier they qualify for
  const tier = eligibleTiers[eligibleTiers.length - 1];
  const monthlyTotal = parseInt(tier.price.replace('$', '')) * locationCount;
  const annualTotal = monthlyTotal * 12;
  
  // Calculate savings vs individual pricing
  const individualPrice = getIndividualPriceForTier(tier.name.replace('Chain ', ''));
  const savings = calculateChainSavings(individualPrice, parseInt(tier.price.replace('$', '')), locationCount);

  return {
    tier,
    monthlyTotal,
    annualTotal,
    savings
  };
}

function getIndividualPriceForTier(tierName: string): number {
  const prices: Record<string, number> = {
    'Discovery': 29,
    'Storefront': 59,
    'Commitment': 79,  // V2 pricing
    'E-commerce': 99,   // V2 new tier
    'Omnichannel': 149, // V2 new tier
    'Professional': 199,
    'Organization': 499,
    'Enterprise': 499   // V2 pricing
  };
  return prices[tierName] || 99;
}

// Chain benefits over individual subscriptions
export const CHAIN_BENEFITS = [
  {
    title: 'Massive Volume Discounts',
    description: 'Save 20-35% per location with chain pricing',
    icon: '💰'
  },
  {
    title: 'Centralized Management',
    description: 'Manage all locations from one dashboard',
    icon: '🎛️'
  },
  {
    title: 'Consistent Branding',
    description: 'Ensure brand consistency across all locations',
    icon: '🎨'
  },
  {
    title: 'Bulk Operations',
    description: 'Update products, hours, and settings across locations',
    icon: '⚡'
  },
  {
    title: 'Chain Analytics',
    description: 'Compare performance across all locations',
    icon: '📊'
  },
  {
    title: 'Cross-Location Fulfillment',
    description: 'Fulfill orders from any location in your chain',
    icon: '🚚'
  }
];
