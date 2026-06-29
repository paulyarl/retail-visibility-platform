import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface ReturnRequest {
  id: string;
  order_id: string;
  customer_email: string;
  customer_name: string | null;
  reason: string;
  reason_detail: string | null;
  items: Array<{ product_id: string; product_name: string; quantity: number; price_cents: number }>;
  refund_amount_cents: number;
  status: string;
  customer_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

export interface ReturnSummary {
  requested: number;
  approved: number;
  rejected: number;
  completed: number;
  total: number;
  totalRefundCents: number;
}

class ReturnsServiceClass extends TenantApiSingleton {
  private static instance: ReturnsServiceClass;

  private constructor() {
    super('returns-singleton', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): ReturnsServiceClass {
    if (!ReturnsServiceClass.instance) {
      ReturnsServiceClass.instance = new ReturnsServiceClass();
    }
    return ReturnsServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['returns-list-*', 'returns-summary-*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`returns-list-${tenantId}`);
      this.invalidateCache(`returns-summary-${tenantId}`);
    }
  }

  async listReturns(tenantId: string, status?: string, limit: number = 50): Promise<ReturnRequest[]> {
    const statusParam = status ? `&status=${status}` : '';
    const result = await this.makeDefaultRequest<{ requests: ReturnRequest[] }>(
      `/api/tenants/${tenantId}/returns?limit=${limit}${statusParam}`,
      {},
      `returns-list-${tenantId}-${status || 'all'}-${limit}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return [];
    }
    return result.data.requests || [];
  }

  async getSummary(tenantId: string): Promise<ReturnSummary | null> {
    const result = await this.makeDefaultRequest<ReturnSummary>(
      `/api/tenants/${tenantId}/returns/summary`,
      {},
      `returns-summary-${tenantId}`,
      this.cacheTTL,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success || !result.data) {
      return null;
    }
    return result.data;
  }

  async actionReturn(tenantId: string, requestId: string, action: 'approve' | 'reject' | 'complete'): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/tenants/${tenantId}/returns/${requestId}/${action}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' } },
      undefined,
      undefined,
      { context: this.defaultContext, isolation: this.defaultIsolation, tenantId }
    );
    if (!result.success) {
      const errMsg = typeof result.error === 'string' ? result.error : result.error?.message;
      throw new Error(errMsg || `Failed to ${action} return`);
    }
    await this.invalidateServiceCaches(tenantId);
    return true;
  }
}

export const ReturnsService = ReturnsServiceClass.getInstance();
export default ReturnsService;
