/**
 * MarketIntelCustomerService — authenticated customer endpoint client for
 * the seed page market-intel sidebar.
 *
 * Extends CustomerApiSingleton (customer JWT auth).
 *
 * Wraps:
 *   GET /api/customer/place/:slug/market-intel/partial  (§4.2)
 *
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§4.2)
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
    return ['market-intel-partial'];
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
}

const marketIntelCustomerService = MarketIntelCustomerService.getInstance();
export default marketIntelCustomerService;
