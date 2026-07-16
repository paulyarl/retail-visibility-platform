/**
 * Platform Fee Invoice Service
 * 
 * Handles monthly invoicing for platform fees from non-Stripe gateways:
 * - Calculate fees per merchant per month
 * - Generate invoices with line items
 * - Charge via Stripe Billing
 * - Track payment status
 */

import Stripe from 'stripe';
import { prisma } from '../prisma';
import { logger } from '../logger';

export interface InvoiceGenerationResult {
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
  totalFeesCents: number;
  status: string;
}

export interface FeeBreakdown {
  stripe: { feesCents: number; count: number };
  paypal: { feesCents: number; count: number };
  square: { feesCents: number; count: number };
  clover: { feesCents: number; count: number };
  other: { feesCents: number; count: number };
}

export class PlatformFeeInvoiceService {
  private stripe: Stripe | null = null;

  /**
   * Initialize Stripe client for billing
   */
  private async getStripeClient(): Promise<Stripe | null> {
    if (this.stripe) return this.stripe;

    const config = await prisma.platform_payment_config.findUnique({
      where: { id: 'platform_main' },
    });

    if (!config?.stripe_platform_secret_key_encrypted) {
      return null;
    }

    // TODO: Decrypt the secret key
    this.stripe = new Stripe(config.stripe_platform_secret_key_encrypted, {
      apiVersion: '2026-06-24.dahlia',
    });

    return this.stripe;
  }

