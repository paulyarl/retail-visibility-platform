/**
 * Subscription Billing Service (Frontend)
 * 
 * API client for subscription billing operations
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { RequestType, ResponseType } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

export interface TierPricing {
  id: string;
  tier: string;
  displayName?: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  features: string[];
}

export interface PaymentMethod {
  id: string;
  gatewayType: 'stripe' | 'paypal' | 'manual';
  cardLast4?: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  paypalEmail?: string;
  paypalAccountId?: string;
  isDefault: boolean;
  createdAt: string;
}

export interface SubscriptionStatus {
  tier: string | null;
  status: 'trial' | 'active' | 'past_due' | 'canceled';
  billingCycleStart: string | null;
  billingCycleEnd: string | null;
  trialEndsAt: string | null;
  statusChangedAt: string | null;
  pricing: {
    monthly: number;
    annual: number;
  } | null;
  hasPaymentMethod: boolean;
  paymentMethod: {
    id: string;
    brand: string;
    last4: string;
  } | null;
}

export interface SubscriptionPreview {
  currentTier: string;
  newTier: string;
  currentPrice: number;
  newPrice: number;
  proratedAmount: number;
  effectiveDate: string;
  billingCycle: 'monthly' | 'annual';
}

export interface SubscribeResult {
  success: boolean;
  tier: string;
  status: string;
  activatedAt: string;
  invoiceId?: string;
  stripeSubscriptionId?: string;
  requiresAction?: boolean;
  clientSecret?: string;
  stripeConnect?: {
    needed: boolean;
    status: string | null;
    payoutsEnabled: boolean;
    onboardingUrl: string | null;
  };
  error?: string;
}

class SubscriptionBillingService extends TenantApiSingleton {

  protected defaultContext: AppContext = AppContext.TENANT;
  protected defaultIsolation: CacheIsolation = CacheIsolation.TENANT;
  
  private static instance: SubscriptionBillingService;
  
  private constructor() {
    super('subscription-billing');
  }
  
  public static get Instance(): SubscriptionBillingService {
    if (!SubscriptionBillingService.instance) {
      SubscriptionBillingService.instance = new SubscriptionBillingService();
    }
    return SubscriptionBillingService.instance;
  }

  /**
   * Required by TenantApiSingleton - invalidation contract
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    // Invalidate all subscription billing caches for tenant
    await this.invalidateAllTenantCaches(tenantId);
  }

  /**
   * Invalidate all tenant caches
   */
  private async invalidateAllTenantCaches(tenantId?: string): Promise<void> {
    // Implementation would invalidate cache entries
    // For now, this is a placeholder
  }

  /**
   * Required by TenantApiSingleton - cache patterns declaration
   */
  public getServiceCachePatterns(): string[] {
    return [
      'subscription-tiers',
      'subscription-payment-methods',
      'subscription-status',
      'subscription-preview',
      'subscription-invoices',
    ];
  }

  /**
   * Get all tier pricing
   */
  async getTierPricing(): Promise<TierPricing[]> {
    const response = await this.makeDefaultRequest<TierPricing[]>(
      '/api/subscription/tiers',
      { method: 'GET' },
      'subscription-tiers'
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch tier pricing');
    }
    
    // Handle both direct array and nested data array
    const data = response.data;
    // Check if data is nested (response.data.data) or direct (response.data)
    const actualData = Array.isArray(data) ? data : (data as any)?.data;
    if (Array.isArray(actualData)) {
      return actualData;
    }
    return [];
  }

  /**
   * Get payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const response = await this.makeDefaultRequest<PaymentMethod[]>(
      '/api/subscription/payment-methods',
      { method: 'GET' },
      'subscription-payment-methods'
    );
    
    if (!response.success) {
      const errorMsg = typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to fetch payment methods';
      throw new Error(errorMsg);
    }
    
    // Handle both direct array and nested data array
    const data = response.data;
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object' && Array.isArray((data as any).data)) {
      return (data as any).data;
    }
    return [];
  }

  /**
   * Add a payment method
   */
  async addPaymentMethod(data: {
    gatewayType: 'stripe';
    paymentMethodToken: string;
    cardLast4?: string;
    cardBrand?: string;
    expiryMonth?: number;
    expiryYear?: number;
  }): Promise<PaymentMethod> {
    const response = await this.makeDefaultRequest<PaymentMethod>(
      '/api/subscription/payment-methods',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      'subscription-add-payment-method'
    );
    
    if (!response.success) {
      const errorMsg = typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to add payment method';
      throw new Error(errorMsg);
    }
    
    return response.data!;
  }

  /**
   * Set default payment method
   */
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    const response = await this.makeDefaultRequest<void>(
      `/api/subscription/payment-methods/${paymentMethodId}/default`,
      { method: 'PUT' },
      'subscription-set-default-payment'
    );
    
    if (!response.success) {
      throw new Error('Failed to set default payment method');
    }
  }

  /**
   * Remove a payment method
   */
  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const response = await this.makeDefaultRequest<void>(
      `/api/subscription/payment-methods/${paymentMethodId}`,
      { method: 'DELETE' },
      'subscription-remove-payment-method'
    );
    
    if (!response.success) {
      throw new Error('Failed to remove payment method');
    }
  }

  /**
   * Get subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const response = await this.makeDefaultRequest<SubscriptionStatus>(
      '/api/subscription/status',
      { method: 'GET' },
      'subscription-status'
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch subscription status');
    }
    
    return response.data!;
  }

  /**
   * Preview subscription change
   */
  async previewSubscriptionChange(
    tier: string,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<SubscriptionPreview> {
    // Get current tenant ID from URL or context
    const urlParams = new URLSearchParams(window.location.search);
    const tenantIdFromUrl = urlParams.get('tenantId');
    const tenantIdFromContext = await this.getCurrentTenantId();
    const tenantId = tenantIdFromUrl || tenantIdFromContext;
    
    if (!tenantId) {
      throw new Error('No tenant context available. Please ensure you are on a tenant page.');
    }
    
    const response = await this.makeDefaultRequest<SubscriptionPreview>(
      `/api/subscription/preview?tier=${tier}&billingCycle=${billingCycle}&tenantId=${tenantId}`,
      { method: 'GET' },
      'subscription-preview'
    );
    
    if (!response.success) {
      const errorMsg = typeof response.error === 'string' ? response.error : response.error?.message || 'Failed to preview subscription';
      throw new Error(errorMsg);
    }
    
    const previewData = (response.data as any)?.data || response.data!;
    return previewData;
  }

  /**
   * Subscribe to a tier (instant activation)
   */
  async subscribe(
    tier: string,
    paymentMethodId?: string,
    billingCycle: 'monthly' | 'annual' = 'monthly'
  ): Promise<SubscribeResult> {
    const response = await this.makeDefaultRequest<SubscribeResult>(
      '/api/subscription/subscribe',
      {
        method: 'POST',
        body: JSON.stringify({ tier, paymentMethodId, billingCycle }),
      },
      'subscription-subscribe'
    );
    
    return response.data!;
  }

  /**
   * Confirm a subscription after 3D Secure payment succeeds
   */
  async confirm(paymentIntentId: string, stripeSubscriptionId: string, tier: string): Promise<{ success: boolean; tier: string; status: string; invoiceId?: string; error?: string }> {
    const response = await this.makeDefaultRequest<{ success: boolean; tier: string; status: string; invoiceId?: string }>(
      '/api/subscription/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ paymentIntentId, stripeSubscriptionId, tier }),
      },
      'subscription-confirm'
    );
    
    const data = (response as any).data || response;
    return data;
  }

  /**
   * Activate a PayPal subscription after approval
   */
  async activatePayPalSubscription(subscriptionId: string): Promise<{ success: boolean; tier?: string; error?: string }> {
    const response = await this.makeDefaultRequest<{ success: boolean; tier?: string; error?: string }>(
      '/api/subscription/paypal/activate',
      {
        method: 'POST',
        body: JSON.stringify({ subscriptionId }),
      },
      'subscription-paypal-activate'
    );
    
    const data = (response as any).data || response;
    return data;
  }

  /**
   * Get invoice history
   */
  async getInvoices(options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<Invoice[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    if (options?.status) params.set('status', options.status);
    
    const response = await this.makeDefaultRequest<Invoice[]>(
      `/api/subscription/invoices?${params.toString()}`,
      { method: 'GET' },
      'subscription-invoices'
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch invoices');
    }
    
    // Handle nested data structure
    const data = (response.data as any)?.data || response.data;
    return Array.isArray(data) ? data : [];
  }

  /**
   * Get a specific invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<Invoice> {
    const response = await this.makeDefaultRequest<Invoice>(
      `/api/subscription/invoices/${invoiceId}`,
      { method: 'GET' },
      `subscription-invoice-${invoiceId}`
    );
    
    if (!response.success) {
      throw new Error('Failed to fetch invoice');
    }
    
    return response.data!;
  }

  /**
   * Download invoice PDF
   * Uses the /api/subscription/invoices/:id/pdf endpoint
   * Now uses responseType option to control response parsing
   */
  async downloadInvoicePdf(invoiceId: string, tenantId: string): Promise<Blob> {
    if (!invoiceId || !tenantId) {
      throw new Error('Invoice ID and tenant ID are required');
    }

    // Use makeDefaultRequest with responseType BLOB to get proper blob response
    const result = await this.makeDefaultRequest<Blob>(
      `/api/subscription/invoices/${invoiceId}/pdf`,
      {
        method: 'GET',
        headers: {
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
      },
      `subscription-invoice-pdf-${invoiceId}`,
      0, // No caching for PDF downloads
      {
        responseType: ResponseType.BLOB, // Use BLOB response type
        requestType: RequestType.TENANT, // Explicitly set request type
        context: AppContext.TENANT,
        isolation: CacheIsolation.TENANT,
      }
    );
    
    if (!result.success) {
      throw new Error(`Failed to download invoice PDF: ${result.error}`);
    }
    
    return result.data!;
  }

  // ==================
  // PAYPAL METHODS
  // ==================

  /**
   * Check if PayPal is configured
   */
  async getPayPalConfig(): Promise<{ configured: boolean; mode: string }> {
    const response = await this.makeDefaultRequest<{ success: boolean; data: { configured: boolean; mode: string } }>(
      '/api/subscription/paypal/config',
      { method: 'GET' },
      'paypal-config'
    );
    
    // The response is nested: response.data.data.configured
    return response.data?.data || { configured: false, mode: 'sandbox' };
  }

  /**
   * Create a PayPal order for subscription
   */
  async createPayPalOrder(
    tier: string,
    billingCycle: 'monthly' | 'annual'
  ): Promise<{ orderId: string; approvalUrl: string } | { freeTier: boolean }> {
    const response = await this.makeDefaultRequest<{ orderId: string; approvalUrl: string } | { freeTier: boolean }>(
      '/api/subscription/paypal/create-order',
      {
        method: 'POST',
        body: JSON.stringify({ tier, billingCycle }),
      },
      'paypal-create-order'
    );
    
    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : 'Failed to create PayPal order');
    }
    
    const data = (response.data as any)?.data || response.data!;
    return data;
  }

  /**
   * Capture a PayPal order
   */
  async capturePayPalOrder(
    orderId: string,
    tier: string,
    billingCycle: 'monthly' | 'annual'
  ): Promise<{ tier: string; status: string; invoiceId: string }> {
    const response = await this.makeDefaultRequest<{ tier: string; status: string; invoiceId: string }>(
      '/api/subscription/paypal/capture-order',
      {
        method: 'POST',
        body: JSON.stringify({ orderId, tier, billingCycle }),
      },
      'paypal-capture-order'
    );
    
    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : 'Failed to capture PayPal order');
    }
    
    return response.data!;
  }

  /**
   * Create PayPal billing agreement for saving payment method
   */
  async createPayPalBillingAgreement(): Promise<{ tokenId: string; approvalUrl: string }> {
    const response = await this.makeDefaultRequest<{ tokenId: string; approvalUrl: string }>(
      '/api/subscription/paypal/create-billing-agreement',
      {
        method: 'POST',
      },
      'paypal-billing-agreement'
    );
    
    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : 'Failed to create billing agreement');
    }
    
    return response.data!;
  }

  /**
   * Save PayPal payment method after approval
   */
  async savePayPalPaymentMethod(tokenId: string): Promise<PaymentMethod> {
    const response = await this.makeDefaultRequest<PaymentMethod>(
      '/api/subscription/paypal/save-payment-method',
      {
        method: 'POST',
        body: JSON.stringify({ tokenId }),
      },
      'paypal-save-method'
    );
    
    if (!response.success) {
      throw new Error(typeof response.error === 'string' ? response.error : 'Failed to save PayPal method');
    }
    
    return response.data!;
  }
}

export interface Invoice {
  id: string;
  tier: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  amountCents: number;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  payments: InvoicePayment[];
}

export interface InvoicePayment {
  id: string;
  gatewayType: string;
  transactionId: string;
  amountCents: number;
  status: string;
  failureReason?: string | null;
  createdAt: string;
}

// Singleton export
export const subscriptionBillingService = SubscriptionBillingService.Instance;
