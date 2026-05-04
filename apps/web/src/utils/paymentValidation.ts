/**
 * Platform-wide payment validation utilities
 */

export interface MinimumPaymentAmount {
  amount: number; // in cents
  currency: string;
  displayAmount: string; // formatted for display
}

export interface PaymentValidationResult {
  isValid: boolean;
  minimumAmount?: MinimumPaymentAmount;
  currentAmount: number;
  message?: string;
}

/**
 * Validates if the payment amount meets the platform minimum requirements
 */
export function validateMinimumPaymentAmount(
  amount: number,
  minimumPaymentAmount?: MinimumPaymentAmount | null
): PaymentValidationResult {
  // If no minimum is set, allow any amount
  if (!minimumPaymentAmount) {
    return {
      isValid: true,
      currentAmount: amount,
    };
  }

  const isValid = amount >= minimumPaymentAmount.amount;
  
  return {
    isValid,
    minimumAmount: minimumPaymentAmount,
    currentAmount: amount,
    message: isValid 
      ? undefined 
      : `Minimum payment amount is ${minimumPaymentAmount.displayAmount}. Current amount: $${(amount / 100).toFixed(2)}. Please add more items to your cart or choose a different payment method.`
  };
}

/**
 * Get the minimum payment amount for a specific currency
 */
export function getMinimumPaymentAmount(
  minimumPaymentAmount?: MinimumPaymentAmount | null,
  currency: string = 'USD'
): MinimumPaymentAmount | null {
  if (!minimumPaymentAmount || minimumPaymentAmount.currency !== currency) {
    return null;
  }
  
  return minimumPaymentAmount;
}

/**
 * Format amount for display
 */
export function formatDisplayAmount(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount / 100);
}
