/**
 * Deposit Calculator for Commerce-Enabled Tiers
 * 
 * Handles deposit/holding fee calculation for commerce-enabled tiers:
 * - 5-50% deposit collected at checkout (merchant-configurable)
 * - Remaining balance paid at pickup
 * - Fee distribution on abandonment
 */

import { Decimal } from '@prisma/client/runtime/library';

/**
 * Deposit configuration for commerce-enabled tiers
 * Range matches commerce settings validation (5-50%)
 */
export const DEPOSIT_CONFIG = {
  DEFAULT_PERCENTAGE: 15, // 15% default deposit (matches commerce settings)
  MIN_PERCENTAGE: 5,   // 5% minimum (matches commerce settings)
  MAX_PERCENTAGE: 50,  // 50% maximum (matches commerce settings)
  PICKUP_DEADLINE_HOURS: 48, // 48 hours to pickup before forfeiture
  PLATFORM_FORFEIT_FEE_PERCENT: 20, // Platform takes 20-25% of forfeited deposits
  MAX_PLATFORM_FORFEIT_FEE_PERCENT: 25,
  RETAILER_FORFEIT_COMPENSATION_PERCENT: 75, // Retailer gets 75-80% of forfeited deposits
  MIN_RETAILER_FORFEIT_COMPENSATION_PERCENT: 80,
} as const;

/**
 * Checkout mode types
 */
export type CheckoutMode = 'deposit' | 'full_payment';

/**
 * Deposit calculation result
 */
export interface DepositCalculation {
  checkoutMode: CheckoutMode;
  depositPercentage: number;
  depositCents: number;
  remainingBalanceCents: number;
  totalCents: number;
  pickupDeadline?: Date;
}

/**
 * Forfeiture calculation result
 */
export interface ForfeitureCalculation {
  depositCents: number;
  platformFeeCents: number;
  retailerCompensationCents: number;
  forfeitedAt: Date;
}

/**
 * Determine checkout mode based on tenant tier
 * 
 * Tier rules:
 * - commitment: Deposit-only checkout (no customer choice)
 * - professional: Customer can choose deposit or full payment
 * - enterprise: Customer can choose deposit or full payment
 * - All other tiers: Full payment only
 */
export function getCheckoutModeForTier(tierKey: string): CheckoutMode {
  const effectiveTier = tierKey.startsWith('trial_') 
    ? tierKey.replace('trial_', '') 
    : tierKey;
  
  // Tier 3 commitment uses deposit-only mode
  if (effectiveTier === 'commitment') {
    return 'deposit';
  }
  
  // All other tiers use full payment by default
  return 'full_payment';
}

/**
 * Check if tenant tier supports deposit checkout option
 * 
 * Returns:
 * - 'required' for commitment tier (deposit-only, no choice)
 * - 'optional' for professional/enterprise (customer can choose)
 * - 'none' for other tiers (full payment only)
 */
export function getDepositOptionForTier(tierKey: string): 'required' | 'optional' | 'none' {
  const effectiveTier = tierKey.startsWith('trial_') 
    ? tierKey.replace('trial_', '') 
    : tierKey;
  
  // Commitment tier: deposit is required
  if (effectiveTier === 'commitment') {
    return 'required';
  }
  
  // Professional and Enterprise: customer can choose
  if (effectiveTier === 'professional' || effectiveTier === 'enterprise') {
    return 'optional';
  }
  
  // All other tiers: no deposit option
  return 'none';
}

/**
 * Check if tenant tier supports deposit checkout (any form)
 */
export function supportsDepositCheckout(tierKey: string): boolean {
  const effectiveTier = tierKey.startsWith('trial_') 
    ? tierKey.replace('trial_', '') 
    : tierKey;
  
  // Commitment, Professional, and Enterprise support deposit
  return effectiveTier === 'commitment' || 
         effectiveTier === 'professional' || 
         effectiveTier === 'enterprise';
}

/**
 * Calculate deposit amount for commitment checkout
 * 
 * @param totalCents - Total order amount in cents
 * @param depositPercentage - Optional custom deposit percentage (default: 15%)
 * @returns Deposit calculation with amounts and deadline
 */
