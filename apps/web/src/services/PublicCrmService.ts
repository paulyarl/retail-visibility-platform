/**
 * Public CRM Service — Frontend Singleton
 *
 * Extends PublicApiSingleton for unauthenticated CRM capability checks on
 * storefront, product, and directory pages.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface PublicCrmOptionsFlags {
  crm_enabled: boolean;
  crm_inquiry_product_enabled: boolean;
  crm_inquiry_storefront_enabled: boolean;
  crm_inquiry_directory_enabled: boolean;
  crm_customer_tickets: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

class PublicCrmService extends PublicApiSingleton {
  private static instance: PublicCrmService;

  private constructor() {
    super('public-crm-service', { ttl: 5 * 60 * 1000 }); // 5 minutes
  }

  getServiceCachePatterns(): string[] {
    return [
      'public-crm-options-*',
    ];
  }

  static getInstance(): PublicCrmService {
    if (!PublicCrmService.instance) {
      PublicCrmService.instance = new PublicCrmService();
    }
    return PublicCrmService.instance;
  }

  // ====================
  // CRM Options (public capability flags)
  // ====================

  async getCrmOptionsFlags(tenantId: string): Promise<PublicCrmOptionsFlags | null> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; settings: PublicCrmOptionsFlags }>(
        `/api/public/tenant/${tenantId}/crm-options`,
        { method: 'GET' },
        `public-crm-options-${tenantId}`,
        this.cacheTTL
      );
      if (!result.success) return null;
      return result.data.settings;
    } catch (err) {
      console.warn('[PublicCrmService] Failed to fetch CRM options flags:', err);
      return null;
    }
  }
}

export const publicCrmService = PublicCrmService.getInstance();
export default PublicCrmService;
