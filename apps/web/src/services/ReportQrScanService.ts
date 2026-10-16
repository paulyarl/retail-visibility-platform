/**
 * Report QR Scan Service
 *
 * Dedicated service for the /r/, /rt/, /re/, /rs/, /rp/, /rb/ short-URL redirect
 * pages. Calls the combined resolve + track API endpoint (GET
 * /api/public/r/report-scan/{shortCode}?surface={surface}) which resolves the
 * 6-char short code to the seed_id AND records a qr_scan_events row in one
 * request, then returns the seed_id so the page can redirect to
 * /seed-report/{seedId}.
 *
 * Mirrors ClaimQrScanService but for report delivery surfaces.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

// 'banner' is a report-QR surface but NOT a delivery channel — it records
// 'report_banner' scans and never writes a delivered → viewed touch.
// 'claimed' is the post-claim sibling ('report_claimed'), also non-delivery.
export type ReportQrSurface =
  | 'in_person'
  | 'text'
  | 'email'
  | 'social'
  | 'phone'
  | 'banner'
  | 'claimed';

export class ReportQrScanService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: ReportQrScanService;

  private constructor() {
    super('report-qr-scan-service');
  }

  public static getInstance(): ReportQrScanService {
    if (!ReportQrScanService.instance) {
      ReportQrScanService.instance = new ReportQrScanService();
    }
    return ReportQrScanService.instance;
  }

  /**
   * Resolve a 6-char short code to the seed_id, recording a QR scan event
   * for the given report delivery surface in the same request.
   * @param shortCode - The 6-char alphanumeric short code (e.g., "H7FZQJ")
   * @param surface - Report QR surface: 'in_person' | 'text' | 'email' | 'social' | 'phone' | 'banner'
   * @returns the seed_id string or null if not found / expired
   */
  async resolveAndTrack(shortCode: string, surface: ReportQrSurface): Promise<string | null> {
    try {
      const normalized = shortCode.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/public/r/report-scan/${encodeURIComponent(normalized)}?surface=${surface}`,
        {},
        `report-qr-scan-${normalized}-${surface}`,
        0,
        {
          context: AppContext.SHOP,
          isolation: CacheIsolation.SHOP,
        },
      );

      if (!result.success) {
        return null;
      }

      const responseData = result.data?.data || result.data;
      return responseData?.seedId || null;
    } catch (error) {
      clientLogger.error('[ReportQrScanService] Failed to resolve + track short code:', { detail: error });
      return null;
    }
  }

  /**
   * Seed-id variant for the /r/seed/{seedId}/{channel} redirect page — the
   * frontend mirror of the API redirect. No code resolution is needed (the
   * seed id is already the address); the endpoint verifies the seed exists,
   * records the qr_scan_events row under the channel's surface, and returns
   * the seed id. Powers the tracked report links on surfaces that have no
   * claim-token short code (uninvited seeds, claimed listings).
   * @param seedId - The directory_presence_seeds id (e.g., "dps-329R-nf8nmoao")
   * @param surface - Report QR surface
   * @returns the seed_id string or null if the seed doesn't exist
   */
  async resolveSeedAndTrack(seedId: string, surface: ReportQrSurface): Promise<string | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/r/report-seed-scan/${encodeURIComponent(seedId)}?surface=${surface}`,
        {},
        `report-qr-seed-scan-${seedId}-${surface}`,
        0,
        {
          context: AppContext.SHOP,
          isolation: CacheIsolation.SHOP,
        },
      );

      if (!result.success) {
        return null;
      }

      const responseData = result.data?.data || result.data;
      return responseData?.seedId || null;
    } catch (error) {
      clientLogger.error('[ReportQrScanService] Failed to track seed scan:', { detail: error });
      return null;
    }
  }
}

export const reportQrScanService = ReportQrScanService.getInstance();
export default ReportQrScanService;
