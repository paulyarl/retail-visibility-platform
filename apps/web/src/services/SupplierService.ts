/**
 * Frontend SupplierService
 *
 * Extends AdminApiSingleton for admin supplier management.
 * Calls /api/admin/suppliers endpoints.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface Supplier {
  id: string;
  name: string;
  connection_type: string;
  api_url: string | null;
  api_key_env: string | null;
  active: boolean;
  is_builtin: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface SupplierHealth {
  supplier_id: string;
  supplier_name: string;
  total_catalog_items: number;
  items_with_gtin: number;
  gtin_coverage_pct: number;
  quarantined_count: number;
  mapping_count: number;
  last_updated: string | null;
}

export interface CatalogItem {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_sku: string;
  gtin: string | null;
  name: string;
  brand: string | null;
  description: string | null;
  category: string | null;
  image_url: string | null;
  msrp_cents: number | null;
  attrs: Record<string, any>;
  availability: string;
  updated_at: string;
}

export interface CatalogSearchResult {
  items: CatalogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface BatchIngestRow {
  supplier_sku: string;
  gtin?: string | null;
  name: string;
  brand?: string | null;
  description?: string | null;
  category?: string | null;
  image_url?: string | null;
  msrp_cents?: number | null;
  attrs?: Record<string, any>;
}

export interface BatchIngestResult {
  inserted: number;
  updated: number;
  quarantined: number;
  errors: { row: number; sku: string; error: string }[];
}

export interface QuarantinedItem {
  id: string;
  supplier_id: string;
  raw_payload: Record<string, any>;
  error_code: string;
  error_message: string | null;
  severity: string;
  created_at: string;
  replayed_at: string | null;
}

export interface SupplierInput {
  name: string;
  connection_type: string;
  api_url?: string | null;
  api_key_env?: string | null;
  metadata?: Record<string, any>;
}

export interface SupplierHealthMetric {
  supplier_id: string;
  supplier_name: string;
  active: boolean;
  is_builtin: boolean;
  connection_type: string;
  total_catalog_items: number;
  total_mappings: number;
  items_with_gtin: number;
  gtin_coverage_pct: number;
  success_rate_pct: number;
  dedup_rate_pct: number;
  items_updated_24h: number;
  quarantined_items: number;
  unreplayed_quarantine_24h: number;
  freshness_lag_hours: number | null;
  freshness_alert: boolean;
  last_updated: string | null;
}

export interface HealthDashboard {
  summary: {
    total_suppliers: number;
    active_suppliers: number;
    total_catalog_items: number;
    total_mappings: number;
    total_quarantined: number;
    avg_gtin_coverage_pct: number;
    avg_success_rate_pct: number;
    alerts_count: number;
  };
  suppliers: SupplierHealthMetric[];
}

class SupplierServiceClass extends AdminApiSingleton {
  private static instance: SupplierServiceClass;

  private constructor() {
    super('SupplierService');
  }

  static getInstance(): SupplierServiceClass {
    if (!SupplierServiceClass.instance) {
      SupplierServiceClass.instance = new SupplierServiceClass();
    }
    return SupplierServiceClass.instance;
  }

  async listSuppliers(activeOnly = false): Promise<Supplier[]> {
    const result = await this.makeDefaultRequest<{ suppliers: Supplier[] }>(
      `/api/admin/suppliers${activeOnly ? '?active=true' : ''}`,
      {},
      'admin-suppliers-list',
      this.cacheTTL
    );
    if (!result.success) {
      clientLogger.error('[SupplierService] Failed to list suppliers:', { detail: result.error });
      return [];
    }
    return result.data?.suppliers || [];
  }

  async getSupplier(id: string): Promise<Supplier | null> {
    const result = await this.makeDefaultRequest<{ supplier: Supplier }>(
      `/api/admin/suppliers/${id}`,
      {},
      `admin-supplier-${id}`,
      this.cacheTTL
    );
    if (!result.success) return null;
    return result.data?.supplier || null;
  }

  async createSupplier(input: SupplierInput): Promise<Supplier | null> {
    const result = await this.makeDefaultRequest<{ supplier: Supplier }>(
      '/api/admin/suppliers',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
      `admin-supplier-create`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to create supplier');
    }
    await this.invalidateCache('admin-suppliers*');
    return result.data?.supplier || null;
  }

  async updateSupplier(id: string, input: Partial<SupplierInput> & { active?: boolean }): Promise<Supplier | null> {
    const result = await this.makeDefaultRequest<{ supplier: Supplier }>(
      `/api/admin/suppliers/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
      `admin-supplier-update-${id}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to update supplier');
    }
    await this.invalidateCache('admin-suppliers*');
    await this.invalidateCache(`admin-supplier-${id}*`);
    return result.data?.supplier || null;
  }

  async deleteSupplier(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/admin/suppliers/${id}`,
      { method: 'DELETE' },
      `admin-supplier-delete-${id}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to delete supplier');
    }
    await this.invalidateCache('admin-suppliers*');
  }

  async getSupplierHealth(id: string): Promise<SupplierHealth | null> {
    const result = await this.makeDefaultRequest<{ health: SupplierHealth }>(
      `/api/admin/suppliers/${id}/health`,
      {},
      `admin-supplier-health-${id}`,
      this.cacheTTL
    );
    if (!result.success) return null;
    return result.data?.health || null;
  }

  async getHealthDashboard(): Promise<HealthDashboard | null> {
    const result = await this.makeDefaultRequest<HealthDashboard>(
      '/api/admin/suppliers/health/dashboard',
      {},
      'admin-supplier-health-dashboard',
      this.cacheTTL
    );
    if (!result.success) return null;
    return result.data || null;
  }

  async searchCatalog(
    supplierId: string,
    params: { query?: string; brand?: string; gtin?: string; category?: string; limit?: number; offset?: number } = {}
  ): Promise<CatalogSearchResult> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.append('query', params.query);
    if (params.brand) searchParams.append('brand', params.brand);
    if (params.gtin) searchParams.append('gtin', params.gtin);
    if (params.category) searchParams.append('category', params.category);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const result = await this.makeDefaultRequest<CatalogSearchResult>(
      `/api/admin/suppliers/${supplierId}/catalog?${searchParams}`,
      {},
      `admin-supplier-catalog-${supplierId}-${searchParams.toString()}`,
      2 * 60 * 1000
    );
    if (!result.success) return { items: [], total: 0, limit: 50, offset: 0 };
    return result.data || { items: [], total: 0, limit: 50, offset: 0 };
  }

  async batchIngest(supplierId: string, rows: BatchIngestRow[]): Promise<BatchIngestResult> {
    const result = await this.makeDefaultRequest<BatchIngestResult>(
      `/api/admin/suppliers/${supplierId}/ingest`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      },
      `admin-supplier-ingest-${supplierId}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to ingest catalog rows');
    }
    await this.invalidateCache(`admin-supplier-catalog-${supplierId}*`);
    await this.invalidateCache(`admin-supplier-health-${supplierId}*`);
    return result.data || { inserted: 0, updated: 0, quarantined: 0, errors: [] };
  }

  async getQuarantinedItems(supplierId: string, limit = 50): Promise<QuarantinedItem[]> {
    const result = await this.makeDefaultRequest<{ items: QuarantinedItem[] }>(
      `/api/admin/suppliers/${supplierId}/quarantine?limit=${limit}`,
      {},
      `admin-supplier-quarantine-${supplierId}`,
      this.cacheTTL
    );
    if (!result.success) return [];
    return result.data?.items || [];
  }

  async replayQuarantine(supplierId: string, quarantineId: string): Promise<{ success: boolean; error?: string }> {
    const result = await this.makeDefaultRequest<{ success: boolean; error?: string }>(
      `/api/admin/suppliers/${supplierId}/quarantine/${quarantineId}/replay`,
      { method: 'POST' },
      `admin-supplier-quarantine-replay-${quarantineId}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to replay quarantined item');
    }
    await this.invalidateCache(`admin-supplier-quarantine-${supplierId}*`);
    return result.data || { success: false };
  }
}

export const SupplierService = SupplierServiceClass.getInstance();
export default SupplierService;
