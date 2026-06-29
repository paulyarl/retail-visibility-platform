/**
 * Badge Suggestions Service (Frontend Singleton)
 *
 * Fetches auto-promotion suggestions from the backend.
 * These are products that should be assigned or removed badges based on
 * declarative rules in the featured_type_registry.
 * Extends TenantApiSingleton for automatic auth, caching, and cache invalidation.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface BadgeSuggestion {
  inventoryItemId: string;
  badgeKey: string;
  reason: string;
}

export interface BadgeConflict {
  inventoryItemId: string;
  badgeKey: string;
  conflictsWith: string[];
}

export interface BadgeSuggestionsResponse {
  toAssign: BadgeSuggestion[];
  toRemove: BadgeSuggestion[];
  conflicts: BadgeConflict[];
  summary: {
    totalSuggestions: number;
    assignCount: number;
    removeCount: number;
    conflictCount: number;
  };
}

class BadgeSuggestionsServiceClass extends TenantApiSingleton {
  private static instance: BadgeSuggestionsServiceClass;

  private constructor() {
    super('badge-suggestions-singleton', { ttl: 60_000 });
  }

  public static getInstance(): BadgeSuggestionsServiceClass {
    if (!BadgeSuggestionsServiceClass.instance) {
      BadgeSuggestionsServiceClass.instance = new BadgeSuggestionsServiceClass();
    }
    return BadgeSuggestionsServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['badge-suggestions-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`badge-suggestions-${tenantId}`);
    }
  }

  async getSuggestions(tenantId: string): Promise<BadgeSuggestionsResponse> {
    const result = await this.makeDefaultRequest<BadgeSuggestionsResponse>(
      `/api/tenants/${tenantId}/badge-suggestions`,
      {},
      `badge-suggestions-${tenantId}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || 'Failed to fetch badge suggestions');
    }
    return result.data;
  }
}

export const badgeSuggestionsService = BadgeSuggestionsServiceClass.getInstance();
export default badgeSuggestionsService;
