/**
 * Next Steps Singleton Service
 *
 * Tenant-domain service that fetches the backend-driven, tier-and-capability-aware
 * next steps task list from GET /api/tenants/:tenantId/next-steps.
 *
 * Extends TenantApiSingleton for correct auth context, cache isolation, and
 * the cache contract (getServiceCachePatterns / invalidateServiceCaches).
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export type TaskCategory = 'profile' | 'visibility' | 'commerce' | 'engagement' | 'subscription';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface NextStepTask {
  id: string;
  label: string;
  done: boolean;
  link: string;
  category: TaskCategory;
  priority: TaskPriority;
}

class NextStepsSingletonService extends TenantApiSingleton {
  private static instance: NextStepsSingletonService;

  private constructor() {
    super('next-steps-singleton', { ttl: 30 * 1000 });
  }

  public static getInstance(): NextStepsSingletonService {
    if (!NextStepsSingletonService.instance) {
      NextStepsSingletonService.instance = new NextStepsSingletonService();
    }
    return NextStepsSingletonService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['next-steps-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`next-steps-${tenantId}`);
    } else {
      this.invalidateCache('next-steps-*');
    }
  }

  /**
   * Fetch the next steps task list for a tenant.
   * Returns an empty array on error so the UI can degrade gracefully.
   */
  async getNextSteps(tenantId: string): Promise<NextStepTask[]> {
    if (!tenantId) return [];

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: NextStepTask[] }>(
        `/api/tenants/${tenantId}/next-steps`,
        {},
        `next-steps-${tenantId}`,
        this.cacheTTL,
      );

      if (!result.success) {
        clientLogger.error('[NextStepsService] Failed to fetch next steps:', { detail: result.error });
        return [];
      }

      return result.data?.data ?? [];
    } catch (error) {
      clientLogger.error('[NextStepsService] Error fetching next steps:', { detail: error });
      return [];
    }
  }
}

export const nextStepsService = NextStepsSingletonService.getInstance();
