/**
 * Claim QR Scan Service
 *
 * Dedicated service for the /q/, /qw/, /qs/ short-URL redirect pages. Calls
 * the combined resolve + track API endpoint (GET /api/public/qr/claim-scan)
 * which resolves the 6-char short code to the underlying claim token AND
 * records a qr_scan_events row in one request, then returns the token so
 * the page can redirect to /place/claim/{token}.
 *
 * Mirrors ClaimShortCodeService (which only resolves, no tracking) but adds
 * scan tracking so QR analytics stay separable by delivery channel.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export type ClaimQrSurface = 'mail' | 'walkin' | 'social' | 'email';

export class ClaimQrScanService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: ClaimQrScanService;

  private constructor() {
    super('claim-qr-scan-service');
  }

  public static getInstance(): ClaimQrScanService {
    if (!ClaimQrScanService.instance) {
      ClaimQrScanService.instance = new ClaimQrScanService();
    }
    return ClaimQrScanService.instance;
  }

  /**
   * Resolve a 6-char claim short code to the underlying claim token, recording
   * a QR scan event for the given delivery surface in the same request.
   * @param shortCode - The 6-char alphanumeric short code (e.g., "H7FZQJ")
   * @param surface - Delivery channel: 'mail' | 'walkin' | 'social'
   * @returns the claim token string or null if not found / expired
   */
  async resolveAndTrack(shortCode: string, surface: ClaimQrSurface): Promise<string | null> {
    try {
      const normalized = shortCode.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/public/qr/claim-scan/${encodeURIComponent(normalized)}?surface=${surface}`,
        {},
        `claim-qr-scan-${normalized}-${surface}`,
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
      return responseData?.token || null;
    } catch (error) {
      clientLogger.error('[ClaimQrScanService] Failed to resolve + track short code:', { detail: error });
      return null;
    }
  }
}

export const claimQrScanService = ClaimQrScanService.getInstance();
export default ClaimQrScanService;
