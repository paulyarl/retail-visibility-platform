/**
 * ShippingRateService — Real-time shipping rate calculation via EasyPost
 * Phase 4A: Real-Time Shipping Rates
 *
 * Uses EasyPost API to get real-time shipping rates from carriers.
 * Falls back to tenant-configured flat rates if EasyPost is not configured.
 */

import { BaseService } from './BaseService';
import { logger } from '../logger';

const EASYPOST_API_KEY = process.env.EASYPOST_API_KEY || '';
const EASYPOST_API_URL = 'https://api.easypost.com/v2';

export interface ShippingRateRequest {
  tenantId: string;
  toAddress: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  fromAddress?: {
    street1: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  parcel: {
    weight: number; // ounces
    length?: number; // inches
    width?: number; // inches
    height?: number; // inches
  };
}

export interface ShippingRate {
  carrier: string;
  service: string;
  rate: number; // cents
  currency: string;
  deliveryDays: number | null;
  deliveryDateGuaranteed: boolean;
}

class ShippingRateService extends BaseService {
  private static instance: ShippingRateService;

  private constructor() {
    super();
  }

  static getInstance(): ShippingRateService {
    if (!ShippingRateService.instance) {
      ShippingRateService.instance = new ShippingRateService();
    }
    return ShippingRateService.instance;
  }

  /**
   * Get real-time shipping rates from EasyPost
   */
  async getRates(input: ShippingRateRequest): Promise<ShippingRate[]> {
    if (!EASYPOST_API_KEY) {
      logger.info('EasyPost not configured — returning empty rates', undefined, { tenantId: input.tenantId });
      return [];
    }

    try {
      const fromAddress = input.fromAddress || await this.getTenantFromAddress(input.tenantId);
      if (!fromAddress) {
        logger.warn('No from address for tenant', undefined, { tenantId: input.tenantId });
        return [];
      }

      const shipment = {
        to_address: {
          street1: input.toAddress.street1,
          street2: input.toAddress.street2,
          city: input.toAddress.city,
          state: input.toAddress.state,
          zip: input.toAddress.zip,
          country: input.toAddress.country,
        },
        from_address: {
          street1: fromAddress.street1,
          street2: fromAddress.street2,
          city: fromAddress.city,
          state: fromAddress.state,
          zip: fromAddress.zip,
          country: fromAddress.country,
        },
        parcel: {
          weight: input.parcel.weight,
          length: input.parcel.length || 10,
          width: input.parcel.width || 10,
          height: input.parcel.height || 5,
        },
      };

      const response = await fetch(`${EASYPOST_API_URL}/shipments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${EASYPOST_API_KEY}`,
        },
        body: JSON.stringify(shipment),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn('EasyPost API error', undefined, { status: response.status, error: errorText });
        return [];
      }

      const result = await response.json() as any;
      const rates = (result.rates || []) as any[];

      return rates.map(r => ({
        carrier: r.carrier || 'Unknown',
        service: r.service || 'Standard',
        rate: Math.round(parseFloat(r.rate) * 100),
        currency: r.currency || 'USD',
        deliveryDays: r.delivery_days ? parseInt(r.delivery_days) : null,
        deliveryDateGuaranteed: r.delivery_date_guaranteed || false,
      }));
    } catch (error) {
      logger.error('ShippingRateService.getRates failed', undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get tenant's default from address from business profile
   */
  private async getTenantFromAddress(tenantId: string) {
    try {
      const profile = await this.prisma.tenant_business_profiles_list.findFirst({
        where: { tenant_id: tenantId },
      });

      if (!profile) return null;

      return {
        street1: profile.address_line1 || '',
        street2: profile.address_line2 || undefined,
        city: profile.city || '',
        state: profile.state || '',
        zip: profile.postal_code || '',
        country: profile.country_code || 'US',
      };
    } catch {
      return null;
    }
  }

  /**
   * Get tenant-configured flat rate shipping
   */
  async getFlatRate(tenantId: string): Promise<{ rateCents: number; currency: string } | null> {
    try {
      const settings = await this.prisma.tenant_commerce_settings.findFirst({
        where: { tenant_id: tenantId },
      });

      if (!settings) return null;

      const metadata = settings as any;
      const flatRateCents = metadata.flat_shipping_rate_cents;
      if (flatRateCents && flatRateCents > 0) {
        return { rateCents: flatRateCents, currency: 'USD' };
      }

      return null;
    } catch {
      return null;
    }
  }
}

export const shippingRateService = ShippingRateService.getInstance();
export default ShippingRateService;
