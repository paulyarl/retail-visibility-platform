/**
 * Prospect Report Public Service (Frontend Singleton)
 *
 * Fetches the owner-facing Business Visibility Report DTO and resolves
 * /r/pr/{code} short links for the /prospect-report/[token] page and the
 * /r/pr/[code] redirect page.
 *
 * Mirrors ReportQrScanService / the seed-report public fetch pattern —
 * PublicApiSingleton, no auth (the signed token IS the capability).
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md §5
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

// ─── DTO mirror (snake_case — matches the API DTO verbatim) ───────────────

export interface ProspectReportIssue {
  headline: string;
  cost: string | null;
  evidence: string | null;
  tier: 'now' | 'worth_fixing';
}

export interface ProspectReportExpectation {
  field: string;
  expected_text: string;
  actual_text: string;
  note: string | null;
}

/**
 * Chapter ids — one per archetype a sibling campaign can contribute.
 * 'website' reads the website_positioning audit; the rest are filtered
 * owner-safe extracts of the shared business_analysis audit.
 */
export type ProspectReportChapterId =
  | 'website'
  | 'repair'
  | 'drift'
  | 'cta'
  | 'reviews'
  | 'recovery'
  | 'products';

/**
 * Shared chapter body — every chapter renders the same owner-safe shape;
 * chapter_id records which sibling's diagnostic produced it.
 */
export interface ProspectReportChapter {
  chapter_id: ProspectReportChapterId;
  title: string;
  audited_at: string;
  category: string | null;
  summary: string | null;
  verdict: string;
  already_working: string[];
  costing_customers: ProspectReportIssue[];
  expectations: ProspectReportExpectation[];
  competitive_frame: string[];
  fix: {
    headline: string;
    scope_notes: string | null;
    page_plan: string[] | null;
  };
}

export interface ProspectReportLockedChapter {
  chapter_id: string;
  title: string;
  finding_count: number;
  teaser: string;
}

export interface ProspectReport {
  report_kind: 'business_visibility';
  business_prospect_id: string;
  business_name: string;
  prepared_at: string;
  website_url: string | null;
  tier: 'free' | 'full';
  short_version: { lead: string | null; bullets: string[] };
  chapters: ProspectReportChapter[];
  locked_chapters: ProspectReportLockedChapter[];
  data_quality: {
    verified: string[];
    couldnt_check: string[];
    limitations: string[];
  };
  cta: { kind: 'claim' | 'contact'; label: string; url: string | null };
}

// ─── Service ──────────────────────────────────────────────────────────────

export class ProspectReportPublicService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: ProspectReportPublicService;

  private constructor() {
    super('prospect-report-public-service');
  }

  public static getInstance(): ProspectReportPublicService {
    if (!ProspectReportPublicService.instance) {
      ProspectReportPublicService.instance = new ProspectReportPublicService();
    }
    return ProspectReportPublicService.instance;
  }

  /** Fetch the report DTO for a signed token — null on 404/invalid. */
  async getReport(token: string): Promise<ProspectReport | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/marketing/prospect-report/${encodeURIComponent(token)}`,
        {},
        `prospect-report-${token.slice(0, 24)}`,
        0,
        { context: AppContext.SHOP, isolation: CacheIsolation.SHOP },
      );
      if (!result.success) return null;
      const data = result.data?.data || result.data;
      return (data as ProspectReport) ?? null;
    } catch (error) {
      clientLogger.error('[ProspectReportPublicService] Failed to fetch report:', { detail: error });
      return null;
    }
  }

  /**
   * Resolve a /r/pr/{code} short link — records the qr_scan_events row under
   * prospect_report_{channel} and returns the report path to redirect to.
   */
  async resolveCode(code: string): Promise<string | null> {
    try {
      const normalized = code.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/public/r/pr-scan/${encodeURIComponent(normalized)}`,
        {},
        `prospect-report-scan-${normalized}`,
        0,
        { context: AppContext.SHOP, isolation: CacheIsolation.SHOP },
      );
      if (!result.success) return null;
      const data = result.data?.data || result.data;
      return data?.url || null;
    } catch (error) {
      clientLogger.error('[ProspectReportPublicService] Failed to resolve short code:', { detail: error });
      return null;
    }
  }
}

export const prospectReportPublicService = ProspectReportPublicService.getInstance();
export default prospectReportPublicService;
