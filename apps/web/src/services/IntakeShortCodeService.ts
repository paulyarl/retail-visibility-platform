/**
 * Intake Short Code Service
 *
 * Service for the /i/{shortCode} tracked intake-link redirect page (Profile
 * Repair Fulfillment Sprint W4). Calls the combined resolve + track API
 * endpoint (GET /api/public/intake-scan/:shortCode) which resolves the
 * 6-char intake short code to the CURRENT access token AND records a
 * qr_scan_events row in one request, then returns { token, intakeKind } so
 * the page can redirect to /recovery/intake?token=…
 *
 * Mirrors ClaimQrScanService — short codes survive token reissue, so this is
 * the link outreach templates should emit ({{intake_short_url}}).
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export type IntakeScanSurface = 'sms' | 'email' | 'qr' | 'call';

export class IntakeShortCodeService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: IntakeShortCodeService;

  private constructor() {
    super('intake-short-code-service');
  }

  public static getInstance(): IntakeShortCodeService {
    if (!IntakeShortCodeService.instance) {
      IntakeShortCodeService.instance = new IntakeShortCodeService();
    }
    return IntakeShortCodeService.instance;
  }

  /**
   * Resolve a 6-char intake short code to the current access token, recording
   * a scan event for the given delivery surface in the same request.
   * @param shortCode - The 6-char alphanumeric short code (e.g., "H7FZQJ")
   * @param surface - Delivery channel: 'sms' | 'email' | 'qr' | 'call'
   * @returns { token, intakeKind } or null if not found
   */
  async resolveAndTrack(
    shortCode: string,
    surface: IntakeScanSurface,
  ): Promise<{ token: string; intakeKind: string | null } | null> {
    try {
      const normalized = shortCode.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/public/intake-scan/${encodeURIComponent(normalized)}?surface=${surface}`,
        {},
        `intake-scan-${normalized}-${surface}`,
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
      if (!responseData?.token) return null;
      return { token: responseData.token, intakeKind: responseData.intakeKind ?? null };
    } catch (error) {
      clientLogger.error('[IntakeShortCodeService] Failed to resolve + track short code:', { detail: error });
      return null;
    }
  }
}

export const intakeShortCodeService = IntakeShortCodeService.getInstance();
export default IntakeShortCodeService;
