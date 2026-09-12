/**
 * Claim Short Code Service
 *
 * Dedicated service for resolving a 6-char claim short code to the
 * underlying claim token, for the /c/[shortCode] short URL redirect page.
 * Mirrors GalleryShortCodeService (gallery /g/[shortCode] pattern).
 *
 * Decoupled from DirectoryClaimPublicService so the redirect path stays
 * independent of the claim data-fetch layer.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export class ClaimShortCodeService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: ClaimShortCodeService;

  private constructor() {
    super('claim-short-code-service');
  }

  public static getInstance(): ClaimShortCodeService {
    if (!ClaimShortCodeService.instance) {
      ClaimShortCodeService.instance = new ClaimShortCodeService();
    }
    return ClaimShortCodeService.instance;
  }

  /**
   * Resolve a 6-char claim short code to the underlying claim token.
   * @param shortCode - The 6-char alphanumeric short code (e.g., "AB3K9X")
   * @returns the claim token string or null if not found / expired
   */
  async resolveShortCode(shortCode: string): Promise<string | null> {
    try {
      const normalized = shortCode.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/public/directory/claim-code/${encodeURIComponent(normalized)}`,
        {},
        `claim-code-${normalized}`,
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
      clientLogger.error('[ClaimShortCodeService] Failed to resolve short code:', { detail: error });
      return null;
    }
  }
}

export const claimShortCodeService = ClaimShortCodeService.getInstance();
export default ClaimShortCodeService;
