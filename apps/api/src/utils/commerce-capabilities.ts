/**
 * Commerce Capabilities Utility
 * 
 * Consolidates tenant tier features and commerce settings into unified commerce capabilities
 * This replaces scattered logic across checkout, payment, and order management
 */

import { prisma } from '../prisma';

export interface CommerceCapabilities {
  // Overall commerce availability
  commerce_enabled: boolean;
  
  // Payment options availability
  deposit_enabled: boolean;
  full_payment_enabled: boolean;
  
  // Deposit configuration
  deposit_percentage: number;
  deposit_min_cents: number;
  deposit_max_cents: number;
  
  // Order management
  auto_confirm_orders: boolean;
  order_confirmation_minutes: number;
  
  // Customer experience
  show_payment_options: boolean;
  require_payment_upfront: boolean;
  allow_payment_on_pickup: boolean;
  
  // Notifications
  notify_on_payment: boolean;
  notify_on_deposit: boolean;
  notify_on_fulfillment: boolean;
  
  // Metadata
  tier: string;
  source: 'tier_features' | 'tenant_settings' | 'organization_settings' | 'combined';
}

export interface CheckoutMode {
  mode: 'deposit_only' | 'full_payment_only' | 'flexible' | 'disabled';
  deposit_percentage?: number;
  deposit_min_cents?: number;
  deposit_max_cents?: number;
}

/**
 * Get comprehensive commerce capabilities for an organization
 * Combines tier-based features from organization's tenants with organization commerce settings
 * 
 * Priority: Organization Settings → Platform Defaults
 */
export async function getOrganizationCommerceCapabilities(
  organizationId: string,
  prismaClient: any = prisma
): Promise<CommerceCapabilities> {
  // Get all tenants in the organization and their tier keys
  const tenants = await prismaClient.tenants.findMany({
    where: { organization_id: organizationId },
    select: {
      subscription_tier: true,
    },
  });

  // Get unique tier keys from tenants
  const tierKeys = [...new Set(tenants.map((t: { subscription_tier: any; }) => t.subscription_tier).filter(Boolean))];

  // Fetch tier features for all unique tiers
  const tierFeatures = await prismaClient.subscription_tiers_list.findMany({
    where: {
      tier_key: { in: tierKeys },
      is_active: true,
    },
    select: {
      tier_features_list: {
        select: {
          feature_key: true,
          is_enabled: true,
        },
      },
    },
  });

  // Collect all unique features from all tenants' tiers
  const allTierFeatures = new Set<string>();
  tierFeatures.forEach((tier: { tier_features_list: { feature_key: string; is_enabled: boolean }[]; }) => {
    tier.tier_features_list.forEach((feature) => {
      if (feature.is_enabled) {
        allTierFeatures.add(feature.feature_key);
      }
    });
  });

  // Convert to capabilities object
  const tierCapabilities: any = {};
  allTierFeatures.forEach(feature => {
    tierCapabilities[feature] = true;
  });

  // Get organization commerce settings
  const organizationCommerceSettings = await prismaClient.organization_commerce_settings.findUnique({
    where: { organization_id: organizationId }
  });

  const capabilities: CommerceCapabilities = {
    // Commerce is enabled only if tier supports it AND organization has it enabled
    commerce_enabled: tierCapabilities.commerce_enabled && (
      organizationCommerceSettings?.deposit_enabled || organizationCommerceSettings?.full_payment_enabled || true
    ),

    // Payment options: Tier determines what's available, organization settings determine what's enabled
    deposit_enabled: tierCapabilities.commerce_deposit_only && (
      organizationCommerceSettings?.deposit_enabled ?? true
    ),
    full_payment_enabled: tierCapabilities.commerce_full_payment && (
      organizationCommerceSettings?.full_payment_enabled ?? true
    ),

    // Deposit configuration
    deposit_percentage: organizationCommerceSettings?.deposit_percentage ?? 15,
    deposit_min_cents: organizationCommerceSettings?.deposit_min_cents ?? 500,
    deposit_max_cents: organizationCommerceSettings?.deposit_max_cents ?? 5000,

    // Order management
    auto_confirm_orders: organizationCommerceSettings?.auto_confirm_orders ?? true,
    order_confirmation_minutes: organizationCommerceSettings?.order_confirmation_minutes ?? 15,

    // Payment display
    show_payment_options: organizationCommerceSettings?.show_payment_options ?? true,
    require_payment_upfront: organizationCommerceSettings?.require_payment_upfront ?? false,
    allow_payment_on_pickup: organizationCommerceSettings?.allow_payment_on_pickup ?? true,

    // Notifications
    notify_on_payment: organizationCommerceSettings?.notify_on_payment ?? true,
    notify_on_deposit: organizationCommerceSettings?.notify_on_deposit ?? true,
    notify_on_fulfillment: organizationCommerceSettings?.notify_on_fulfillment ?? true,

    // Metadata
    source: 'combined',
    tier: ''
  };

  return capabilities;
}

