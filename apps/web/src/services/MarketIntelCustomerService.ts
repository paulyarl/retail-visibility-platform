/**
 * MarketIntelCustomerService — authenticated customer endpoint client for
 * the seed page market-intel sidebar.
 *
 * Extends CustomerApiSingleton (customer JWT auth).
 *
 * Wraps:
 *   GET  /api/customer/place/:slug/market-intel/partial        (§4.2)
 *   GET  /api/customer/place/:slug/market-intel/full            (§4.3)
 *   GET  /api/customer/place/:slug/market-intel/report.pdf      (§7 — PDF download)
 *   POST /api/customer/place/:slug/market-intel/unlock         (§6.2 — create PI)
 *   POST /api/customer/place/:slug/market-intel/unlock/confirm (§6.2 — confirm)
 *
 * Spec: docs/LocalBiz/SEED_MARKET_INTEL_SIDEBAR_SPEC.md (§4.2, §4.3, §6.2)
 */
import { CustomerApiSingleton } from '../providers/base/CustomerApiSingleton';
import { ResponseType } from '../providers/base/FlexibleApiSingleton';

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

export type ReportPdfError = 'unauthorized' | 'unlock_required' | 'unknown';

export interface ReportPdfResult {
  blob: Blob | null;
  error?: ReportPdfError;
}

/**
 * ApiResult.error is `string | { status, message, code }` — normalize both
 * shapes so callers can compare against the API's error codes (e.g.
 * 'unlock_required', 'tenant_required') and statuses.
 */
function extractError(result: { error?: string | { status: number; message: string; code: string } | null; status?: number }): {
  status?: number;
  code?: string;
  message?: string;
} {
  const err = result.error;
  if (!err) return { status: result.status };
  if (typeof err === 'string') return { code: err, message: err, status: result.status };
  return { status: err.status ?? result.status, code: err.code, message: err.message };
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
      const err = extractError(result);
      if (err.code === 'unlock_required' || err.status === 402) {
        return { content: null, unlockRequired: true };
      }
      return { content: null, unlockRequired: false };
    } catch {
      return { content: null, unlockRequired: false };
    }
  }

  /**
   * GET /api/customer/place/:slug/market-intel/report.pdf
   * Downloads the full audit report PDF for paid/owner customers.
   * Returns null on failure (caller shows the error toast).
   */
  async downloadReportPdf(slug: string): Promise<ReportPdfResult> {
    try {
      const result = await this.makeDefaultRequest<Blob>(
        `/api/customer/place/${encodeURIComponent(slug)}/market-intel/report.pdf`,
        { method: 'GET' },
        `market-intel-report-pdf-${slug}`,
        0,
        { responseType: ResponseType.BLOB },
      );
      if (result.success) return { blob: result.data ?? null };
      const err = extractError(result);
      if (err.status === 401) return { blob: null, error: 'unauthorized' };
      if (err.status === 402 || err.code === 'unlock_required') {
        return { blob: null, error: 'unlock_required' };
      }
      return { blob: null, error: 'unknown' };
    } catch {
      return { blob: null, error: 'unknown' };
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
      // Preserve the API's error code (e.g. 'tenant_required') — the paywall
      // branches on it — falling back to the message for display.
      const err = extractError(result);
      return { error: err.code ?? err.message ?? 'Unlock failed' };
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
      const err = extractError(result);
      return { unlocked: false, tier: 0, gatewayTransactionId: '', error: err.message ?? err.code ?? 'Confirm failed' };
    } catch (e: any) {
      return { unlocked: false, tier: 0, gatewayTransactionId: '', error: e?.message || 'Confirm failed' };
    }
  }
}

const marketIntelCustomerService = MarketIntelCustomerService.getInstance();
export default marketIntelCustomerService;