export function calculateDeposit(
  totalCents: number,
  depositPercentage?: number
): DepositCalculation {
  // Use provided percentage or default
  const percentage = depositPercentage ?? DEPOSIT_CONFIG.DEFAULT_PERCENTAGE;
  
  // Validate percentage is within bounds
  const validPercentage = Math.max(
    DEPOSIT_CONFIG.MIN_PERCENTAGE,
    Math.min(DEPOSIT_CONFIG.MAX_PERCENTAGE, percentage)
  );
  
  // Calculate deposit amount
  const depositCents = Math.round(totalCents * (validPercentage / 100));
  
  // Calculate remaining balance
  const remainingBalanceCents = totalCents - depositCents;
  
  // Calculate pickup deadline (48 hours from now)
  const pickupDeadline = new Date();
  pickupDeadline.setHours(pickupDeadline.getHours() + DEPOSIT_CONFIG.PICKUP_DEADLINE_HOURS);
  
  return {
    checkoutMode: 'deposit',
    depositPercentage: validPercentage,
    depositCents,
    remainingBalanceCents,
    totalCents,
    pickupDeadline,
  };
}

/**
 * Calculate forfeiture distribution when shopper abandons order
 * 
 * @param depositCents - Deposit amount collected
 * @returns Forfeiture calculation with fee distribution
 */
export function calculateForfeiture(depositCents: number): ForfeitureCalculation {
  // Platform takes 20% of forfeited deposit
  const platformFeeCents = Math.round(
    depositCents * (DEPOSIT_CONFIG.PLATFORM_FORFEIT_FEE_PERCENT / 100)
  );
  
  // Retailer gets remaining 80%
  const retailerCompensationCents = depositCents - platformFeeCents;
  
  return {
    depositCents,
    platformFeeCents,
    retailerCompensationCents,
    forfeitedAt: new Date(),
  };
}

/**
 * Check if order is eligible for deposit forfeiture
 * (pickup deadline has passed and order not fulfilled)
 */
export function isEligibleForForfeiture(
  pickupDeadline: Date,
  fulfilledAt?: Date | null,
  cancelledAt?: Date | null
): boolean {
  // If already fulfilled or cancelled, not eligible
  if (fulfilledAt || cancelledAt) {
    return false;
  }
  
  // Check if deadline has passed
  return new Date() > pickupDeadline;
}

/**
 * Get deposit percentage for tenant from commerce settings
 * 
 * Merchant-configured deposit percentage for their business needs.
 * Platform fees are separate and handled in transaction processing.
 */
export async function getDepositPercentageForTenant(
  tenantId: string,
  prisma: any
): Promise<number> {
  // Check tenant's commerce settings for merchant-configured deposit percentage
  const commerceSettings = await prisma.tenant_commerce_settings.findUnique({
    where: { tenant_id: tenantId },
    select: { deposit_percentage: true }
  });
  
  // If commerce settings exist and deposit is enabled, use merchant's percentage
  if (commerceSettings?.deposit_percentage) {
    return Math.max(
      DEPOSIT_CONFIG.MIN_PERCENTAGE,
      Math.min(DEPOSIT_CONFIG.MAX_PERCENTAGE, commerceSettings.deposit_percentage)
    );
  }
  
  // Otherwise, return default percentage
  return DEPOSIT_CONFIG.DEFAULT_PERCENTAGE;
}

/**
 * Format deposit info for display
 */
export function formatDepositInfo(calculation: DepositCalculation): {
  depositAmount: string;
  remainingBalance: string;
  totalAmount: string;
  percentage: string;
  deadline: string;
} {
  return {
    depositAmount: `$${(calculation.depositCents / 100).toFixed(2)}`,
    remainingBalance: `$${(calculation.remainingBalanceCents / 100).toFixed(2)}`,
    totalAmount: `$${(calculation.totalCents / 100).toFixed(2)}`,
    percentage: `${calculation.depositPercentage}%`,
    deadline: calculation.pickupDeadline?.toLocaleString() || 'N/A',
  };
}
