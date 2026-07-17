/**
 * PayPal Commerce Platform Service
 * 
 * Handles PayPal Commerce Platform operations for automatic fee splitting:
 * - Merchant onboarding via PayPal Partner
 * - Creating orders with platform fees
 * - Capturing payments with automatic splits
 * - Managing merchant connections
 * 
 * PayPal Commerce Platform allows partners to collect a fee on each transaction
 * similar to Stripe Connect's application_fee_amount.
 */

import { prisma } from '../../prisma';

export interface PayPalOnboardingResult {
  success: boolean;
  actionUrl?: string;
  merchantId?: string;
  error?: string;
}

export interface PayPalOrderResult {
  success: boolean;
  orderId?: string;
  approvalUrl?: string;
  platformFeeCents?: number;
  error?: string;
}

export interface PayPalCaptureResult {
  success: boolean;
  captureId?: string;
  platformFeeCents?: number;
  netToMerchantCents?: number;
  error?: string;
}

export class PayPalConnectService {
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private partnerId: string | null = null;
  private baseUrl: string = 'https://api-m.paypal.com'; // Live: https://api-m.paypal.com, Sandbox: https://api-m.sandbox.paypal.com
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  /**
   * Initialize PayPal client from platform config
   */
  private async initialize(): Promise<boolean> {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    if (!config?.stripe_connect_client_id || !config?.stripe_connect_secret_encrypted) {
      // Using stripe fields temporarily - should have dedicated PayPal fields
      return false;
    }

    // TODO: Decrypt credentials
    this.clientId = config.stripe_connect_client_id;
    this.clientSecret = config.stripe_connect_secret_encrypted;
    this.partnerId = config.stripe_platform_account_id || null;

    // Set sandbox URL for development
    if (process.env.NODE_ENV !== 'production') {
      this.baseUrl = 'https://api-m.sandbox.paypal.com';
    }

    return true;
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const initialized = await this.initialize();
    if (!initialized || !this.clientId || !this.clientSecret) {
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en_US',
          'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      const data = await response.json() as { access_token?: string; expires_in?: number };

      if (!response.ok || !data.access_token) {
        console.error('[PayPalConnect] Failed to get access token:', data);
        return null;
      }

      this.accessToken = data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + ((data.expires_in || 3600) - 60) * 1000);

      return this.accessToken;
    } catch (error) {
      console.error('[PayPalConnect] Error getting access token:', error);
      return null;
    }
  }

  /**
   * Check if PayPal Commerce Platform is configured
   */
  async isConfigured(): Promise<boolean> {
    const initialized = await this.initialize();
    return initialized && !!this.clientId && !!this.clientSecret;
  }

  /**
   * Get merchant's PayPal merchant ID
   */
  async getMerchantPayPalId(tenantId: string): Promise<string | null> {
    const connection = await prisma.merchant_paypal_connections?.findUnique({
      where: { tenant_id: tenantId },
    });

    return connection?.paypal_merchant_id ?? null;
  }

  /**
   * Create partner referral for merchant onboarding
   * This generates a URL where the merchant can connect their PayPal account
   */
  async createOnboardingLink(
    tenantId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<PayPalOnboardingResult> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return {
        success: false,
        error: 'PayPal not configured',
      };
    }

    try {
      // Create or get merchant connection record
      let connection = await prisma.merchant_paypal_connections?.findUnique({
        where: { tenant_id: tenantId },
      });

      if (!connection) {
        // Create new connection record
        const id = `mpc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        connection = await prisma.merchant_paypal_connections?.create({
          data: {
            id,
            tenant_id: tenantId,
            onboarding_status: 'pending',
          },
        });
      }

      // Get tenant info for referral
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });

      // Create partner referral
      const response = await fetch(`${this.baseUrl}/v2/customer/partner-referrals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          tracking_id: connection?.id || tenantId,
          operations: [
            {
              operation: 'API_INTEGRATION',
              api_integration_preference: {
                rest_api_integration: {
                  integration_method: 'PAYPAL',
                  integration_type: 'THIRD_PARTY',
                  third_party_details: {
                    features: ['PAYMENT', 'REFUND', 'PARTNER_FEE'],
                  },
                },
              },
            },
          ],
          products: ['EXPRESS_CHECKOUT'],
          legal_consents: [
            {
              type: 'SHARE_DATA_CONSENT',
              granted: true,
            },
          ],
          partner_config_override: {
            return_url: returnUrl,
            return_url_description: 'Return to platform after PayPal onboarding',
          },
        }),
      });

      const data = await response.json() as {
        links?: Array<{ rel: string; href: string }>;
        id?: string;
      };

      if (!response.ok) {
        console.error('[PayPalConnect] Failed to create referral:', data);
        return {
          success: false,
          error: 'Failed to create onboarding link',
        };
      }

      // Find the action URL
      const actionLink = data.links?.find(l => l.rel === 'action_url');
      if (!actionLink) {
        return {
          success: false,
          error: 'No action URL in response',
        };
      }

      // Update connection with referral ID
      await prisma.merchant_paypal_connections?.update({
        where: { id: connection?.id },
        data: {
          onboarding_status: 'in_progress',
          onboarding_started_at: new Date(),
          referral_id: data.id,
        },
      });

      return {
        success: true,
        actionUrl: actionLink.href,
        merchantId: data.id,
      };
    } catch (error: any) {
      console.error('[PayPalConnect] Error creating onboarding link:', error);
      return {
        success: false,
        error: error.message || 'Failed to create onboarding link',
      };
    }
  }

  /**
   * Handle onboarding callback from PayPal
   * Called when merchant completes PayPal onboarding
   */
  async handleOnboardingCallback(
    tenantId: string,
    merchantId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        return { success: false, error: 'PayPal not configured' };
      }

      // Get merchant status from PayPal
      const response = await fetch(
        `${this.baseUrl}/v1/customer/partners/${this.partnerId}/merchant-accounts/${merchantId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json() as {
        payments_receivable?: boolean;
        primary_email_confirmed?: boolean;
        products?: Array<{ name: string; status: string }>;
      };

      const isComplete = data.payments_receivable && data.primary_email_confirmed;

      // Update connection
      await prisma.merchant_paypal_connections?.update({
        where: { tenant_id: tenantId },
        data: {
          paypal_merchant_id: merchantId,
          onboarding_status: isComplete ? 'completed' : 'in_progress',
          onboarding_completed_at: isComplete ? new Date() : null,
          paypal_account_status: isComplete ? 'enabled' : 'pending',
          payments_enabled: data.payments_receivable || false,
        },
      });

      return { success: true };
    } catch (error: any) {
      console.error('[PayPalConnect] Error handling callback:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create PayPal order with platform fee
   */
  async createOrderWithFee(
    tenantId: string,
    amountCents: number,
    currency: string,
    returnUrl: string,
    cancelUrl: string,
    metadata: Record<string, any>
  ): Promise<PayPalOrderResult> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return { success: false, error: 'PayPal not configured' };
    }

    const merchantId = await this.getMerchantPayPalId(tenantId);
    if (!merchantId) {
      return { success: false, error: 'Merchant not connected to PayPal' };
    }

    // Calculate platform fee
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    const feePercent = config?.default_platform_fee_percent || 2.0;
    const platformFeeCents = Math.round((amountCents * feePercent) / 100);

    const amount = (amountCents / 100).toFixed(2);
    const platformFee = (platformFeeCents / 100).toFixed(2);

    try {
      const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...(this.partnerId ? { 'PayPal-Partner-Attribution-Id': this.partnerId } : {}),
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: currency.toUpperCase(),
                value: amount,
              },
              payee: {
                merchant_id: merchantId,
              },
              payment_instruction: {
                platform_fees: [
                  {
                    amount: {
                      currency_code: currency.toUpperCase(),
                      value: platformFee,
                    },
                    payee: {
                      email: 'platform@example.com', // Platform's PayPal email
                    },
                  },
                ],
              },
              reference_id: metadata.order_id || tenantId,
              description: metadata.description || 'Order payment',
            },
          ],
          application_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            brand_name: 'VisibleShelf',
            user_action: 'PAY_NOW',
          },
        }),
      });

      const data = await response.json() as {
        id?: string;
        links?: Array<{ rel: string; href: string }>;
        message?: string;
      };

      if (!response.ok) {
        console.error('[PayPalConnect] Failed to create order:', data);
        return {
          success: false,
          error: data.message || 'Failed to create PayPal order',
        };
      }

      const approvalLink = data.links?.find(l => l.rel === 'approve');

      return {
        success: true,
        orderId: data.id,
        approvalUrl: approvalLink?.href,
        platformFeeCents,
      };
    } catch (error: any) {
      console.error('[PayPalConnect] Error creating order:', error);
      return {
        success: false,
        error: error.message || 'Failed to create order',
      };
    }
  }

  /**
   * Capture PayPal order with platform fee
   */
  async captureOrder(
    orderId: string,
    tenantId: string
  ): Promise<PayPalCaptureResult> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return { success: false, error: 'PayPal not configured' };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            ...(this.partnerId ? { 'PayPal-Partner-Attribution-Id': this.partnerId } : {}),
          },
        }
      );

      const data = await response.json() as {
        id?: string;
        purchase_units?: Array<{
          payments?: {
            captures?: Array<{
              id: string;
              amount: { value: string; currency_code: string };
              seller_receivable_breakdown?: {
                paypal_fee?: { value: string };
                platform_fees?: Array<{ amount: { value: string } }>;
                net_amount?: { value: string };
              };
            }>;
          };
        }>;
        message?: string;
      };

      if (!response.ok) {
        console.error('[PayPalConnect] Failed to capture order:', data);
        return {
          success: false,
          error: data.message || 'Failed to capture payment',
        };
      }

      const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
      const breakdown = capture?.seller_receivable_breakdown;
      const platformFee = breakdown?.platform_fees?.[0]?.amount;
      const netAmount = breakdown?.net_amount;

      // Record platform revenue
      if (platformFee) {
        const platformFeeCents = Math.round(parseFloat(platformFee.value) * 100);
        const netCents = netAmount ? Math.round(parseFloat(netAmount.value) * 100) : 0;

        await prisma.platform_revenue_transactions.create({
          data: {
            id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            tenant_id: tenantId,
            transaction_type: 'transaction_fee',
            gross_amount_cents: Math.round(parseFloat(capture?.amount?.value || '0') * 100),
            platform_fee_cents: platformFeeCents,
            gateway_fee_cents: breakdown?.paypal_fee
              ? Math.round(parseFloat(breakdown.paypal_fee.value) * 100)
              : 0,
            net_amount_cents: netCents,
            stripe_transaction_id: capture?.id,
            status: 'completed',
            processed_at: new Date(),
          },
        });

        return {
          success: true,
          captureId: capture?.id,
          platformFeeCents,
          netToMerchantCents: netCents,
        };
      }

      return {
        success: true,
        captureId: capture?.id,
      };
    } catch (error: any) {
      console.error('[PayPalConnect] Error capturing order:', error);
      return {
        success: false,
        error: error.message || 'Failed to capture payment',
      };
    }
  }

  /**
   * Refresh merchant status from PayPal
   */
  async refreshMerchantStatus(tenantId: string): Promise<{
    success: boolean;
    status?: string;
    error?: string;
  }> {
    const connection = await prisma.merchant_paypal_connections?.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection?.paypal_merchant_id) {
      return { success: false, error: 'Merchant not connected' };
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return { success: false, error: 'PayPal not configured' };
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/v1/customer/partners/${this.partnerId}/merchant-accounts/${connection.paypal_merchant_id}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json() as {
        payments_receivable?: boolean;
        primary_email_confirmed?: boolean;
      };

      const isEnabled = data.payments_receivable && data.primary_email_confirmed;

      await prisma.merchant_paypal_connections?.update({
        where: { tenant_id: tenantId },
        data: {
          paypal_account_status: isEnabled ? 'enabled' : 'restricted',
          payments_enabled: data.payments_receivable || false,
        },
      });

      return {
        success: true,
        status: isEnabled ? 'enabled' : 'restricted',
      };
    } catch (error: any) {
      console.error('[PayPalConnect] Error refreshing status:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const paypalConnectService = new PayPalConnectService();
export default paypalConnectService;
