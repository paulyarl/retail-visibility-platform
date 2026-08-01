/**
 * MarketingPayPublicService — zero-auth, ptoken-gated marketing payment surface
 * Extends PublicApiSingleton (RequestType.PUBLIC, no credentials).
 *
 * All calls are token/payment state — caching is disabled on every method
 * (no cache key, ttl 0). Responses follow the double-wrap contract:
 * backend `handleSuccess` wraps in { success, data } and makeDefaultRequest
 * wraps again, so unwrap with `result.data?.data ?? result.data`.
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface PayPageData {
  campaignId: string;
  businessName: string;
  category: string;
  city: string;
  serviceCategory: string | null;
  serviceCategoryLabel: string;
  packagePriceCents: number;
  subscriptionTierId: string | null;
  couponCode: string | null;
  tokenType: string;
  deliverableId: string | null;
  alreadyPaid: boolean;
}

export interface CheckoutResult {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
  discountCents: number;
  originalPriceCents: number;
}

export interface PayConfirmResult {
  campaignId: string;
  stage: string;
  amountCents: number;
  gatewayTransactionId: string;
  receiptUrl: string;
}

export class MarketingPayPublicService extends PublicApiSingleton {
  private static instance: MarketingPayPublicService;

  private constructor() {
    super('marketing-pay-public', { ttl: 0 });
  }

  public static getInstance(): MarketingPayPublicService {
    if (!MarketingPayPublicService.instance) {
      MarketingPayPublicService.instance = new MarketingPayPublicService();
    }
    return MarketingPayPublicService.instance;
  }

  async getPayPageData(ptoken: string): Promise<PayPageData> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/marketing/pay?ptoken=${encodeURIComponent(ptoken)}`,
      {},
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to load pay page');
    }
    return result.data?.data ?? result.data;
  }

  async createCheckout(ptoken: string, couponCode?: string): Promise<CheckoutResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/marketing/checkout',
      {
        method: 'POST',
        body: JSON.stringify({ ptoken, couponCode }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create checkout session');
    }
    return result.data?.data ?? result.data;
  }

  async validateCoupon(ptoken: string, couponCode: string, amountCents: number): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/marketing/coupons/validate',
      {
        method: 'POST',
        body: JSON.stringify({ ptoken, couponCode, amountCents }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Invalid coupon code');
    }
    return result.data?.data ?? result.data;
  }

  async confirmPayment(ptoken: string, paymentIntentId: string, couponCode?: string, subscriptionTierId?: string): Promise<PayConfirmResult> {
    const result = await this.makeDefaultRequest<any>(
      '/api/public/marketing/pay/confirm',
      {
        method: 'POST',
        body: JSON.stringify({ ptoken, paymentIntentId, couponCode, subscriptionTierId }),
      },
      undefined,
      0,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to confirm payment');
    }
    return result.data?.data ?? result.data;
  }

  getReceiptUrl(campaignId: string): string {
    return `/api/public/marketing/receipt/${campaignId}`;
  }
}

const marketingPayPublicService = MarketingPayPublicService.getInstance();
export { marketingPayPublicService };
export default marketingPayPublicService;
