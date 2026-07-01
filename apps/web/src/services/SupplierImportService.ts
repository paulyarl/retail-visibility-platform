/**
 * Frontend SupplierImportService
 *
 * Extends TenantApiSingleton for tenant-scoped supplier catalog operations.
 * Calls /api/tenants/:tenantId/suppliers/* endpoints.
 */

import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface TenantSupplier {
  id: string;
  name: string;
  connection_type: string;
  active: boolean;
  is_builtin: boolean;
}

export interface TenantCatalogItem {
  id: string;
  supplier_id: string;
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
}

export interface TenantCatalogSearchResult {
  items: TenantCatalogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ImportSelection {
  supplier_id: string;
  supplier_sku: string;
  overrides?: {
    name?: string;
    price_cents?: number;
    stock?: number;
    image_url?: string;
  };
}

export interface ConflictReport {
  conflicts: {
    supplier_id: string;
    supplier_sku: string;
    state: 'can_import' | 'already_in_catalog' | 'gtin_conflict' | 'discontinued';
    existing_item_id?: string;
    existing_sku?: string;
    message: string;
  }[];
  summary: {
    can_import: number;
    already_in_catalog: number;
    gtin_conflict: number;
    discontinued: number;
  };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  created_item_ids: string[];
  errors: { supplier_sku: string; error: string }[];
}

export interface SupplierMapping {
  id: string;
  tenant_id: string;
  supplier_id: string;
  supplier_sku: string;
  inventory_item_id: string;
  sync_mode: 'manual' | 'auto';
  last_sync: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string;
  inventory_item_name?: string;
  inventory_item_sku?: string;
}

class SupplierImportServiceClass extends TenantApiSingleton {
  private static instance: SupplierImportServiceClass;

  private constructor() {
    super('SupplierImportService');
  }

  static getInstance(): SupplierImportServiceClass {
    if (!SupplierImportServiceClass.instance) {
      SupplierImportServiceClass.instance = new SupplierImportServiceClass();
    }
    return SupplierImportServiceClass.instance;
  }

  public getServiceCachePatterns(): string[] {
    return [
      'supplier-import-service*',
      'tenant-suppliers*',
      'tenant-catalog*',
      'supplier-mappings*',
    ];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCache('supplier-import-service*');
    await this.invalidateCache('tenant-suppliers*');
    await this.invalidateCache('tenant-catalog*');
    await this.invalidateCache('supplier-mappings*');
  }

  async listSuppliers(tenantId: string): Promise<TenantSupplier[]> {
    const result = await this.makeDefaultRequest<{ suppliers: TenantSupplier[] }>(
      `/api/tenants/${tenantId}/suppliers`,
      {},
      `tenant-suppliers-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) {
      console.error('[SupplierImportService] Failed to list suppliers:', result.error);
      return [];
    }
    return result.data?.suppliers || [];
  }

  async searchCatalog(
    tenantId: string,
    params: { supplierId?: string; query?: string; brand?: string; gtin?: string; category?: string; limit?: number; offset?: number } = {}
  ): Promise<TenantCatalogSearchResult> {
    const searchParams = new URLSearchParams();
    if (params.supplierId) searchParams.append('supplierId', params.supplierId);
    if (params.query) searchParams.append('query', params.query);
    if (params.brand) searchParams.append('brand', params.brand);
    if (params.gtin) searchParams.append('gtin', params.gtin);
    if (params.category) searchParams.append('category', params.category);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.offset) searchParams.append('offset', params.offset.toString());

    const result = await this.makeDefaultRequest<TenantCatalogSearchResult>(
      `/api/tenants/${tenantId}/suppliers/catalog/search?${searchParams}`,
      {},
      `tenant-catalog-${tenantId}-${searchParams.toString()}`,
      2 * 60 * 1000
    );
    if (!result.success) return { items: [], total: 0, limit: 50, offset: 0 };
    return result.data || { items: [], total: 0, limit: 50, offset: 0 };
  }

  async lookupByBarcode(tenantId: string, gtin: string, supplierId?: string): Promise<TenantCatalogItem[]> {
    const params = new URLSearchParams({ gtin });
    if (supplierId) params.append('supplierId', supplierId);

    const result = await this.makeDefaultRequest<{ items: TenantCatalogItem[] }>(
      `/api/tenants/${tenantId}/suppliers/catalog/lookup?${params}`,
      {},
      `tenant-catalog-lookup-${tenantId}-${gtin}`,
      2 * 60 * 1000
    );
    if (!result.success) return [];
    return result.data?.items || [];
  }

  async checkConflicts(tenantId: string, selections: ImportSelection[]): Promise<ConflictReport> {
    const result = await this.makeDefaultRequest<ConflictReport>(
      `/api/tenants/${tenantId}/suppliers/import/check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      },
      `tenant-import-check-${tenantId}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to check conflicts');
    }
    return result.data || { conflicts: [], summary: { can_import: 0, already_in_catalog: 0, gtin_conflict: 0, discontinued: 0 } };
  }

  async executeImport(tenantId: string, selections: ImportSelection[]): Promise<ImportResult> {
    const result = await this.makeDefaultRequest<ImportResult>(
      `/api/tenants/${tenantId}/suppliers/import`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      },
      `tenant-import-execute-${tenantId}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to execute import');
    }
    await this.invalidateServiceCaches(tenantId);
    return result.data || { imported: 0, skipped: 0, created_item_ids: [], errors: [] };
  }

  async getMappings(tenantId: string, supplierId?: string): Promise<SupplierMapping[]> {
    const params = new URLSearchParams();
    if (supplierId) params.append('supplierId', supplierId);

    const result = await this.makeDefaultRequest<{ mappings: SupplierMapping[] }>(
      `/api/tenants/${tenantId}/suppliers/mappings?${params}`,
      {},
      `supplier-mappings-${tenantId}`,
      this.cacheTTL
    );
    if (!result.success) return [];
    return result.data?.mappings || [];
  }

  async updateSyncMode(tenantId: string, mappingId: string, syncMode: 'manual' | 'auto'): Promise<SupplierMapping | null> {
    const result = await this.makeDefaultRequest<{ mapping: SupplierMapping }>(
      `/api/tenants/${tenantId}/suppliers/mappings/${mappingId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_mode: syncMode }),
      },
      `supplier-mapping-update-${mappingId}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to update sync mode');
    }
    await this.invalidateCache(`supplier-mappings-${tenantId}*`);
    return result.data?.mapping || null;
  }

  async unlinkMapping(tenantId: string, mappingId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/tenants/${tenantId}/suppliers/mappings/${mappingId}`,
      { method: 'DELETE' },
      `supplier-mapping-unlink-${mappingId}`
    );
    if (!result.success) {
      throw result.error || new Error('Failed to unlink mapping');
    }
    await this.invalidateCache(`supplier-mappings-${tenantId}*`);
  }
}

export const SupplierImportService = SupplierImportServiceClass.getInstance();
export default SupplierImportService;
