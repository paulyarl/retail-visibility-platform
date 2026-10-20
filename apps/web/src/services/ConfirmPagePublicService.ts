/**
 * ConfirmPagePublicService — public data + submit for the Four-Act
 * dual-role confirm page. The token is the trust boundary.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface ConfirmFact {
  field?: string;
  label?: string;
  expected?: string;
  actual?: string;
  sources?: string[];
}

export interface ConfirmPageData {
  token: string;
  expired: boolean;
  businessName: string | null;
  city: string | null;
  state: string | null;
  fact: ConfirmFact | null;
  disputed: boolean;
  galleryUrl: string | null;
  claimUrl: string | null;
  placeUrl: string | null;
  seedStatus: string | null;
  productId: string | null;
}

export interface ConfirmPageSubmitInput {
  operational?: boolean;
  painOutcome?: 'confirmed' | 'disputed' | 'not_asked';
  followUpPermission?: 'yes' | 'no' | 'not_asked';
  notes?: string;
}

export class ConfirmPagePublicService extends PublicApiSingleton {
  protected defaultContext: AppContext = AppContext.SHOP;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;

  private static instance: ConfirmPagePublicService;

  private constructor() {
    super('confirm-page-public-service');
  }

  public static getInstance(): ConfirmPagePublicService {
    if (!ConfirmPagePublicService.instance) {
      ConfirmPagePublicService.instance = new ConfirmPagePublicService();
    }
    return ConfirmPagePublicService.instance;
  }

  async get(token: string): Promise<ConfirmPageData | null> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/marketing/confirm/${encodeURIComponent(token)}`,
        {},
        undefined,
        0,
        { context: AppContext.SHOP, isolation: CacheIsolation.SHOP },
      );
      if (!result.success) return null;
      return (result.data ?? null) as ConfirmPageData | null;
    } catch (error) {
      clientLogger.error('[ConfirmPagePublicService] Failed to load confirm page:', { detail: error });
      return null;
    }
  }

  async submit(token: string, input: ConfirmPageSubmitInput): Promise<boolean> {
    try {
      const result = await this.makeDefaultRequest<any>(
        `/api/public/marketing/confirm/${encodeURIComponent(token)}`,
        { method: 'POST', body: JSON.stringify(input) },
        undefined,
        0,
        { context: AppContext.SHOP, isolation: CacheIsolation.SHOP },
      );
      return !!result.success;
    } catch (error) {
      clientLogger.error('[ConfirmPagePublicService] Failed to submit confirm page:', { detail: error });
      return false;
    }
  }
}

export const confirmPagePublicService = ConfirmPagePublicService.getInstance();
