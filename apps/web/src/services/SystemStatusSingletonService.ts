/**
 * System Status Singleton Service
 *
 * Fetches the backend-driven, capability-aware system status summary
 * from GET /api/tenants/:tenantId/system-status.
 *
 * Extends TenantApiSingleton for correct auth context, cache isolation,
 * and the cache contract (getServiceCachePatterns / invalidateServiceCaches).
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export type StatusLevel = 'ok' | 'warning' | 'error' | 'inactive';

export interface SystemStatusItem {
  key: string;
  label: string;
  status: StatusLevel;
  detail?: string;
  link?: string;
}

export interface SystemStatusData {
  tenant_id: string;
  overall: 'operational' | 'attention' | 'critical';
  subscription_status: string;
  is_read_only: boolean;
  items: SystemStatusItem[];
}

class SystemStatusSingletonService extends TenantApiSingleton {
  private static instance: SystemStatusSingletonService;

  private constructor() {
    super('system-status-singleton', { ttl: 30 * 1000 });
  }

  public static getInstance(): SystemStatusSingletonService {
    if (!SystemStatusSingletonService.instance) {
      SystemStatusSingletonService.instance = new SystemStatusSingletonService();
    }
    return SystemStatusSingletonService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['system-status-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`system-status-${tenantId}`);
    } else {
      this.invalidateCache('system-status-*');
    }
  }

  /**
   * Fetch the system status summary for a tenant.
   * Returns null on error so the UI can degrade gracefully.
   */
  async getSystemStatus(tenantId: string): Promise<SystemStatusData | null> {
    if (!tenantId) return null;

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: SystemStatusData }>(
        `/api/tenants/${tenantId}/system-status`,
        {},
        `system-status-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success) {
        console.error('[SystemStatusService] Failed to fetch system status:', (result as any).error);
        return null;
      }

      return (result as any).data?.data ?? null;
    } catch (error) {
      console.error('[SystemStatusService] Error fetching system status:', error);
      return null;
    }
  }
}

export const systemStatusService = SystemStatusSingletonService.getInstance();
