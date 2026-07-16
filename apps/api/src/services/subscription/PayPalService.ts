/**
 * PayPal Service
 * 
 * Handles PayPal integration for subscription billing
 * Uses PayPal Orders API for one-time payments and Billing Agreements for recurring
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';

// PayPal API configuration
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

interface PayPalAccessToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface PayPalOrder {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED';
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  purchase_units: Array<{
    amount: {
      currency_code: string;
      value: string;
    };
    reference_id: string;
  }>;
}

interface PayPalBillingAgreement {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED';
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
}

interface PayPalProduct {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
}

interface PayPalPlan {
  id: string;
  product_id: string;
  name: string;
  status: string;
  billing_cycles: Array<{
    frequency: {
      interval_unit: string;
      interval_count: number;
    };
    tenure_type: string;
    pricing_scheme: {
      fixed_price: {
        currency_code: string;
        value: string;
      };
    };
  }>;
}

interface PayPalSubscription {
  id: string;
  status: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: {
      time: string;
      amount: { value: string; currency_code: string };
    };
  };
  links: Array<{ href: string; rel: string; method: string }>;
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    reference_id?: string;
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: {
          currency_code: string;
          value: string;
        };
      }>;
    };
  }>;
}

class PayPalService {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  /**
   * Get PayPal access token using OAuth2 client credentials
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('PayPal credentials not configured');
    }

    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('[PayPal] Failed to get access token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw new Error('Failed to authenticate with PayPal');
    }

    const data = await response.json() as PayPalAccessToken;
    this.accessToken = data.access_token;
    // Set expiry with 5 minute buffer
    this.tokenExpiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000);

    return this.accessToken;
  }

  /**
   * Make an authenticated request to PayPal API
   */
  private async apiRequest<T>(
    path: string, 
    method: string = 'GET', 
    body?: any
  ): Promise<T> {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${PAYPAL_API_BASE}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error(`[PayPal] API error ${path}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw new Error(`PayPal API error: ${response.status}`);
    }

    return response.json() as T;
  }

  /**
   * Create a PayPal order for subscription payment
   * Returns order ID and approval URL
   */
  async createOrder(
    tenantId: string,
    tier: string,
    amountCents: number,
    billingCycle: 'monthly' | 'annual'
  ): Promise<{ orderId: string; approvalUrl: string }> {
    const amount = (amountCents / 100).toFixed(2);
    const description = `VisibleShelf ${tier} tier - ${billingCycle} subscription`;

    const order: PayPalOrder = await this.apiRequest(
      '/v2/checkout/orders',
      'POST',
      {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `${tenantId}-${tier}-${billingCycle}`,
          description,
          amount: {
            currency_code: 'USD',
            value: amount,
          },
          custom_id: JSON.stringify({ tenantId, tier, billingCycle }),
        }],
        application_context: {
          return_url: `${process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/t/${tenantId}/settings/subscription?paypal=success`,
          cancel_url: `${process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/t/${tenantId}/settings/subscription?paypal=cancel`,
          brand_name: 'VisibleShelf',
          user_action: 'PAY_NOW',
        },
      }
    );

    const approvalLink = order.links.find(l => l.rel === 'approve');
    if (!approvalLink) {
      throw new Error('PayPal order created but no approval link found');
    }

    return {
      orderId: order.id,
      approvalUrl: approvalLink.href,
    };
  }

  /**
   * Capture a PayPal order after user approval
   * Returns capture details
   */
  async captureOrder(orderId: string): Promise<{
    success: boolean;
    captureId: string;
    amount: number;
    customId?: { tenantId: string; tier: string; billingCycle: string };
    payerEmail?: string;
    payerId?: string;
  }> {
    const result: PayPalCaptureResponse = await this.apiRequest(
      `/v2/checkout/orders/${orderId}/capture`,
      'POST'
    );

    const capture = result.purchase_units[0]?.payments?.captures?.[0];
    
    if (!capture || capture.status !== 'COMPLETED') {
      return {
        success: false,
        captureId: '',
        amount: 0,
      };
    }

    // Parse custom_id for metadata
    let customId;
    try {
      const refId = result.purchase_units[0]?.reference_id;
      if (refId) {
        customId = JSON.parse(refId);
      }
    } catch {
      // custom_id might be in different format
    }

    // Get payer information from the order
    const payer = (result as any).payer;
    
    return {
      success: true,
      captureId: capture.id,
      amount: Math.round(parseFloat(capture.amount.value) * 100),
      customId,
      payerEmail: payer?.email_address,
      payerId: payer?.payer_id,
    };
  }

  /**
   * Create a billing agreement token (for saving PayPal as payment method)
   * Uses Orders API with PAYPAL payment source for vaulting
   */
  async createBillingAgreementToken(
    tenantId: string,
    tenantName: string
  ): Promise<{ tokenId: string; approvalUrl: string }> {
    const baseUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000';
    
    // Create a simple order for PayPal approval
    const response = await this.apiRequest<{ 
      id: string; 
      links: Array<{ href: string; rel: string }> 
    }>(
      '/v2/checkout/orders',
      'POST',
      {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `billing-agreement-${tenantId}`,
          description: `Save PayPal for ${tenantName}`,
          amount: {
            currency_code: 'USD',
            value: '0.01', // $0.01 minimum amount for PayPal order
          },
        }],
        application_context: {
          return_url: `${baseUrl}/t/${tenantId}/settings/subscription?paypal-token=success`,
          cancel_url: `${baseUrl}/t/${tenantId}/settings/subscription?paypal-token=cancel`,
          brand_name: 'VisibleShelf',
          user_action: 'PAY_NOW',
        },
      }
    );

    const approvalLink = response.links.find(l => l.rel === 'approve');
    if (!approvalLink) {
      throw new Error('PayPal order created but no approval link found');
    }

    return {
      tokenId: response.id,
      approvalUrl: approvalLink.href,
    };
  }

  /**
   * Authorize an order and get the vaulted payment token
   * Used after user approves the billing agreement order
   */
  async authorizeOrder(orderId: string): Promise<{
    success: boolean;
    paymentToken?: string;
    payerEmail?: string;
    payerId?: string;
  }> {
    try {
      const response = await this.apiRequest<{
        id: string;
        status: string;
        payment_source?: {
          paypal?: {
            email_address?: string;
            account_id?: string;
            attributes?: {
              vault?: {
                id?: string;
              };
            };
          };
        };
        links?: Array<{ href: string; rel: string }>;
      }>(`/v2/checkout/orders/${orderId}/authorize`, 'POST');

      // Get the vaulted payment token from the response
      const paypalSource = response.payment_source?.paypal;
      const vaultId = paypalSource?.attributes?.vault?.id;

      return {
        success: response.status === 'COMPLETED' || response.status === 'AUTHORIZED',
        paymentToken: vaultId || undefined,
        payerEmail: paypalSource?.email_address,
        payerId: paypalSource?.account_id,
      };
    } catch (error) {
      logger.error('[PayPal] Failed to authorize order:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return { success: false };
    }
  }

  /**
   * Get a saved payment token details
   */
  async getPaymentToken(tokenId: string): Promise<{
    id: string;
    customer_id: string;
    payment_source: {
      paypal: {
        email_address: string;
        account_id: string;
      };
    };
  } | null> {
    try {
      return await this.apiRequest(`/v2/vault/payment-tokens/${tokenId}`);
    } catch (error) {
      logger.error('[PayPal] Failed to get payment token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }
  }

  /**
   * Get setup token details after user approval
   * This is used after PayPal redirects back with approval_token_id
   */
  async getSetupToken(tokenId: string): Promise<{
    id: string;
    customer: { id: string };
    payment_source?: {
      paypal?: {
        email_address?: string;
        account_id?: string;
      };
    };
    status: string;
  } | null> {
    try {
      // Setup tokens are at /v2/vault/setup-tokens/, not payment-tokens
      return await this.apiRequest(`/v2/vault/setup-tokens/${tokenId}`);
    } catch (error) {
      logger.error('[PayPal] Failed to get setup token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }
  }

  /**
   * Charge a saved PayPal payment token
   * Used for recurring subscription charges
   */
  async chargePaymentToken(
    tokenId: string,
    amountCents: number,
    description: string,
    metadata: Record<string, string>
  ): Promise<{
    success: boolean;
    transactionId: string;
    error?: string;
  }> {
    const amount = (amountCents / 100).toFixed(2);

    try {
      const result = await this.apiRequest<{
        id: string;
        status: string;
      }>(
        '/v2/vault/payment-tokens/charge',
        'POST',
        {
          payment_token_id: tokenId,
          amount: {
            currency_code: 'USD',
            value: amount,
          },
          description,
          custom_id: JSON.stringify(metadata),
        }
      );

      return {
        success: result.status === 'COMPLETED',
        transactionId: result.id,
      };
    } catch (error: any) {
      return {
        success: false,
        transactionId: '',
        error: error.message || 'PayPal charge failed',
      };
    }
  }

  /**
   * Delete a saved payment token
   */
  async deletePaymentToken(tokenId: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(
        `${PAYPAL_API_BASE}/v2/vault/payment-tokens/${tokenId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      return response.ok;
    } catch (error) {
      logger.error('[PayPal] Failed to delete payment token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return false;
    }
  }

  /**
   * Create a PayPal product for subscription
   * Products are required before creating billing plans
   */
  async createProduct(tier: string): Promise<string> {
    const productId = `visibleshelf-${tier}-subscription`;
    
    try {
      // Check if product already exists
      const existing = await this.apiRequest<PayPalProduct>(`/v1/catalogs/products/${productId}`);
      if (existing && existing.id) {
        return existing.id;
      }
    } catch {
      // Product doesn't exist, create it
    }

    const product = await this.apiRequest<PayPalProduct>(
      '/v1/catalogs/products',
      'POST',
      {
        id: productId,
        name: `VisibleShelf ${tier} Tier`,
        description: `VisibleShelf ${tier} tier subscription`,
        type: 'SERVICE',
        category: 'SOFTWARE',
        image_url: 'https://visibleshelf.com/logo.png',
        home_url: 'https://visibleshelf.com',
      }
    );

    return product.id;
  }

  /**
   * Create a PayPal billing plan for a tier
   * Plans define pricing and billing frequency
   */
  async createPlan(
    tier: string,
    amountCents: number,
    billingCycle: 'monthly' | 'annual'
  ): Promise<string> {
    const productId = await this.createProduct(tier);
    const cacheKey = `paypal_plan_${tier}_${billingCycle}`;
    const amount = (amountCents / 100).toFixed(2);
    const interval = billingCycle === 'monthly' ? 'MONTH' : 'YEAR';
    const intervalCount = 1;

    // Check if we have a cached plan ID in platform_payment_config metadata
    const config = await prisma.platform_payment_config.findFirst();
    const metadata = (config?.metadata as Record<string, any>) || {};
    
    if (metadata[cacheKey]) {
      // Verify the plan still exists in PayPal
      try {
        const existing = await this.apiRequest<PayPalPlan>(`/v1/billing/plans/${metadata[cacheKey]}`);
        if (existing && existing.id) {
          console.log(`[PayPal] Using cached plan: ${metadata[cacheKey]}`);
          return existing.id;
        }
      } catch {
        // Plan no longer exists, create new one
      }
    }

    // Create new plan - let PayPal generate the ID
    console.log(`[PayPal] Creating new plan for ${tier} ${billingCycle}...`);
    const plan = await this.apiRequest<PayPalPlan>(
      '/v1/billing/plans',
      'POST',
      {
        product_id: productId,
        name: `${tier} tier - ${billingCycle}`,
        description: `VisibleShelf ${tier} tier ${billingCycle} subscription`,
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: {
            interval_unit: interval,
            interval_count: intervalCount,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite cycles
          pricing_scheme: {
            fixed_price: {
              currency_code: 'USD',
              value: amount,
            },
          },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            currency_code: 'USD',
            value: '0',
          },
          setup_fee_failure_action: 'CONTINUE',
          payment_failure_threshold: 3,
        },
      }
    );

    // Cache the plan ID in metadata
    metadata[cacheKey] = plan.id;
    await prisma.platform_payment_config.upsert({
      where: { id: 'platform_main' },
      create: {
        id: 'platform_main',
        metadata: metadata,
      },
      update: {
        metadata: metadata,
      }
    });

    console.log(`[PayPal] Created plan: ${plan.id}`);
    return plan.id;
  }

  /**
   * Create a PayPal subscription for recurring billing
   * This is the main entry point for PayPal recurring subscriptions
   */
  async createSubscription(
    tenantId: string,
    tier: string,
    amountCents: number,
    billingCycle: 'monthly' | 'annual'
  ): Promise<{
    subscriptionId: string;
    approvalUrl: string;
  }> {
    const planId = await this.createPlan(tier, amountCents, billingCycle);
    const baseUrl = process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000';

    const subscription = await this.apiRequest<PayPalSubscription>(
      '/v1/billing/subscriptions',
      'POST',
      {
        plan_id: planId,
        custom_id: JSON.stringify({ tenantId, tier, billingCycle }),
        application_context: {
          brand_name: 'VisibleShelf',
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          payment_method: {
            payer_selected: 'PAYPAL',
            payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
          },
          return_url: `${baseUrl}/t/${tenantId}/settings/subscription?paypal=success`,
          cancel_url: `${baseUrl}/t/${tenantId}/settings/subscription?paypal=cancel`,
        },
      }
    );

    const approvalLink = subscription.links.find(l => l.rel === 'approve');
    if (!approvalLink) {
      throw new Error('PayPal subscription created but no approval link found');
    }

    return {
      subscriptionId: subscription.id,
      approvalUrl: approvalLink.href,
    };
  }

  /**
   * Get PayPal subscription details
   */
  async getSubscription(subscriptionId: string): Promise<PayPalSubscription | null> {
    try {
      return await this.apiRequest<PayPalSubscription>(`/v1/billing/subscriptions/${subscriptionId}`);
    } catch (error) {
      logger.error('[PayPal] Failed to get subscription:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }
  }

  /**
   * Cancel a PayPal subscription
   */
  async cancelSubscription(subscriptionId: string, reason: string): Promise<boolean> {
    try {
      await this.apiRequest(
        `/v1/billing/subscriptions/${subscriptionId}/cancel`,
        'POST',
        { reason }
      );
      return true;
    } catch (error) {
      logger.error('[PayPal] Failed to cancel subscription:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return false;
    }
  }

  /**
   * Suspend a PayPal subscription
   */
  async suspendSubscription(subscriptionId: string, reason: string): Promise<boolean> {
    try {
      await this.apiRequest(
        `/v1/billing/subscriptions/${subscriptionId}/suspend`,
        'POST',
        { reason }
      );
      return true;
    } catch (error) {
      logger.error('[PayPal] Failed to suspend subscription:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return false;
    }
  }

  /**
   * Reactivate a suspended PayPal subscription
   */
  async activateSubscription(subscriptionId: string, reason: string): Promise<boolean> {
    try {
      await this.apiRequest(
        `/v1/billing/subscriptions/${subscriptionId}/activate`,
        'POST',
        { reason }
      );
      return true;
    } catch (error) {
      logger.error('[PayPal] Failed to activate subscription:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return false;
    }
  }

  /**
   * Check if PayPal is configured
   */
  isConfigured(): boolean {
    return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  }
}

// Export singleton instance
export const payPalService = new PayPalService();
export default payPalService;
