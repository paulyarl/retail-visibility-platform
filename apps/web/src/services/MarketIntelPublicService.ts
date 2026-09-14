/**
 * MarketIntelPublicService — public teaser endpoint client for the
 * seed page market-intel sidebar.
 *
 * Extends PublicApiSingleton (no auth required). ttl: 0 — the sidebar
 * mounts on force-dynamic pages and the server already renders the
 * teaser; no client cache is needed.
 *
 * Wraps:
 *   GET /api/public/place/:slug/market-intel/summary  (§4.1)
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface MarketIntelTeaserCard {
  available: boolean;
  teaser: string;
  count?: number;
}

export interface MarketIntelTeaserSummary {
  businessSlug: string;
  businessName: string | null;
  hasAudit: boolean;
  /** Tier-C-safe audit narrative for the About section (§1.1). */
  publicNarrative: string | null;
  cards: {
    growthOpportunities: MarketIntelTeaserCard;
    howItStacksUp: MarketIntelTeaserCard;
    fullReport: MarketIntelTeaserCard;
    claimBusiness: MarketIntelTeaserCard;
  };
}

class MarketIntelPublicService extends PublicApiSingleton {
  private static instance: MarketIntelPublicService;

  private constructor() {
    super('market-intel-public', { ttl: 0 });
  }

  public static getInstance(): MarketIntelPublicService {
    if (!MarketIntelPublicService.instance) {
      MarketIntelPublicService.instance = new MarketIntelPublicService();
    }
    return MarketIntelPublicService.instance;
  }

  /** GET /api/public/place/:slug/market-intel/summary */
  async getTeaserSummary(slug: string): Promise<MarketIntelTeaserSummary | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/place/${encodeURIComponent(slug)}/market-intel/summary`,
        { method: 'GET' },
      );
      if (!result.success) return null;
      return result.data?.data ?? result.data;
    } catch {
      return null;
    }
  }
}

const marketIntelPublicService = MarketIntelPublicService.getInstance();
export default marketIntelPublicService;
