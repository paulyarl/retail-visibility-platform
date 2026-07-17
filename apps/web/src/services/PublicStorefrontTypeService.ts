/**
 * Public Storefront Type Service
 *
 * Extends PublicApiSingleton to provide resolved storefront type settings
 * for public pages (storefront, directory).
 * Uses the /api/public/tenant/:tenantId/storefront-type endpoint.
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export type StorefrontTypeValue = 'online' | 'retail' | 'service' | 'social' | 'flexible' | 'none';

export interface StorefrontTypeSettings {
  storefront_type_enabled: boolean;
  selected_storefront_type: StorefrontTypeValue | null;
}

export interface StorefrontTypeTierState {
  enabled: boolean;
  type: StorefrontTypeValue;
  effectiveType: StorefrontTypeValue;
  isFlexible: boolean;
  allowedTypes: StorefrontTypeValue[];
  hasMerchantSelection: boolean;
  merchantPreferences: {
    storefront_type_enabled: boolean;
    selected_storefront_type: StorefrontTypeValue;
  };
  features: Record<string, boolean>;
}

export interface StorefrontTypeResponse {
  settings: StorefrontTypeSettings;
  tierState: StorefrontTypeTierState;
}

class PublicStorefrontTypeService extends PublicApiSingleton {
  private static instance: PublicStorefrontTypeService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes

  protected constructor() {
    super('public-storefront-type', {
      ttl: 15 * 60 * 1000,
    });
  }

  public static getInstance(): PublicStorefrontTypeService {
    if (!PublicStorefrontTypeService.instance) {
      PublicStorefrontTypeService.instance = new PublicStorefrontTypeService();
    }
    return PublicStorefrontTypeService.instance;
  }

  /**
   * Get storefront type settings for a tenant.
   * Returns merchant preferences merged with tier capabilities.
   */
  async getStorefrontTypeSettings(tenantId: string): Promise<StorefrontTypeResponse | null> {
    if (!tenantId) {
      clientLogger.error('[PublicStorefrontType] getStorefrontTypeSettings: tenantId is required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; settings: StorefrontTypeSettings; tierState: StorefrontTypeTierState }>(
        `/api/public/tenant/${tenantId}/storefront-type`,
        {},
        `storefront-type-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        clientLogger.error('[PublicStorefrontType] Failed to get settings:', { detail: result.error });
        return null;
      }

      if (!result.data) return null;

      return {
        settings: result.data.settings,
        tierState: result.data.tierState,
      };
    } catch (error) {
      clientLogger.error('[PublicStorefrontType] Failed to get settings:', { detail: error });
      return null;
    }
  }
  async getStorefrontTypeState(tenantId: string): Promise<{
    storefront_type_enabled: boolean;
    selected_storefront_type: string;
  } | null> {
    try {
      if (!tenantId) return null;
      const result = await this.getStorefrontTypeSettings(tenantId);
      const s = result?.settings;
      return s ? {
        storefront_type_enabled: s.storefront_type_enabled !== false,
        selected_storefront_type: s.selected_storefront_type || 'online',
      } : null;
    } catch (error) {
      clientLogger.error('[getStorefrontTypeSettings] Failed to get storefront type settings:', { detail: error });
      return null;
    }
  }
}

/**
 * Get storefront type settings for a tenant.
 * Returns merchant preferences merged with tier capabilities.
 */

export const publicStorefrontTypeService = PublicStorefrontTypeService.getInstance();
