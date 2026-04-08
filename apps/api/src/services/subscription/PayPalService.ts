/**
 * PayPal Service
 * 
 * Handles PayPal integration for subscription billing
 * Uses PayPal Orders API for one-time payments and Billing Agreements for recurring
 */

import { prisma } from '../../prisma';

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
      console.error('[PayPal] Failed to get access token:', error);
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
      console.error(`[PayPal] API error ${path}:`, error);
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
          return_url: `${process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/settings/subscription?paypal=success`,
          cancel_url: `${process.env.WEB_URL || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000'}/settings/subscription?paypal=cancel`,
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
          return_url: `${baseUrl}/settings/subscription?paypal-token=success`,
          cancel_url: `${baseUrl}/settings/subscription?paypal-token=cancel`,
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
      console.error('[PayPal] Failed to authorize order:', error);
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
      console.error('[PayPal] Failed to get payment token:', error);
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
      console.error('[PayPal] Failed to get setup token:', error);
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
      console.error('[PayPal] Failed to delete payment token:', error);
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
