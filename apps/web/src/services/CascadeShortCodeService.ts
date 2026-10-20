/**
 * Cascade Short Code Service
 *
 * Resolves a cascade tagged short code (gallery/confirm token) and records
 * the scan on the matching `cascade_*` surface. Mirrors GalleryShortCodeService.
 *
 * Spec: docs/LocalBiz/FOUR_ACT_OUTREACH_CASCADE_SPEC.md §7 / Phase 3.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export type CascadeQrSurface = 'cascade_postcard' | 'cascade_confirm' | 'cascade_gallery';

export class CascadeShortCodeService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: CascadeShortCodeService;

  private constructor() {
    super('cascade-short-code-service');
  }

  public static getInstance(): CascadeShortCodeService {
    if (!CascadeShortCodeService.instance) {
      CascadeShortCodeService.instance = new CascadeShortCodeService();
    }
    return CascadeShortCodeService.instance;
  }

  /** Resolve + track the code, returning the destination URL or null. */
  async resolveAndTrack(code: string, surface: CascadeQrSurface): Promise<string | null> {
    try {
      const normalized = code.toUpperCase();
      const result = await this.makeDefaultRequest<any>(
        `/api/public/cascade/scan/${encodeURIComponent(normalized)}?surface=${encodeURIComponent(surface)}`,
        {},
        undefined,
        0,
        {
          context: AppContext.SHOP,
          isolation: CacheIsolation.SHOP,
        },
      );

      if (!result.success) return null;
      const data = result.data?.data ?? result.data;
      return data?.url ?? null;
    } catch (error) {
      clientLogger.error('[CascadeShortCodeService] Failed to resolve short code:', { detail: error });
      return null;
    }
  }
}

export const cascadeShortCodeService = CascadeShortCodeService.getInstance();
