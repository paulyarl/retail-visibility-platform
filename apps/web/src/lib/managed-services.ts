/**
 * Managed Services - Professional data entry and catalog management
 * Additional revenue stream beyond platform subscriptions
 */

export type ServiceLevel = 
  | 'self_service' 
  | 'managed_bronze' 
  | 'managed_silver' 
  | 'managed_gold' 
  | 'managed_platinum';

export interface ManagedServicePackage {
  id: ServiceLevel;
  name: string;
  tagline: string;
  setupFee: number;
  monthlyFee: number;
  skuSetupCost: number;
  monthlySkuQuota: number;
  features: string[];
  color: string;
  popular?: boolean;
}

export const MANAGED_SERVICES: Record<ServiceLevel, ManagedServicePackage> = {
  self_service: {
    id: 'self_service',
    name: 'Self-Service',
    tagline: 'Manage your own inventory',
    setupFee: 0,
    monthlyFee: 0,
    skuSetupCost: 0,
    monthlySkuQuota: 0,
    features: [
      'Full platform access',
      'Self-managed inventory',
      'DIY product entry',
      'All platform features',
    ],
    color: 'bg-neutral-100 text-neutral-800',
  },
  managed_bronze: {
    id: 'managed_bronze',
    name: 'Managed Bronze',
    tagline: 'One-time catalog setup',
    setupFee: 0,
    monthlyFee: 0,
    skuSetupCost: 10,
    monthlySkuQuota: 0,
    features: [
      '$10 per SKU setup (one-time)',
      'Data entry (name, SKU, price, stock)',
      'Basic categorization',
      'Standard descriptions',
      '1 product photo per SKU',
      'No ongoing management',
    ],
    color: 'bg-orange-100 text-orange-800',
  },
  managed_silver: {
    id: 'managed_silver',
    name: 'Managed Silver',
    tagline: 'Professional setup + monthly updates',
    setupFee: 0,
    monthlyFee: 199,
    skuSetupCost: 20,
    monthlySkuQuota: 20,
    features: [
      '$20 per SKU initial setup',
      'Professional descriptions',
      'SEO optimization',
      'Up to 3 photos per product',
      'Monthly price/stock updates',
      '20 new SKUs/month included',
      'Additional SKUs: $10 each',
      'Email support',
    ],
    color: 'bg-blue-100 text-blue-800',
    popular: true,
  },
  managed_gold: {
    id: 'managed_gold',
    name: 'Managed Gold',
    tagline: 'Full-service catalog management',
    setupFee: 0,
    monthlyFee: 499,
    skuSetupCost: 30,
    monthlySkuQuota: 50,
    features: [
      '$30 per SKU initial setup',
      'Professional photography coordination',
      'Marketing-focused descriptions',
      'Google Shopping optimization',
      'Up to 5 photos per product',
      'Weekly updates',
      '50 new SKUs/month included',
      'Additional SKUs: $10 each',
      'Dedicated account manager',
      'Priority support',
    ],
    color: 'bg-purple-100 text-purple-800',
  },
  managed_platinum: {
    id: 'managed_platinum',
    name: 'Managed Platinum',
    tagline: 'Enterprise concierge service',
    setupFee: 0,
    monthlyFee: 999,
    skuSetupCost: 0,
    monthlySkuQuota: Infinity,
    features: [
      'Unlimited SKU setup included',
      'Professional photography',
      'Premium copywriting',
      'Advanced SEO optimization',
      'Unlimited photos per product',
      'Daily updates',
      'Unlimited new SKUs/month',
      'Dedicated account manager',
      'Custom integrations',
      'Inventory audits',
      'Competitive analysis',
      'Performance reporting',
      '24/7 priority support',
    ],
    color: 'bg-amber-100 text-amber-800',
  },
};

/**
 * Calculate total cost for managed services
 */
export function calculateManagedServiceCost(
  serviceLevel: ServiceLevel,
  initialSkus: number,
  monthlyNewSkus: number = 0
): {
  setupCost: number;
  monthlyRecurring: number;
  firstMonthTotal: number;
  annualCost: number;
} {
  const service = MANAGED_SERVICES[serviceLevel];
  
  if (serviceLevel === 'self_service') {
    return {
      setupCost: 0,
      monthlyRecurring: 0,
      firstMonthTotal: 0,
      annualCost: 0,
    };
  }

  // Initial setup cost
  const setupCost = initialSkus * service.skuSetupCost;
  
  // Monthly recurring
  let monthlyRecurring = service.monthlyFee;
  
  // Additional SKUs beyond quota
  if (monthlyNewSkus > service.monthlySkuQuota) {
    const additionalSkus = monthlyNewSkus - service.monthlySkuQuota;
    monthlyRecurring += additionalSkus * 10; // $10 per additional SKU
  }
  
  const firstMonthTotal = setupCost + monthlyRecurring;
  const annualCost = setupCost + (monthlyRecurring * 12);

  return {
    setupCost,
    monthlyRecurring,
    firstMonthTotal,
    annualCost,
  };
}

/**
 * Get service level display name
 */
export function getServiceLevelName(level: ServiceLevel): string {
  return MANAGED_SERVICES[level]?.name || 'Self-Service';
}

/**
 * Check if service level includes managed services
 */
export function isManagedService(level: ServiceLevel): boolean {
  return level !== 'self_service';
}
