/**
 * Pricing utilities for list price / sale price model
 */

export interface PricingInfo {
  listPrice: number;
  salePrice: number | null;
  effectivePrice: number;
  isOnSale: boolean;
  savingsAmount: number;
  savingsPercent: number;
}

/**
 * Calculate pricing information from list and sale prices
 */
export function calculatePricing(
  priceCents: number,
  salePriceCents?: number | null
): PricingInfo {
  const isOnSale = Boolean(salePriceCents && salePriceCents < priceCents);
  const effectivePrice = isOnSale ? salePriceCents! : priceCents;
  const savingsAmount = isOnSale ? priceCents - salePriceCents! : 0;
  const savingsPercent = isOnSale
    ? Math.round((savingsAmount / priceCents) * 100)
    : 0;

  return {
    listPrice: priceCents,
    salePrice: salePriceCents || null,
    effectivePrice,
    isOnSale,
    savingsAmount,
    savingsPercent,
  };
}

/**
 * Format price in cents to currency string
 */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format savings display
 */
export function formatSavings(
  savingsAmount: number,
  savingsPercent: number
): string {
  return `Save ${formatPrice(savingsAmount)} (${savingsPercent}%)`;
}