/**
 * Get comprehensive commerce capabilities for a tenant
 * Combines tier-based features with tenant-specific and organization commerce settings
 * 
 * Priority: Tenant Settings → Organization Settings → Platform Defaults
 */
export async function getTenantCommerceCapabilities(
  tenantId: string,
  prismaClient: any = prisma
): Promise<CommerceCapabilities> {
  // Get tenant tier and organization information
  const tenant = await prismaClient.tenants.findUnique({
    where: { id: tenantId },
    select: {
      subscription_tier: true,
      organization_id: true,
    },
  });

  const tier = tenant?.subscription_tier || '';
  const organizationId = tenant?.organization_id;

  // Get tier features separately
  const tierData = await prismaClient.subscription_tiers_list.findUnique({
    where: { tier_key: tier },
    select: {
      tier_features_list: {
        select: {
          feature_key: true,
          is_enabled: true,
        },
      },
    },
  });

  const tierFeatures = tierData?.tier_features_list || [];

  // Convert tier features to key-value object
  const tierCapabilities = tierFeatures.reduce((acc: any, feature: any) => {
    acc[feature.feature_key] = feature.is_enabled;
    return acc;
  }, {});

  // Get tenant commerce settings
  const tenantCommerceSettings = await prismaClient.tenant_commerce_settings.findUnique({
    where: { tenant_id: tenantId }
  });

  // Get organization commerce settings if tenant belongs to an organization
  let organizationCommerceSettings = null;
  if (organizationId) {
    organizationCommerceSettings = await prismaClient.organization_commerce_settings.findUnique({
      where: { organization_id: organizationId }
    });
  }

  // Helper function to get value with hierarchy: tenant → organization → default
  const getHierarchicalValue = (tenantValue: any, orgValue: any, defaultValue: any) => 
    tenantValue !== undefined ? tenantValue : (orgValue !== undefined ? orgValue : defaultValue);

  // Determine final capabilities by combining tier features with hierarchical settings
  const capabilities: CommerceCapabilities = {
    // Commerce is enabled only if tier supports it AND any level has it enabled
    commerce_enabled: tierCapabilities.commerce_enabled && (
      getHierarchicalValue(
        tenantCommerceSettings?.deposit_enabled || tenantCommerceSettings?.full_payment_enabled,
        organizationCommerceSettings?.deposit_enabled || organizationCommerceSettings?.full_payment_enabled,
        true
      )
    ),
    
    // Payment options: Tier determines what's available, hierarchical settings determine what's enabled
    deposit_enabled: tierCapabilities.commerce_deposit_only && getHierarchicalValue(
      tenantCommerceSettings?.deposit_enabled,
      organizationCommerceSettings?.deposit_enabled,
      true
    ),
    full_payment_enabled: tierCapabilities.commerce_full_payment && getHierarchicalValue(
      tenantCommerceSettings?.full_payment_enabled,
      organizationCommerceSettings?.full_payment_enabled,
      true
    ),
    
    // Deposit configuration with hierarchy
    deposit_percentage: getHierarchicalValue(
      tenantCommerceSettings?.deposit_percentage,
      organizationCommerceSettings?.deposit_percentage,
      15
    ),
    deposit_min_cents: getHierarchicalValue(
      tenantCommerceSettings?.deposit_min_cents,
      organizationCommerceSettings?.deposit_min_cents,
      500
    ),
    deposit_max_cents: getHierarchicalValue(
      tenantCommerceSettings?.deposit_max_cents,
      organizationCommerceSettings?.deposit_max_cents,
      5000
    ),
    
    // Order management with hierarchy
    auto_confirm_orders: getHierarchicalValue(
      tenantCommerceSettings?.auto_confirm_orders,
      organizationCommerceSettings?.auto_confirm_orders,
      true
    ),
    order_confirmation_minutes: getHierarchicalValue(
      tenantCommerceSettings?.order_confirmation_minutes,
      organizationCommerceSettings?.order_confirmation_minutes,
      15
    ),
    
    // Customer experience with hierarchy
    show_payment_options: getHierarchicalValue(
      tenantCommerceSettings?.show_payment_options,
      organizationCommerceSettings?.show_payment_options,
      true
    ),
    require_payment_upfront: getHierarchicalValue(
      tenantCommerceSettings?.require_payment_upfront,
      organizationCommerceSettings?.require_payment_upfront,
      false
    ),
    allow_payment_on_pickup: getHierarchicalValue(
      tenantCommerceSettings?.allow_payment_on_pickup,
      organizationCommerceSettings?.allow_payment_on_pickup,
      true
    ),
    
    // Notifications with hierarchy
    notify_on_payment: getHierarchicalValue(
      tenantCommerceSettings?.notify_on_payment,
      organizationCommerceSettings?.notify_on_payment,
      true
    ),
    notify_on_deposit: getHierarchicalValue(
      tenantCommerceSettings?.notify_on_deposit,
      organizationCommerceSettings?.notify_on_deposit,
      true
    ),
    notify_on_fulfillment: getHierarchicalValue(
      tenantCommerceSettings?.notify_on_fulfillment,
      organizationCommerceSettings?.notify_on_fulfillment,
      true
    ),
    
    // Metadata
    tier,
    source: tenantCommerceSettings ? 'tenant_settings' : (organizationCommerceSettings ? 'organization_settings' : 'tier_features')
  };

  return capabilities;
}

