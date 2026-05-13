/**
 * Customer Payment Methods Service
 * 
 * Frontend service for customer saved payment method management.
 * Extends CustomerApiSingleton for automatic JWT token injection
 * and customer identity header handling.
 */

import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export type GatewayType = 'stripe' | 'paypal' | 'square' | 'clover';
export type PaymentMethodType = 'card' | 'paypal' | 'wallet' | 'bank_account';

export interface CustomerPaymentMethod {
  id: string;
  tenantId: string;
  gatewayType: GatewayType;
  type: PaymentMethodType;
  cardLast4: string | null;
  cardBrand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  cardFunding: string | null;
  walletType: string | null;
  isDefault: boolean;
  isActive: boolean;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AddPaymentMethodInput {
  tenantId: string;
  gatewayType: GatewayType;
  paymentMethodToken: string;
  type?: PaymentMethodType;
  cardLast4?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: string;
  paypalEmail?: string;
  paypalAccountId?: string;
  walletType?: string;
}

class CustomerPaymentMethodsService extends CustomerApiSingleton {
  private static instance: CustomerPaymentMethodsService;

  private constructor() {
    super('customer-payment-methods-service', { ttl: 60000 }); // 1 minute cache
  }

  getServiceCachePatterns(): string[] {
    return [
      'customer-payment-methods-list',
      'customer-payment-methods-get',
      'customer-payment-methods-default',
      'customer-payment-methods-add',
      'customer-payment-methods-set-default',
      'customer-payment-methods-remove',
    ];
  }

  async invalidateServiceCaches(customerId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): CustomerPaymentMethodsService {
    if (!CustomerPaymentMethodsService.instance) {
      CustomerPaymentMethodsService.instance = new CustomerPaymentMethodsService();
    }
    return CustomerPaymentMethodsService.instance;
  }

  /**
   * List all active payment methods for the current customer
   * Optionally filtered by tenantId
   */
  async listPaymentMethods(tenantId?: string): Promise<{
    success: boolean;
    paymentMethods?: CustomerPaymentMethod[];
    error?: string;
  }> {
    try {
      const params = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
      const result = await this.makeDefaultRequest<{
        success: boolean;
        paymentMethods: CustomerPaymentMethod[];
      }>(
        `/api/customer-payment-methods${params}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        'customer-payment-methods-list'
      );

      if (result.success && result.data?.success) {
        return { success: true, paymentMethods: result.data.paymentMethods };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] List error:', error);
      return { success: false, error: 'Failed to list payment methods' };
    }
  }

  /**
   * Get a single payment method by ID
   */
  async getPaymentMethod(paymentMethodId: string): Promise<{
    success: boolean;
    paymentMethod?: CustomerPaymentMethod;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        paymentMethod: CustomerPaymentMethod;
      }>(
        `/api/customer-payment-methods/${encodeURIComponent(paymentMethodId)}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        `customer-payment-methods-get-${paymentMethodId}`
      );

      if (result.success && result.data?.success) {
        return { success: true, paymentMethod: result.data.paymentMethod };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] Get error:', error);
      return { success: false, error: 'Failed to get payment method' };
    }
  }

  /**
   * Get the default payment method for a specific tenant
   */
  async getDefaultPaymentMethod(tenantId: string): Promise<{
    success: boolean;
    paymentMethod?: CustomerPaymentMethod | null;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        paymentMethod: CustomerPaymentMethod | null;
      }>(
        `/api/customer-payment-methods/default/${encodeURIComponent(tenantId)}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        `customer-payment-methods-default-${tenantId}`
      );

      if (result.success && result.data?.success) {
        return { success: true, paymentMethod: result.data.paymentMethod };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] Get default error:', error);
      return { success: false, error: 'Failed to get default payment method' };
    }
  }

  /**
   * Add a new payment method
   */
  async addPaymentMethod(input: AddPaymentMethodInput): Promise<{
    success: boolean;
    paymentMethod?: CustomerPaymentMethod;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        paymentMethod: CustomerPaymentMethod;
      }>(
        '/api/customer-payment-methods',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(input),
        },
        'customer-payment-methods-add'
      );

      if (result.success && result.data?.success) {
        await this.invalidateServiceCaches();
        return { success: true, paymentMethod: result.data.paymentMethod };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] Add error:', error);
      return { success: false, error: 'Failed to add payment method' };
    }
  }

  /**
   * Set a payment method as default for its tenant scope
   */
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean }>(
        `/api/customer-payment-methods/${encodeURIComponent(paymentMethodId)}/default`,
        {
          method: 'PUT',
          credentials: 'include',
        },
        'customer-payment-methods-set-default'
      );

      if (result.success && result.data?.success) {
        await this.invalidateServiceCaches();
        return { success: true };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] Set default error:', error);
      return { success: false, error: 'Failed to set default payment method' };
    }
  }

  /**
   * Remove a payment method (soft-delete)
   */
  async removePaymentMethod(paymentMethodId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean }>(
        `/api/customer-payment-methods/${encodeURIComponent(paymentMethodId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
        'customer-payment-methods-remove'
      );

      if (result.success && result.data?.success) {
        await this.invalidateServiceCaches();
        return { success: true };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] Remove error:', error);
      return { success: false, error: 'Failed to remove payment method' };
    }
  }

