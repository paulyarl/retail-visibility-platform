/**
 * Tax Service
 *
 * Calculates sales tax for checkout orders.
 * Supports two providers:
 * 1. Stripe Tax — real-time calculation via Stripe Tax API
 * 2. Manual — flat percentage rate configured per tenant
 *
 * Falls back to zero tax if not configured.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

export interface TaxAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface TaxCalculationResult {
  taxCents: number;
  taxRate: number;
  provider: 'stripe_tax' | 'manual' | 'none';
  jurisdiction?: string;
  lineItems?: Array<{
    amountCents: number;
    taxCents: number;
    taxRate: number;
  }>;
}

export interface TaxLineItemInput {
  amountCents: number;
  reference?: string;
}

class TaxService {
  private static instance: TaxService;

  static getInstance(): TaxService {
    if (!TaxService.instance) {
      TaxService.instance = new TaxService();
    }
    return TaxService.instance;
  }

  /**
   * Get tax configuration for a tenant
   */
  async getTaxConfig(tenantId: string): Promise<{
    taxEnabled: boolean;
    taxProvider: string | null;
    manualTaxRatePercent: number | null;
    taxShipping: boolean;
  }> {
    const settings = await prisma.tenant_commerce_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        tax_enabled: true,
        tax_provider: true,
        manual_tax_rate_percent: true,
        tax_shipping: true,
      },
    });

    return {
      taxEnabled: settings?.tax_enabled ?? false,
      taxProvider: settings?.tax_provider ?? null,
      manualTaxRatePercent: settings?.manual_tax_rate_percent
        ? parseFloat(settings.manual_tax_rate_percent.toString())
        : null,
      taxShipping: settings?.tax_shipping ?? false,
    };
  }

  /**
   * Calculate tax for an order
   *
   * @param tenantId - Tenant ID
   * @param subtotalCents - Subtotal in cents
   * @param shippingCents - Shipping cost in cents
   * @param shippingAddress - Shipping address for tax jurisdiction
   * @param lineItems - Individual line items (optional, for itemized tax)
   * @param stripeAccountId - Stripe connected account ID (for Stripe Tax)
   * @returns TaxCalculationResult
   */
  async calculateTax(
    tenantId: string,
    subtotalCents: number,
    shippingCents: number,
    shippingAddress: TaxAddress | null,
    lineItems?: TaxLineItemInput[],
    stripeAccountId?: string
  ): Promise<TaxCalculationResult> {
    const config = await this.getTaxConfig(tenantId);

    if (!config.taxEnabled) {
      return { taxCents: 0, taxRate: 0, provider: 'none' };
    }

    if (config.taxProvider === 'stripe_tax') {
      return this.calculateWithStripeTax(
        tenantId,
        subtotalCents,
        shippingCents,
        shippingAddress,
        config.taxShipping,
        lineItems,
        stripeAccountId
      );
    }

    if (config.taxProvider === 'manual' && config.manualTaxRatePercent !== null) {
      return this.calculateManual(
        subtotalCents,
        shippingCents,
        config.manualTaxRatePercent,
        config.taxShipping
      );
    }

    logger.warn('[TaxService] Tax enabled but no valid provider configured', undefined, { tenantId, config });
    return { taxCents: 0, taxRate: 0, provider: 'none' };
  }

  /**
   * Manual tax calculation — flat percentage
   */
  private calculateManual(
    subtotalCents: number,
    shippingCents: number,
    taxRatePercent: number,
    taxShipping: boolean
  ): TaxCalculationResult {
    const taxRate = taxRatePercent; // Already decimal (e.g., 0.0825)
    const taxableAmount = taxShipping
      ? subtotalCents + shippingCents
      : subtotalCents;

    const taxCents = Math.round(taxableAmount * taxRate);

    return {
      taxCents,
      taxRate,
      provider: 'manual',
      jurisdiction: 'Manual rate',
    };
  }

  /**
   * Stripe Tax calculation — real-time via Stripe Tax API
   *
   * Requires:
   * - Stripe account with Tax enabled
   * - Shipping address (at minimum: state/postal code/country)
   * - For connected accounts: stripeAccountId header
   */
  private async calculateWithStripeTax(
    tenantId: string,
    subtotalCents: number,
    shippingCents: number,
    shippingAddress: TaxAddress | null,
    taxShipping: boolean,
    lineItems?: TaxLineItemInput[],
    stripeAccountId?: string
  ): Promise<TaxCalculationResult> {
    try {
      if (!shippingAddress || !shippingAddress.state || !shippingAddress.postalCode) {
        logger.warn('[TaxService] Stripe Tax requires shipping address with state and postal code', undefined, { tenantId });
        return { taxCents: 0, taxRate: 0, provider: 'none' };
      }

      // Dynamically import Stripe to avoid loading if not used
      const Stripe = (await import('stripe')).default;

      // Get the Stripe secret key from environment
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        logger.warn('[TaxService] STRIPE_SECRET_KEY not configured for Stripe Tax', undefined, { tenantId });
        return { taxCents: 0, taxRate: 0, provider: 'none' };
      }

      const stripe = new Stripe(stripeSecretKey, {
        apiVersion: '2026-05-27.dahlia' as any,
        typescript: true,
      });

      // Build line items for Stripe Tax calculation
      const stripeLineItems: any[] =
        (lineItems && lineItems.length > 0
          ? lineItems
          : [{ amountCents: subtotalCents, reference: 'subtotal' }]
        ).map((item, idx) => ({
          amount: Math.round(item.amountCents),
          reference: item.reference || `item-${idx}`,
          tax_code: 'txcd_99999999', // General — Merchandise (default tax code)
        }));

      // Add shipping as a line item if taxing shipping
      if (taxShipping && shippingCents > 0) {
        stripeLineItems.push({
          amount: Math.round(shippingCents),
          reference: 'shipping',
          tax_code: 'txcd_9201001', // Shipping
        });
      }

      const calculation = await stripe.tax.calculations.create(
        {
          currency: 'usd',
          line_items: stripeLineItems,
          customer_details: {
            address: {
              line1: shippingAddress.line1,
              line2: shippingAddress.line2,
              city: shippingAddress.city,
              state: shippingAddress.state,
              postal_code: shippingAddress.postalCode,
              country: shippingAddress.country || 'US',
            },
          },
        },
        stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
      );

      const taxCents = (calculation as any).tax_amount as number;
      const taxableAmount = taxShipping
        ? subtotalCents + shippingCents
        : subtotalCents;
      const taxRate = taxableAmount > 0 ? taxCents / taxableAmount : 0;

      return {
        taxCents,
        taxRate,
        provider: 'stripe_tax',
        jurisdiction: (calculation as any).tax_breakdown?.[0]?.jurisdiction || undefined,
        lineItems: calculation.line_items?.data?.map((li: any) => ({
          amountCents: li.amount,
          taxCents: li.tax_amount,
          taxRate: li.amount > 0 ? li.tax_amount / li.amount : 0,
        })),
      };
    } catch (error: any) {
      logger.error('[TaxService] Stripe Tax calculation failed', undefined, { tenantId, error: error.message });
      // Fail gracefully — don't block checkout
      return { taxCents: 0, taxRate: 0, provider: 'none' };
    }
  }
}

const taxService = TaxService.getInstance();
export { taxService, TaxService };
export default taxService;