/**
 * Get checkout mode based on commerce capabilities
 * Simplified Business Rules:
 * A) Merchant has deposit enabled only → Customer sees deposit only
 * B) Merchant has full payment enabled only → Customer sees full payment only  
 * C) Merchant has both enabled → Customer sees both options (implicit choice)
 * D) Merchant disables all → Customer sees no add to cart (disabled)
 */
export function getCheckoutMode(capabilities: CommerceCapabilities): CheckoutMode {
  if (!capabilities.commerce_enabled) {
    return { mode: 'disabled' };
  }

  const hasDeposit = capabilities.deposit_enabled;
  const hasFullPayment = capabilities.full_payment_enabled;

  // Rule D: Merchant disables all options
  if (!hasDeposit && !hasFullPayment) {
    return { mode: 'disabled' };
  }

  // Rule A: Merchant has deposit only
  if (hasDeposit && !hasFullPayment) {
    return {
      mode: 'deposit_only',
      deposit_percentage: capabilities.deposit_percentage,
      deposit_min_cents: capabilities.deposit_min_cents,
      deposit_max_cents: capabilities.deposit_max_cents
    };
  }

  // Rule B: Merchant has full payment only
  if (hasFullPayment && !hasDeposit) {
    return { mode: 'full_payment_only' };
  }

  // Rule C: Merchant has both enabled → Customer sees both options
  if (hasDeposit && hasFullPayment) {
    return {
      mode: 'flexible',
      deposit_percentage: capabilities.deposit_percentage,
      deposit_min_cents: capabilities.deposit_min_cents,
      deposit_max_cents: capabilities.deposit_max_cents
    };
  }

  // Safety fallback
  return { mode: 'disabled' };
}

/**
 * Check if tenant can process deposits
 */
export function canProcessDeposits(capabilities: CommerceCapabilities): boolean {
  return capabilities.commerce_enabled && capabilities.deposit_enabled;
}

/**
 * Check if tenant can process full payments
 */
export function canProcessFullPayments(capabilities: CommerceCapabilities): boolean {
  return capabilities.commerce_enabled && capabilities.full_payment_enabled;
}

/**
 * Get deposit percentage for order calculation
 * Validates against min/max constraints
 */
export function getDepositPercentageForOrder(
  capabilities: CommerceCapabilities,
  orderTotalCents: number
): number {
  if (!canProcessDeposits(capabilities)) {
    throw new Error('Tenant cannot process deposits');
  }

  const percentage = capabilities.deposit_percentage;
  const minDeposit = capabilities.deposit_min_cents;
  const maxDeposit = capabilities.deposit_max_cents;

  // Calculate deposit amount
  const depositAmount = Math.round(orderTotalCents * (percentage / 100));

  // Apply min/max constraints
  if (depositAmount < minDeposit) {
    // If calculated deposit is below minimum, use minimum
    return Math.round((minDeposit / orderTotalCents) * 100);
  }

  if (depositAmount > maxDeposit) {
    // If calculated deposit is above maximum, use maximum
    return Math.round((maxDeposit / orderTotalCents) * 100);
  }

  return percentage;
}

/**
 * Validate checkout request against commerce capabilities
 */
export function validateCheckoutRequest(
  capabilities: CommerceCapabilities,
  request: {
    checkoutMode: string;
    depositPercentage?: number;
    orderTotalCents: number;
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!capabilities.commerce_enabled) {
    errors.push('Commerce is not enabled for this tenant');
    return { valid: false, errors };
  }

  const checkoutMode = getCheckoutMode(capabilities);

  switch (request.checkoutMode) {
    case 'deposit':
      if (!canProcessDeposits(capabilities)) {
        errors.push('Deposit payments are not enabled');
      }
      if (request.depositPercentage && request.depositPercentage !== capabilities.deposit_percentage) {
        errors.push('Deposit percentage does not match tenant settings');
      }
      break;

    case 'full_payment':
      if (!canProcessFullPayments(capabilities)) {
        errors.push('Full payments are not enabled');
      }
      break;

    case 'flexible':
      if (checkoutMode.mode !== 'flexible') {
        errors.push('Both deposit and full payment options must be enabled');
      }
      break;

    default:
      errors.push('Invalid checkout mode');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get public commerce capabilities (for checkout UI)
 * Excludes sensitive configuration details
 */
export function getPublicCommerceCapabilities(capabilities: CommerceCapabilities) {
  return {
    commerce_enabled: capabilities.commerce_enabled,
    deposit_enabled: capabilities.deposit_enabled,
    full_payment_enabled: capabilities.full_payment_enabled,
    show_payment_options: capabilities.show_payment_options,
    require_payment_upfront: capabilities.require_payment_upfront,
    allow_payment_on_pickup: capabilities.allow_payment_on_pickup,
    checkout_mode: getCheckoutMode(capabilities)
  };
}
