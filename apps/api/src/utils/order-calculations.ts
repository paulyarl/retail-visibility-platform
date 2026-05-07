/**
 * Order Calculation Utilities
 * Handles pricing calculations for orders
 */

export interface OrderItemCalculation {
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
}

export interface OrderTotalsCalculation {
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
}

/**
 * Calculate line item totals
 * @param quantity - Item quantity
 * @param unitPriceCents - Unit price in cents
 * @param taxRate - Tax rate (e.g., 0.08 for 8%)
 * @param discountCents - Discount amount in cents
 * @returns OrderItemCalculation
 */
export function calculateLineItem(
  quantity: number,
  unitPriceCents: number,
  taxRate: number = 0,
  discountCents: number = 0
): OrderItemCalculation {
  const subtotal_cents = quantity * unitPriceCents;
  const discounted_subtotal = Math.max(0, subtotal_cents - discountCents);
  const tax_cents = Math.round(discounted_subtotal * taxRate);
  const total_cents = discounted_subtotal + tax_cents;

  return {
    quantity,
    unit_price_cents: unitPriceCents,
    subtotal_cents,
    tax_cents,
    discount_cents: discountCents,
    total_cents,
  };
}

/**
 * Calculate order totals from line items
 * @param items - Array of line item calculations
 * @param shippingCents - Shipping cost in cents
 * @param orderDiscountCents - Order-level discount in cents
 * @returns OrderTotalsCalculation
 */
export function calculateOrderTotals(
  items: OrderItemCalculation[],
  shippingCents: number = 0,
  orderDiscountCents: number = 0
): OrderTotalsCalculation {
  const subtotal_cents = items.reduce((sum, item) => sum + item.subtotal_cents, 0);
  const tax_cents = items.reduce((sum, item) => sum + item.tax_cents, 0);
  const discount_cents = items.reduce((sum, item) => sum + item.discount_cents, 0) + orderDiscountCents;
  
  const total_cents = subtotal_cents - discount_cents + tax_cents + shippingCents;

  return {
    subtotal_cents,
    tax_cents,
    shipping_cents: shippingCents,
    discount_cents,
    total_cents: Math.max(0, total_cents), // Ensure non-negative
  };
}

/**
 * Calculate tax for a given amount
 * @param amountCents - Amount in cents
 * @param taxRate - Tax rate (e.g., 0.08 for 8%)
 * @returns Tax amount in cents
 */
export function calculateTax(amountCents: number, taxRate: number): number {
  return Math.round(amountCents * taxRate);
}

/**
 * Apply percentage discount
 * @param amountCents - Amount in cents
 * @param discountPercent - Discount percentage (e.g., 10 for 10%)
 * @returns Discount amount in cents
 */
export function calculatePercentageDiscount(amountCents: number, discountPercent: number): number {
  return Math.round(amountCents * (discountPercent / 100));
}

/**
 * Format cents to currency string
 * @param cents - Amount in cents
 * @param currency - Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Parse currency string to cents
 * @param currencyString - Currency string (e.g., "$10.99")
 * @returns Amount in cents
 */
export function parseCurrencyToCents(currencyString: string): number {
  const cleaned = currencyString.replace(/[^0-9.]/g, '');
  const amount = parseFloat(cleaned);
  return Math.round(amount * 100);
}
