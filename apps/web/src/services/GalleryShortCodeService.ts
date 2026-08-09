/**
 * Gallery Short Code Service
 *
 * Dedicated service for resolving a 6-char gallery short code to the
 * underlying preview token + token type, for the /g/[shortCode] short
 * URL redirect page. Mirrors ShortCodeService (coupon /s/[autoId] pattern).
 *
 * Decoupled from DiagnosticGalleryPublicService so the redirect path
 * stays independent of the gallery data-fetch layer.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface ResolvedGalleryShortCode {
  token: string;
  tokenType: string;
  isMultiGallery: boolean;
}

export class GalleryShortCodeService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: GalleryShortCodeService;

  private constructor() {
    super('gallery-short-code-service');
  }

  public static getInstance(): GalleryShortCodeService {
    if (!GalleryShortCodeService.instance) {
      GalleryShortCodeService.instance = new GalleryShortCodeService();
    }
    return GalleryShortCodeService.instance;
  }

  /**
   * Resolve a 6-char gallery short code to { token, tokenType, isMultiGallery }.
   * @param shortCode - The 6-char alphanumeric short code (e.g., "AB3K9X")
   * @returns resolved token info or null if not found / expired
   */
  async resolveShortCode(shortCode: string): Promise<ResolvedGalleryShortCode | null> {
    try {
      const normalized = shortCode.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/gallery-code/${encodeURIComponent(normalized)}`,
        {},
        `gallery-code-${normalized}`,
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
      if (!responseData?.token) {
        return null;
      }
      return {
        token: responseData.token,
        tokenType: responseData.tokenType,
        isMultiGallery: !!responseData.isMultiGallery,
      };
    } catch (error) {
      clientLogger.error('[GalleryShortCodeService] Failed to resolve short code:', { detail: error });
      return null;
    }
  }
}

export const galleryShortCodeService = GalleryShortCodeService.getInstance();
export default GalleryShortCodeService;
