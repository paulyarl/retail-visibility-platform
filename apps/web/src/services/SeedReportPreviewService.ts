/**
 * SeedReportPreviewService — public client for the seed intelligence
 * report preview.
 *
 * Extends PublicApiSingleton (no auth required). 5-min cache — the
 * preview is stable between report versions.
 *
 * Wraps:
 *   GET /api/public/marketing/seed/:seedId/report/preview
 *   (only lint-passed published reports are served)
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';
import { clientLogger } from '../lib/client-logger';

export interface ReportPreviewData {
  report_id: string;
  seed_id: string;
  version: number;
  status: string;
  generated_at: string;
  business_identity: {
    business_name: { value: string; state: string };
    address: { value: string; state: string };
    phone: { value: string | null; state: string };
    city: { value: string; state: string };
    state: { value: string; state: string };
    website: { value: string | null; state: string };
  };
  narrative?: {
    public_narrative: string | null;
    market_summary: string | null;
    metro_context?: string | null;
    notable_areas?: string[];
  } | null;
  source_summary: {
    sources_checked_count: number;
    sources_with_evidence_count: number;
    source_types: Array<{ source_type: string; source_name: string; label?: string; role: string; observation_count: number }>;
    name_variants_count: number;
    address_variants_count: number;
    discovery_attribution?: Array<{ reason_key: string; basis: string | null; label?: string | null }>;
  };
  identity_reconciliation: {
    canonical_candidate: {
      business_name: string;
      address: string;
      city: string;
      state: string;
      phone: string | null;
      confidence: string;
    } | null;
    identity_confidence: string;
  };
  market_classification: {
    category: string | null;
    subcategory: string | null;
    category_fit: string;
    location_status: string;
    category_profile_context?: string | null;
    operational_signals?: string[];
    recommended_categories?: Array<{
      category: string;
      confidence: string;
      subcategory: string | null;
      basis: string | null;
    }>;
  };
  platform_presence?: {
    platforms: Array<{
      platform: string;
      presence: string;
      claimed_status: string | null;
      source_url: string | null;
    }>;
  };
  intelligence_signals: {
    signals: Array<{ code: string; label: string; basis: string }>;
  };
  claim_summary: {
    claim_status: string;
    claim_benefits: string[];
  };
  next_actions: {
    primary_cta: string | null;
    cta_eligible: boolean;
    cta_disabled_reason: string | null;
  };
}

class SeedReportPreviewService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: SeedReportPreviewService;

  private constructor() {
    super('seed-report-preview-service');
  }

  public static getInstance(): SeedReportPreviewService {
    if (!SeedReportPreviewService.instance) {
      SeedReportPreviewService.instance = new SeedReportPreviewService();
    }
    return SeedReportPreviewService.instance;
  }

  async getReportPreview(seedId: string): Promise<ReportPreviewData | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/marketing/seed/${encodeURIComponent(seedId)}/report/preview`,
        {},
        `report-preview-${seedId}`,
        300_000, // 5-min cache
        { context: AppContext.SHOP, isolation: CacheIsolation.SHOP },
      );
      if (!result.success) return null;
      return (result.data?.data ?? result.data) ?? null;
    } catch (error) {
      clientLogger.error('[SeedReportPreviewService] Failed to load report preview:', { detail: error });
      return null;
    }
  }
}

const seedReportPreviewService = SeedReportPreviewService.getInstance();
export default seedReportPreviewService;
