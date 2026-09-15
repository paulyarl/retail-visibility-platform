/**
 * Report QR Scan Service
 *
 * Dedicated service for the /r/, /rt/, /re/, /rs/, /rp/ short-URL redirect
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

export type ReportQrSurface = 'in_person' | 'text' | 'email' | 'social' | 'phone';

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
   * @param surface - Delivery channel: 'in_person' | 'text' | 'email' | 'social' | 'phone'
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
}

export const reportQrScanService = ReportQrScanService.getInstance();
export default ReportQrScanService;