  /**
   * Create a Stripe SetupIntent for PCI-compliant card saving.
   * Returns a client_secret for use with stripe.confirmSetup().
   * 
   * Flow:
   * 1. Call this → get clientSecret
   * 2. Use stripe.confirmSetup({ clientSecret, payment_method: { card: cardElement } })
   * 3. On success, call addPaymentMethod() with the resulting payment method ID
   */
  async createSetupIntent(tenantId: string): Promise<{
    success: boolean;
    clientSecret?: string;
    stripeCustomerId?: string;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        clientSecret: string;
        stripeCustomerId: string;
      }>(
        '/api/customer-payment-methods/setup-intent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tenantId }),
        },
        'customer-payment-methods-setup-intent'
      );

      if (result.success && result.data?.success) {
        return {
          success: true,
          clientSecret: result.data.clientSecret,
          stripeCustomerId: result.data.stripeCustomerId,
        };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] SetupIntent error:', error);
      return { success: false, error: 'Failed to create setup intent' };
    }
  }

  /**
   * Get saved payment method tokens for checkout selection.
   * Returns lightweight data for the Stripe PaymentIntent creation.
   */
  async getCheckoutPaymentMethods(tenantId: string): Promise<{
    success: boolean;
    paymentMethods?: Array<{
      id: string;
      token: string;
      isDefault: boolean;
      displayInfo: string;
    }>;
    stripeCustomerId?: string | null;
    defaultPaymentMethodToken?: string | null;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        paymentMethods: Array<{
          id: string;
          token: string;
          isDefault: boolean;
          displayInfo: string;
        }>;
        stripeCustomerId: string | null;
        defaultPaymentMethodToken: string | null;
      }>(
        `/api/customer-payment-methods/checkout/${encodeURIComponent(tenantId)}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        `customer-payment-methods-checkout-${tenantId}`
      );

      if (result.success && result.data?.success) {
        return {
          success: true,
          paymentMethods: result.data.paymentMethods,
          stripeCustomerId: result.data.stripeCustomerId,
          defaultPaymentMethodToken: result.data.defaultPaymentMethodToken,
        };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] Checkout info error:', error);
      return { success: false, error: 'Failed to get checkout payment info' };
    }
  }

  /**
   * Get payment methods that are expired or expiring soon.
   */
  async getExpiringPaymentMethods(monthsAhead: number = 2): Promise<{
    success: boolean;
    expiringMethods?: CustomerPaymentMethod[];
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        expiringMethods: CustomerPaymentMethod[];
      }>(
        `/api/customer-payment-methods/expiring?monthsAhead=${monthsAhead}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        'customer-payment-methods-expiring'
      );

      if (result.success && result.data?.success) {
        return { success: true, expiringMethods: result.data.expiringMethods };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] Expiring check error:', error);
      return { success: false, error: 'Failed to check expiring payment methods' };
    }
  }

  /**
   * Create a PayPal billing agreement for saving PayPal as a customer payment method.
   * Returns an approval URL for the customer to authorize on PayPal.
   * 
   * Flow:
   * 1. Call this → get approvalUrl
   * 2. Redirect customer to approvalUrl
   * 3. On return (with paypal=success&token=xxx), call savePayPalPaymentMethod()
   */
  async createPayPalBillingAgreement(tenantId: string): Promise<{
    success: boolean;
    approvalUrl?: string;
    tokenId?: string;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        approvalUrl: string;
        tokenId: string;
      }>(
        '/api/customer-payment-methods/paypal/create-billing-agreement',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tenantId }),
        },
        'customer-payment-methods-paypal-agreement'
      );

      if (result.success && result.data?.success) {
        return {
          success: true,
          approvalUrl: result.data.approvalUrl,
          tokenId: result.data.tokenId,
        };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] PayPal billing agreement error:', error);
      return { success: false, error: 'Failed to create PayPal billing agreement' };
    }
  }

  /**
   * Save a PayPal payment method after customer approval.
   * Called after PayPal redirects back with a token from the approval flow.
   */
  async savePayPalPaymentMethod(tenantId: string, tokenId: string): Promise<{
    success: boolean;
    paymentMethod?: CustomerPaymentMethod;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        paymentMethod: CustomerPaymentMethod;
      }>(
        '/api/customer-payment-methods/paypal/save-payment-method',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ tenantId, tokenId }),
        },
        'customer-payment-methods-paypal-save'
      );

      if (result.success && result.data?.success) {
        return {
          success: true,
          paymentMethod: result.data.paymentMethod,
        };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      console.error('[CustomerPaymentMethods] PayPal save error:', error);
      return { success: false, error: 'Failed to save PayPal payment method' };
    }
  }
}

const customerPaymentMethodsService = CustomerPaymentMethodsService.getInstance();
export default customerPaymentMethodsService;
