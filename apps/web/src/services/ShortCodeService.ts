/**
 * Short Code Service
 *
 * Dedicated service for resolving 4-char autoId to tenantId
 * for the /s/[autoId] short URL redirect page.
 *
 * Decoupled from ShopsService to avoid coupling between
 * QR redirect architecture and shop browsing features.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export class ShortCodeService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: ShortCodeService;

  private constructor() {
    super('short-code-service');
  }

  public static getInstance(): ShortCodeService {
    if (!ShortCodeService.instance) {
      ShortCodeService.instance = new ShortCodeService();
    }
    return ShortCodeService.instance;
  }

  /**
   * Resolve a 4-char autoId to a tenantId
   * @param autoId - The 4-char alphanumeric autoId (e.g., "ULCW")
   * @returns tenantId string (e.g., "tid-m8ijkrnk") or null if not found
   */
  async resolveTenantId(autoId: string): Promise<string | null> {
    try {
      const normalized = autoId.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/short-code/${encodeURIComponent(normalized)}`,
        {},
        `short-code-${normalized}`,
        0,
        {
          context: AppContext.SHOP,
          isolation: CacheIsolation.SHOP,
        }
      );

      if (!result.success) {
        return null;
      }

      const responseData = result.data?.data || result.data;
      return responseData?.tenantId || null;
    } catch (error) {
      clientLogger.error('[ShortCodeService] Failed to resolve autoId:', { detail: error });
      return null;
    }
  }
}

export const shortCodeService = ShortCodeService.getInstance();
export default ShortCodeService;