  /**
   * Calculate platform fees for a tenant in a given period
   * Only includes non-Stripe gateways (PayPal, Square, Clover)
   */
  async calculateFeesForPeriod(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FeeBreakdown> {
    // Get all payments for this tenant in the period
    const payments = await prisma.payments.findMany({
      where: {
        tenant_id: tenantId,
        payment_status: 'paid',
        captured_at: {
          gte: startDate,
          lte: endDate,
        },
        fee_waived: false,
      },
      select: {
        id: true,
        gateway_type: true,
        platform_fee_cents: true,
        amount_cents: true,
      },
    });

    const breakdown: FeeBreakdown = {
      stripe: { feesCents: 0, count: 0 },
      paypal: { feesCents: 0, count: 0 },
      square: { feesCents: 0, count: 0 },
      clover: { feesCents: 0, count: 0 },
      other: { feesCents: 0, count: 0 },
    };

    for (const payment of payments) {
      const gateway = (payment.gateway_type || 'other').toLowerCase();
      const feeCents = payment.platform_fee_cents || 0;

      switch (gateway) {
        case 'stripe':
          // Skip Stripe fees - they're collected automatically via Connect
          break;
        case 'paypal':
          breakdown.paypal.feesCents += feeCents;
          breakdown.paypal.count++;
          break;
        case 'square':
          breakdown.square.feesCents += feeCents;
          breakdown.square.count++;
          break;
        case 'clover':
          breakdown.clover.feesCents += feeCents;
          breakdown.clover.count++;
          break;
        default:
          breakdown.other.feesCents += feeCents;
          breakdown.other.count++;
      }
    }

    return breakdown;
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(periodStart: Date, tenantId: string): string {
    const year = periodStart.getFullYear();
    const month = String(periodStart.getMonth() + 1).padStart(2, '0');
    const shortId = tenantId.slice(-6).toUpperCase();
    return `PFI-${year}${month}-${shortId}`;
  }

  /**
   * Generate monthly invoices for all tenants with non-Stripe fees
   */
  async generateMonthlyInvoices(
    periodStart: Date,
    periodEnd: Date
  ): Promise<InvoiceGenerationResult[]> {
    const results: InvoiceGenerationResult[] = [];

    // Find all tenants with non-Stripe payments in the period
    const tenantsWithFees = await prisma.$queryRaw<{ tenant_id: string }[]>`
      SELECT DISTINCT tenant_id
      FROM payments
      WHERE payment_status = 'paid'
        AND captured_at >= ${periodStart}
        AND captured_at <= ${periodEnd}
        AND platform_fee_waived = false
        AND platform_fee_cents > 0
        AND gateway_type != 'stripe'
    `;

    for (const { tenant_id } of tenantsWithFees) {
      try {
        const invoice = await this.generateInvoice(tenant_id, periodStart, periodEnd);
        if (invoice && invoice.totalFeesCents > 0) {
          results.push(invoice);
        }
      } catch (error) {
        logger.error(`[PlatformFeeInvoice] Failed to generate invoice for tenant ${tenant_id}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      }
    }

    return results;
  }

  /**
   * Generate invoice for a single tenant
   */
  async generateInvoice(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<InvoiceGenerationResult | null> {
    // Check if invoice already exists for this period
    const existing = await prisma.platform_fee_invoices.findFirst({
      where: {
        tenant_id: tenantId,
        period_start: periodStart,
        period_end: periodEnd,
      },
    });

    if (existing) {
      console.log(`[PlatformFeeInvoice] Invoice already exists for tenant ${tenantId}`);
      return {
        invoiceId: existing.id,
        invoiceNumber: existing.invoice_number || '',
        tenantId: existing.tenant_id,
        totalFeesCents: Number(existing.total_fees_cents || 0),
        status: existing.status || 'pending',
      };
    }

    // Calculate fees
    const breakdown = await this.calculateFeesForPeriod(tenantId, periodStart, periodEnd);

    const totalFeesCents =
      breakdown.paypal.feesCents +
      breakdown.square.feesCents +
      breakdown.clover.feesCents +
      breakdown.other.feesCents;

    if (totalFeesCents === 0) {
      return null;
    }

    // Create invoice
    const invoiceId = `pfi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const invoiceNumber = this.generateInvoiceNumber(periodStart, tenantId);
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 15); // Due 15 days after period end

    const invoice = await prisma.platform_fee_invoices.create({
      data: {
        id: invoiceId,
        tenant_id: tenantId,
        period_start: periodStart,
        period_end: periodEnd,
        invoice_number: invoiceNumber,
        stripe_fees_cents: 0,
        paypal_fees_cents: breakdown.paypal.feesCents,
        square_fees_cents: breakdown.square.feesCents,
        clover_fees_cents: breakdown.clover.feesCents,
        other_fees_cents: breakdown.other.feesCents,
        total_fees_cents: totalFeesCents,
        stripe_transaction_count: 0,
        paypal_transaction_count: breakdown.paypal.count,
        square_transaction_count: breakdown.square.count,
        clover_transaction_count: breakdown.clover.count,
        other_transaction_count: breakdown.other.count,
        status: 'pending',
        due_date: dueDate,
      },
    });

    // Create line items
    await this.createLineItems(invoiceId, tenantId, periodStart, periodEnd);

    // Try to create Stripe invoice if tenant has billing setup
    await this.createStripeInvoice(invoiceId, tenantId, totalFeesCents);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number || '',
      tenantId: invoice.tenant_id,
      totalFeesCents: Number(invoice.total_fees_cents || 0),
      status: invoice.status || 'pending',
    };
  }

  /**
   * Create line items for invoice
   */
  private async createLineItems(
    invoiceId: string,
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const payments = await prisma.payments.findMany({
      where: {
        tenant_id: tenantId,
        payment_status: 'paid',
        captured_at: {
          gte: startDate,
          lte: endDate,
        },
        fee_waived: false,
        gateway_type: { not: 'stripe' },
      },
      select: {
        id: true,
        order_id: true,
        gateway_type: true,
        captured_at: true,
        amount_cents: true,
        platform_fee_cents: true,
        platform_fee_percentage: true,
      },
    });

    for (const payment of payments) {
      if (!payment.platform_fee_cents || payment.platform_fee_cents === 0) continue;

      await prisma.platform_fee_invoice_items.create({
        data: {
          id: `pfi_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invoice_id: invoiceId,
          payment_id: payment.id,
          order_id: payment.order_id,
          gateway: payment.gateway_type || 'other',
          transaction_date: payment.captured_at,
          gross_amount_cents: payment.amount_cents || 0,
          platform_fee_cents: payment.platform_fee_cents,
          fee_percentage: payment.platform_fee_percentage ? Number(payment.platform_fee_percentage) : null,
          description: `Platform fee for ${payment.gateway_type} transaction`,
        },
      });
    }
  }

  /**
   * Create Stripe invoice for billing
   */
  private async createStripeInvoice(
    invoiceId: string,
    tenantId: string,
    amountCents: number
  ): Promise<string | null> {
    try {
      const stripe = await this.getStripeClient();
      if (!stripe) {
        console.log('[PlatformFeeInvoice] Stripe not configured, skipping Stripe invoice');
        return null;
      }

      // Get tenant's Stripe customer ID
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { stripe_customer_id: true, name: true },
      });

      if (!tenant?.stripe_customer_id) {
        console.log(`[PlatformFeeInvoice] Tenant ${tenantId} has no Stripe customer ID`);
        return null;
      }

      // Create invoice item
      await stripe.invoiceItems.create({
        customer: tenant.stripe_customer_id,
        amount: amountCents,
        currency: 'usd',
        description: 'Platform Fee Invoice - Non-Stripe Transactions',
        metadata: {
          platform_fee_invoice_id: invoiceId,
          tenant_id: tenantId,
        },
      });

      // Create invoice
      const stripeInvoice = await stripe.invoices.create({
        customer: tenant.stripe_customer_id,
        auto_advance: true, // Auto-send and charge
        metadata: {
          platform_fee_invoice_id: invoiceId,
          tenant_id: tenantId,
        },
      });

      // Update our invoice with Stripe ID
      await prisma.platform_fee_invoices.update({
        where: { id: invoiceId },
        data: {
          stripe_invoice_id: stripeInvoice.id,
        },
      });

      return stripeInvoice.id;
    } catch (error) {
      logger.error('[PlatformFeeInvoice] Failed to create Stripe invoice:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(
    invoiceId: string,
    paymentMethod: string,
    stripePaymentIntentId?: string
  ): Promise<void> {
    await prisma.platform_fee_invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paid_at: new Date(),
        payment_method: paymentMethod,
        stripe_payment_intent_id: stripePaymentIntentId,
      },
    });

    // Record in platform revenue transactions
    const invoice = await prisma.platform_fee_invoices.findUnique({
      where: { id: invoiceId },
    });

    if (invoice) {
      await prisma.platform_revenue_transactions.create({
        data: {
          id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: invoice.tenant_id,
          transaction_type: 'transaction_fee',
          gross_amount_cents: Number(invoice.total_fees_cents),
          platform_fee_cents: Number(invoice.total_fees_cents),
          gateway_fee_cents: 0,
          net_amount_cents: Number(invoice.total_fees_cents),
          stripe_transaction_id: stripePaymentIntentId,
          status: 'completed',
          processed_at: new Date(),
        },
      });
    }
  }

  /**
   * Waive invoice
   */
  async waiveInvoice(invoiceId: string, reason: string): Promise<void> {
    await prisma.platform_fee_invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'waived',
        waived_amount_cents: undefined, // Will be set below
        waiver_reason: reason,
        payment_method: 'waived',
      },
    });
  }

  /**
   * Get invoice summary for admin
   */
  async getInvoiceSummary(startDate: Date, endDate: Date): Promise<{
    totalPendingCents: number;
    totalPaidCents: number;
    totalWaivedCents: number;
    invoiceCount: number;
    byGateway: {
      paypal: number;
      square: number;
      clover: number;
      other: number;
    };
  }> {
    const invoices = await prisma.platform_fee_invoices.findMany({
      where: {
        period_start: { gte: startDate },
        period_end: { lte: endDate },
      },
    });

    return {
      totalPendingCents: invoices
        .filter(i => i.status === 'pending')
        .reduce((sum, i) => sum + Number(i.total_fees_cents || 0), 0),
      totalPaidCents: invoices
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + Number(i.total_fees_cents || 0), 0),
      totalWaivedCents: invoices
        .filter(i => i.status === 'waived')
        .reduce((sum, i) => sum + Number(i.waived_amount_cents || 0), 0),
      invoiceCount: invoices.length,
      byGateway: {
        paypal: invoices.reduce((sum, i) => sum + Number(i.paypal_fees_cents || 0), 0),
        square: invoices.reduce((sum, i) => sum + Number(i.square_fees_cents || 0), 0),
        clover: invoices.reduce((sum, i) => sum + Number(i.clover_fees_cents || 0), 0),
        other: invoices.reduce((sum, i) => sum + Number(i.other_fees_cents || 0), 0),
      },
    };
  }
}

// Export singleton instance
export const platformFeeInvoiceService = new PlatformFeeInvoiceService();
export default platformFeeInvoiceService;
