/**
 * MarketIntelCustomerService — authenticated customer endpoint client for
 * the seed page market-intel sidebar.
 *
 * Extends CustomerApiSingleton (customer JWT auth).
 *
 * Wraps:
 *   GET  /api/customer/place/:slug/market-intel/partial        (§4.2)
 *   GET  /api/customer/place/:slug/market-intel/full            (§4.3)
 *   POST /api/customer/place/:slug/market-intel/unlock         (§6.2 — create PI)
 *   POST /api/customer/place/:slug/market-intel/unlock/confirm (§6.2 — confirm)
 *
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§4.2, §4.3, §6.2)
 */
import { CustomerApiSingleton } from '../providers/base/CustomerApiSingleton';

export interface MarketIntelPartialItem {
  title: string;
  impact: string | null;
  locked: boolean;
}

export interface MarketIntelPartialSignal {
  signal: string;
  met: boolean | null;
}

export interface MarketIntelPartialContent {
  businessSlug: string;
  hasAudit: boolean;
  growthOpportunities: {
    items: MarketIntelPartialItem[];
    lockedCount: number;
    available: boolean;
  };
  howItStacksUp: {
    signals: MarketIntelPartialSignal[];
    available: boolean;
  };
}

export interface MarketIntelFullItem {
  title: string;
  description: string | null;
  impact: string | null;
}

export interface MarketIntelFullSignal {
  signal: string;
  met: boolean | null;
  evidence: string | null;
}

export interface MarketIntelFullContent {
  businessSlug: string;
  businessName: string | null;
  hasAudit: boolean;
  growthOpportunities: {
    items: MarketIntelFullItem[];
    available: boolean;
  };
  howItStacksUp: {
    signals: MarketIntelFullSignal[];
    available: boolean;
  };
  gapAnalysis: Record<string, unknown> | null;
  marketContext: {
    hasCategoryIntelligence: boolean;
    hasLocationIntelligence: boolean;
    category: unknown;
    location: unknown;
  } | null;
}

export interface UnlockResult {
  clientSecret?: string;
  paymentIntentId?: string;
  amountCents?: number;
  tenantId?: string;
  alreadyOwner?: boolean;
  alreadyUnlocked?: boolean;
  tier?: number;
  error?: string;
}

export interface UnlockConfirmResult {
  unlocked: boolean;
  tier: number;
  gatewayTransactionId: string;
  error?: string;
}

class MarketIntelCustomerService extends CustomerApiSingleton {
  private static instance: MarketIntelCustomerService;

  private constructor() {
    super('market-intel-customer', { ttl: 0 });
  }

  public static getInstance(): MarketIntelCustomerService {
    if (!MarketIntelCustomerService.instance) {
      MarketIntelCustomerService.instance = new MarketIntelCustomerService();
    }
    return MarketIntelCustomerService.instance;
  }

  getServiceCachePatterns(): string[] {
    return ['market-intel-partial', 'market-intel-full'];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  /** GET /api/customer/place/:slug/market-intel/partial */
  async getPartialContent(slug: string): Promise<MarketIntelPartialContent | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/customer/place/${encodeURIComponent(slug)}/market-intel/partial`,
        { method: 'GET' },
        'market-intel-partial',
      );
      if (!result.success) return null;
      return result.data?.data ?? result.data;
    } catch {
      return null;
    }
  }

  /**
   * GET /api/customer/place/:slug/market-intel/full
   * Returns full content for paid/owner. Returns null on 402 (unlock required)
   * — the caller should show the paywall.
   */
  async getFullContent(slug: string): Promise<{ content: MarketIntelFullContent | null; unlockRequired: boolean }> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/customer/place/${encodeURIComponent(slug)}/market-intel/full`,
        { method: 'GET' },
        'market-intel-full',
      );
      if (result.success) {
        return { content: result.data?.data ?? result.data, unlockRequired: false };
      }
      // 402 unlock_required → caller shows paywall.
      if (result.error === 'unlock_required' || (result as any).status === 402) {
        return { content: null, unlockRequired: true };
      }
      return { content: null, unlockRequired: false };
    } catch {
      return { content: null, unlockRequired: false };
    }
  }

  /**
   * POST /api/customer/place/:slug/market-intel/unlock
   * Creates a Stripe PaymentIntent for a single-report unlock.
   */
  async createUnlock(slug: string): Promise<UnlockResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/customer/place/${encodeURIComponent(slug)}/market-intel/unlock`,
        { method: 'POST' },
        'market-intel-unlock',
      );
      if (result.success) {
        return result.data?.data ?? result.data;
      }
      return { error: typeof result.error === 'string' ? result.error : 'Unlock failed' };
    } catch (e: any) {
      return { error: e?.message || 'Unlock failed' };
    }
  }

  /**
   * POST /api/customer/place/:slug/market-intel/unlock/confirm
   * Confirms a successful payment and records the unlock + revenue row.
   */
  async confirmUnlock(slug: string, paymentIntentId: string): Promise<UnlockConfirmResult> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/customer/place/${encodeURIComponent(slug)}/market-intel/unlock/confirm`,
        {
          method: 'POST',
          body: JSON.stringify({ paymentIntentId }),
        },
        'market-intel-unlock-confirm',
      );
      if (result.success) {
        return result.data?.data ?? result.data;
      }
      return { unlocked: false, tier: 0, gatewayTransactionId: '', error: typeof result.error === 'string' ? result.error : 'Confirm failed' };
    } catch (e: any) {
      return { unlocked: false, tier: 0, gatewayTransactionId: '', error: e?.message || 'Confirm failed' };
    }
  }
}

const marketIntelCustomerService = MarketIntelCustomerService.getInstance();
export default marketIntelCustomerService;
