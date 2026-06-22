/**
 * Stripe Connect Service
 * 
 * Handles Stripe Connect operations for platform revenue collection:
 * - Creating charges with application fees
 * - Transferring funds to connected accounts
 * - Managing merchant onboarding
 * - Recording platform revenue transactions
 */

import Stripe from 'stripe';
import { prisma } from '../../prisma';

export interface FeeCalculation {
  platformFeeCents: number;
  platformFeePercent: number;
  gatewayFeeCents: number;
  netToMerchantCents: number;
}

export interface ChargeWithFeeResult {
  success: boolean;
  chargeId?: string;
  transferId?: string;
  platformFeeCents?: number;
  netToMerchantCents?: number;
  error?: string;
}

export class StripeConnectService {
  private stripe: Stripe | null = null;

  /**
   * Initialize Stripe client from platform config
   */
  private async getStripeClient(): Promise<Stripe | null> {
    if (this.stripe) return this.stripe;

    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    if (!config?.stripe_platform_secret_key_encrypted || !config.is_active) {
      return null;
    }

    // TODO: Decrypt the secret key
    this.stripe = new Stripe(config.stripe_platform_secret_key_encrypted, {
      apiVersion: '2026-05-27.dahlia',
    });

    return this.stripe;
  }

  /**
   * Check if platform revenue collection is active
   */
  async isRevenueCollectionActive(): Promise<boolean> {
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });
    return config?.is_active ?? false;
  }

  /**
   * Get merchant's Stripe Connect account ID
   */
  async getMerchantStripeAccount(tenantId: string): Promise<string | null> {
    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });
    // console.log(`[StripeConnectService] Merchant Stripe account for tenant ${tenantId}:`, connection?.stripe_account_id)

    return connection?.stripe_account_id ?? null;
  }

  /**
   * Calculate platform fee for a transaction
   */
  async calculatePlatformFee(
    tenantId: string,
    amountCents: number
  ): Promise<FeeCalculation> {
    // Check if merchant has fee override
    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    // Get platform config for default fee
    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    // Determine fee percentage
    let feePercent = config?.default_platform_fee_percent ?? 2.0;
    if (connection?.platform_fee_override_percent !== null && connection?.platform_fee_override_percent !== undefined) {
      feePercent = connection.platform_fee_override_percent;
    }

    // Check tenant-level fee override
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        platform_fee_percentage: true,
        platform_fee_waived: true,
      },
    });

    if (tenant?.platform_fee_waived) {
      return {
        platformFeeCents: 0,
        platformFeePercent: 0,
        gatewayFeeCents: 0,
        netToMerchantCents: amountCents,
      };
    }

    if (tenant?.platform_fee_percentage !== null && tenant?.platform_fee_percentage !== undefined) {
      feePercent = Number(tenant.platform_fee_percentage);
    }

    // Calculate fees (Stripe charges ~2.9% + 30¢)
    const platformFeeCents = Math.round((amountCents * feePercent) / 100);
    const gatewayFeeCents = Math.round(amountCents * 0.029 + 30); // Approximate Stripe fee
    const netToMerchantCents = amountCents - platformFeeCents - gatewayFeeCents;

    return {
      platformFeeCents,
      platformFeePercent: feePercent,
      gatewayFeeCents,
      netToMerchantCents,
    };
  }

  /**
   * Create a charge with application fee (for Stripe Connect)
   * This charges the customer and automatically splits the fee
   */
  async createChargeWithFee(
    tenantId: string,
    amountCents: number,
    currency: string,
    paymentMethodId: string,
    metadata: Record<string, any>
  ): Promise<ChargeWithFeeResult> {
    try {
      const stripe = await this.getStripeClient();
      if (!stripe) {
        return {
          success: false,
          error: 'Stripe Connect not configured',
        };
      }

      const merchantAccountId = await this.getMerchantStripeAccount(tenantId);
      if (!merchantAccountId) {
        // No Stripe Connect account - process without fee splitting
        return {
          success: false,
          error: 'Merchant not connected to Stripe Connect',
        };
      }

      const fees = await this.calculatePlatformFee(tenantId, amountCents);

      // Create charge with application fee
      const charge = await stripe.charges.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        source: paymentMethodId,
        application_fee_amount: fees.platformFeeCents,
        transfer_data: {
          destination: merchantAccountId,
        },
        metadata: {
          tenant_id: tenantId,
          ...metadata,
        },
      });

      // Record platform revenue transaction
      await this.recordRevenueTransaction({
        tenantId,
        orderId: metadata.order_id,
        paymentId: metadata.payment_id,
        transactionType: 'transaction_fee',
        grossAmountCents: amountCents,
        platformFeeCents: fees.platformFeeCents,
        gatewayFeeCents: fees.gatewayFeeCents,
        netAmountCents: fees.netToMerchantCents,
        stripeTransactionId: charge.id,
        stripeTransferId: typeof charge.transfer_data?.destination === 'string' 
          ? charge.transfer_data.destination 
          : charge.transfer_data?.destination?.id,
      });

      return {
        success: true,
        chargeId: charge.id,
        platformFeeCents: fees.platformFeeCents,
        netToMerchantCents: fees.netToMerchantCents,
      };
    } catch (error: any) {
      // console.error('[StripeConnect] Charge error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create charge',
      };
    }
  }

  /**
   * Create a payment intent with application fee
   * For use with Payment Element on the frontend
   */
  async createPaymentIntentWithFee(
    tenantId: string,
    amountCents: number,
    currency: string,
    metadata: Record<string, any>
  ): Promise<{
    success: boolean;
    clientSecret?: string;
    paymentIntentId?: string;
    platformFeeCents?: number;
    error?: string;
  }> {
    try {
      const stripe = await this.getStripeClient();
      if (!stripe) {
        return {
          success: false,
          error: 'Stripe Connect not configured',
        };
      }

      const merchantAccountId = await this.getMerchantStripeAccount(tenantId);
      if (!merchantAccountId) {
        return {
          success: false,
          error: 'Merchant not connected to Stripe Connect',
        };
      }

      const fees = await this.calculatePlatformFee(tenantId, amountCents);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        application_fee_amount: fees.platformFeeCents,
        transfer_data: {
          destination: merchantAccountId,
        },
        metadata: {
          tenant_id: tenantId,
          ...metadata,
        },
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret ?? undefined,
        paymentIntentId: paymentIntent.id,
        platformFeeCents: fees.platformFeeCents,
      };
    } catch (error: any) {
      // console.error('[StripeConnect] PaymentIntent error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create payment intent',
      };
    }
  }

  /**
   * Transfer funds to a connected account manually
   * Used for batch payouts or corrections
   */
  async transferToMerchant(
    tenantId: string,
    amountCents: number,
    metadata: Record<string, any>
  ): Promise<{
    success: boolean;
    transferId?: string;
    error?: string;
  }> {
    try {
      const stripe = await this.getStripeClient();
      if (!stripe) {
        return {
          success: false,
          error: 'Stripe Connect not configured',
        };
      }

      const merchantAccountId = await this.getMerchantStripeAccount(tenantId);
      if (!merchantAccountId) {
        return {
          success: false,
          error: 'Merchant not connected to Stripe Connect',
        };
      }

      const transfer = await stripe.transfers.create({
        amount: amountCents,
        currency: 'usd',
        destination: merchantAccountId,
        metadata: {
          tenant_id: tenantId,
          ...metadata,
        },
      });

      return {
        success: true,
        transferId: transfer.id,
      };
    } catch (error: any) {
      // console.error('[StripeConnect] Transfer error:', error);
      return {
        success: false,
        error: error.message || 'Failed to transfer funds',
      };
    }
  }

  /**
   * Record a platform revenue transaction
   */
  async recordRevenueTransaction(params: {
    tenantId: string;
    orderId?: string;
    paymentId?: string;
    transactionType: 'transaction_fee' | 'deposit_forfeit' | 'subscription' | 'payout';
    grossAmountCents: number;
    platformFeeCents: number;
    gatewayFeeCents: number;
    netAmountCents: number;
    stripeTransactionId?: string;
    stripeTransferId?: string;
    stripePayoutId?: string;
  }): Promise<string> {
    const transaction = await prisma.platform_revenue_transactions.create({
      data: {
        id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenant_id: params.tenantId,
        order_id: params.orderId,
        payment_id: params.paymentId,
        transaction_type: params.transactionType,
        gross_amount_cents: params.grossAmountCents,
        platform_fee_cents: params.platformFeeCents,
        gateway_fee_cents: params.gatewayFeeCents,
        net_amount_cents: params.netAmountCents,
        stripe_transaction_id: params.stripeTransactionId,
        stripe_transfer_id: params.stripeTransferId,
        stripe_payout_id: params.stripePayoutId,
        status: 'completed',
        processed_at: new Date(),
      },
    });

    return transaction.id;
  }

  /**
   * Process deposit forfeiture with fee split
   */
  async processDepositForfeit(
    tenantId: string,
    orderId: string,
    depositAmountCents: number
  ): Promise<{
    success: boolean;
    platformFeeCents?: number;
    retailerAmountCents?: number;
    error?: string;
  }> {
    try {
      const config = await prisma.platform_payment_config.findUnique({
        where: { id: 'platform_main' },
      });

      const platformFeePercent = config?.deposit_forfeit_fee_percent ?? 20.0;
      const platformFeeCents = Math.round((depositAmountCents * platformFeePercent) / 100);
      const retailerAmountCents = depositAmountCents - platformFeeCents;

      // Record the forfeiture transaction
      await this.recordRevenueTransaction({
        tenantId,
        orderId,
        transactionType: 'deposit_forfeit',
        grossAmountCents: depositAmountCents,
        platformFeeCents,
        gatewayFeeCents: 0,
        netAmountCents: retailerAmountCents,
      });

      return {
        success: true,
        platformFeeCents,
        retailerAmountCents,
      };
    } catch (error: any) {
      // console.error('[StripeConnect] Forfeit error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process forfeiture',
      };
    }
  }

  /**
   * Reverse platform fee for refund or dispute
   * Creates a negative revenue transaction to offset the original fee
   */
  async reversePlatformFee(
    originalTransactionId: string,
    reason: 'refund' | 'dispute',
    refundAmountCents?: number
  ): Promise<{
    success: boolean;
    reversedFeeCents?: number;
    error?: string;
  }> {
    try {
      // Find original transaction
      const original = await prisma.platform_revenue_transactions.findFirst({
        where: {
          OR: [
            { stripe_transaction_id: originalTransactionId },
            { id: originalTransactionId },
          ],
        },
      });

      if (!original) {
        return { success: false, error: 'Original transaction not found' };
      }

      // Calculate reversed fee (proportional to refund amount if specified)
      let reversedFeeCents = original.platform_fee_cents || 0;
      if (refundAmountCents && original.gross_amount_cents) {
        reversedFeeCents = Math.round(
          (refundAmountCents / original.gross_amount_cents) * (original.platform_fee_cents || 0)
        );
      }

      // Create reversal transaction
      await prisma.platform_revenue_transactions.create({
        data: {
          id: `rev_rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: original.tenant_id,
          order_id: original.order_id,
          payment_id: original.payment_id,
          transaction_type: 'transaction_fee',
          gross_amount_cents: -(refundAmountCents || original.gross_amount_cents || 0),
          platform_fee_cents: -reversedFeeCents,
          gateway_fee_cents: 0,
          net_amount_cents: reversedFeeCents, // Net is positive (fee returned to merchant)
          stripe_transaction_id: `${originalTransactionId}_reversal`,
          status: 'completed',
          processed_at: new Date(),
          metadata: {
            original_transaction_id: original.id,
            reversal_reason: reason,
          },
        } as any,
      });

      return {
        success: true,
        reversedFeeCents,
      };
    } catch (error: any) {
      // console.error('[StripeConnect] Fee reversal error:', error);
      return {
        success: false,
        error: error.message || 'Failed to reverse fee',
      };
    }
  }

  /**
   * Get platform revenue summary
   */
  async getRevenueSummary(startDate: Date, endDate: Date): Promise<{
    totalCents: number;
    transactionFeesCents: number;
    depositForfeitsCents: number;
    subscriptionsCents: number;
    transactionCount: number;
  }> {
    const transactions = await prisma.platform_revenue_transactions.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        status: 'completed',
      },
    });

    return {
      totalCents: transactions.reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      transactionFeesCents: transactions
        .filter(t => t.transaction_type === 'transaction_fee')
        .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      depositForfeitsCents: transactions
        .filter(t => t.transaction_type === 'deposit_forfeit')
        .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      subscriptionsCents: transactions
        .filter(t => t.transaction_type === 'subscription')
        .reduce((sum: number, t: any) => sum + (t.platform_fee_cents || 0), 0),
      transactionCount: transactions.length,
    };
  }
}

// Export singleton instance
export const stripeConnectService = new StripeConnectService();
export default stripeConnectService;
