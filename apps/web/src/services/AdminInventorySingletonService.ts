/**
 * Admin Inventory Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached admin inventory operations
 * Manages inventory transfers, location inventory, and platform-wide inventory stats
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

// ========================================
// Transfer Types
// ========================================

export interface InventoryTransfer {
  id: string;
  tenant_id: string;
  source_location_id: string;
  target_location_id: string;
  sku: string;
  product_slug: string;
  quantity: number;
  status: 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
  tracking_number?: string;
  estimated_arrival?: string;
  actual_arrival?: string;
  notes?: string;
  initiated_by: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
  source_location?: {
    id: string;
    name: string;
  };
  target_location?: {
    id: string;
    name: string;
  };
  tenant?: {
    id: string;
    name: string;
  };
}

export interface TransferFilters {
  tenantId?: string;
  status?: InventoryTransfer['status'];
  sourceLocationId?: string;
  targetLocationId?: string;
  sku?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ========================================
// Location Inventory Types
// ========================================

export interface LocationInventoryPool {
  id: string;
  tenant_id: string;
  location_id: string;
  sku: string;
  product_slug: string;
  total_quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  in_transit_quantity: number;
  low_stock_threshold: number;
  reorder_point: number;
  reorder_quantity: number;
  last_updated: string;
  location?: {
    id: string;
    name: string;
  };
  product?: {
    name: string;
    brand: string;
  };
}

export interface LowStockAlert {
  id: string;
  tenant_id: string;
  tenant_name: string;
  location_id: string;
  location_name: string;
  sku: string;
  product_name: string;
  current_stock: number;
  threshold: number;
  severity: 'low' | 'critical' | 'out_of_stock';
  created_at: string;
}

// ========================================
// Stats Types
// ========================================

export interface PlatformInventoryStats {
  totalTenants: number;
  totalLocations: number;
  totalSKUs: number;
  totalInventoryValue: number;
  lowStockItems: number;
  inTransitItems: number;
  pendingTransfers: number;
  completedTransfersToday: number;
  topProductsByStock: Array<{
    product_slug: string;
    name: string;
    total_stock: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    product_count: number;
    total_stock: number;
  }>;
}

export interface TenantInventoryBreakdown {
  tenant_id: string;
  tenant_name: string;
  total_locations: number;
  total_skus: number;
  total_inventory_value: number;
  low_stock_items: number;
  pending_transfers: number;
}

// ========================================
// Service Class
// ========================================

class AdminInventorySingletonService extends AdminApiSingleton {
  private static instance: AdminInventorySingletonService;

  private constructor() {
    super('admin-inventory-singleton');
  }

  public static getInstance(): AdminInventorySingletonService {
    if (!AdminInventorySingletonService.instance) {
      AdminInventorySingletonService.instance = new AdminInventorySingletonService();
    }
    return AdminInventorySingletonService.instance;
  }

  // ========================================
  // Transfer Management
  // ========================================

  /**
   * Get all transfers with filters
   */
  async getTransfers(filters: TransferFilters = {}): Promise<{
    transfers: InventoryTransfer[];
    total: number;
    hasMore: boolean;
  } | null> {
    const params = new URLSearchParams();
    
    if (filters.tenantId) params.set('tenantId', filters.tenantId);
    if (filters.status) params.set('status', filters.status);
    if (filters.sourceLocationId) params.set('sourceLocationId', filters.sourceLocationId);
    if (filters.targetLocationId) params.set('targetLocationId', filters.targetLocationId);
    if (filters.sku) params.set('sku', filters.sku);
    if (filters.startDate) params.set('startDate', filters.startDate);
    if (filters.endDate) params.set('endDate', filters.endDate);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const cachekey = `admin-inventory-transfers:${JSON.stringify(filters)}`;

    const result = await this.makeDefaultRequest<{
      data: InventoryTransfer[];
      total: number;
    }>(
      `/api/admin/inventory-transfers/transfers?${params.toString()}`,
      {},
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get transfers:', { detail: result.error });
      return null;
    }

    const response = result.data;
    if (!response) {
      return null;
    }

    return {
      transfers: response.data,
      total: response.total,
      hasMore: (filters.page || 1) * (filters.limit || 50) < response.total
    };
  }

  /**
   * Get transfer by ID
   */
  async getTransfer(transferId: string): Promise<InventoryTransfer | null> {
    const cachekey = `admin-inventory-transfer:${transferId}`;
    const result = await this.makeDefaultRequest<InventoryTransfer>(
      `/api/admin/inventory-transfers/transfers/${transferId}`,
      {},
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get transfer:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Create a new transfer
   */
  async createTransfer(params: {
    tenantId: string;
    sourceLocationId: string;
    targetLocationId: string;
    sku: string;
    quantity: number;
    notes?: string;
  }): Promise<InventoryTransfer | null> {
    const cachekey = 'admin-inventory-transfer-create';
    const result = await this.makeDefaultRequest<InventoryTransfer>(
      '/api/admin/inventory-transfers/transfers',
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to create transfer:', { detail: result.error });
      return null;
    }

    await this.invalidateTransfersCache();
    return result.data || null;
  }

  /**
   * Approve a transfer (admin override)
   */
  async approveTransfer(transferId: string, notes?: string): Promise<InventoryTransfer | null> {
    const cachekey = `admin-inventory-transfer-approve:${transferId}`;
    const result = await this.makeDefaultRequest<InventoryTransfer>(
      `/api/admin/inventory-transfers/transfers/${transferId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ notes })
      },
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to approve transfer:', { detail: result.error });
      return null;
    }

    await this.invalidateTransfersCache();
    return result.data || null;
  }

  /**
   * Ship a transfer
   */
  async shipTransfer(transferId: string, params: {
    trackingNumber?: string;
    estimatedArrival?: string;
    notes?: string;
  }): Promise<InventoryTransfer | null> {
    const cachekey = `admin-inventory-transfer-ship:${transferId}`;
    const result = await this.makeDefaultRequest<InventoryTransfer>(
      `/api/admin/inventory-transfers/transfers/${transferId}/ship`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to ship transfer:', { detail: result.error });
      return null;
    }

    await this.invalidateTransfersCache();
    return result.data || null;
  }

  /**
   * Receive a transfer
   */
  async receiveTransfer(transferId: string, params: {
    actualQuantity: number;
    notes?: string;
  }): Promise<InventoryTransfer | null> {
    const cachekey = `admin-inventory-transfer-receive:${transferId}`;
    const result = await this.makeDefaultRequest<InventoryTransfer>(
      `/api/admin/inventory-transfers/transfers/${transferId}/receive`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to receive transfer:', { detail: result.error });
      return null;
    }

    await this.invalidateTransfersCache();
    return result.data || null;
  }

  /**
   * Cancel a transfer
   */
  async cancelTransfer(transferId: string, notes?: string): Promise<boolean> {
    const cachekey = `admin-inventory-transfer-cancel:${transferId}`;
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/inventory-transfers/transfers/${transferId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({ notes })
      },
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to cancel transfer:', { detail: result.error });
      return false;
    }

    await this.invalidateTransfersCache();
    return true;
  }

  // ========================================
  // Location Inventory
  // ========================================

  /**
   * Get inventory pools for a location
   */
  async getLocationInventory(locationId: string, filters: {
    tenantId: string;
    lowStockOnly?: boolean;
    sku?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    pools: LocationInventoryPool[];
    total: number;
    hasMore: boolean;
  } | null> {
    const params = new URLSearchParams();
    params.set('tenantId', filters.tenantId);
    if (filters.lowStockOnly) params.set('lowStockOnly', 'true');
    if (filters.sku) params.set('sku', filters.sku);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    const cachekey = `admin-inventory-location:${locationId}:${JSON.stringify(filters)}`;

    const result = await this.makeDefaultRequest<{
      data: LocationInventoryPool[];
      total: number;
    }>(
      `/api/admin/inventory-transfers/locations/${locationId}/inventory?${params.toString()}`,
      {},
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get location inventory:', { detail: result.error });
      return null;
    }

    const response = result.data;
    if (!response) {
      return null;
    }

    return {
      pools: response.data,
      total: response.total,
      hasMore: (filters.page || 1) * (filters.limit || 100) < response.total
    };
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(filters: {
    tenantId?: string;
    locationId?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{
    alerts: LowStockAlert[];
    total: number;
    hasMore: boolean;
  } | null> {
    const params = new URLSearchParams();
    if (filters.tenantId) params.set('tenantId', filters.tenantId);
    if (filters.locationId) params.set('locationId', filters.locationId);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    const cachekey = `admin-inventory-low-stock:${JSON.stringify(filters)}`;

    const result = await this.makeDefaultRequest<{
      data: LowStockAlert[];
      total: number;
    }>(
      `/api/admin/inventory-transfers/alerts/low-stock?${params.toString()}`,
      {},
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get low stock alerts:', { detail: result.error });
      return null;
    }

    const response = result.data;
    if (!response) {
      return null;
    }

    return {
      alerts: response.data,
      total: response.total,
      hasMore: (filters.page || 1) * (filters.limit || 100) < response.total
    };
  }

  // ========================================
  // Platform Statistics
  // ========================================

  /**
   * Get platform-wide inventory statistics
   */
  async getPlatformStats(): Promise<PlatformInventoryStats | null> {
    const result = await this.makeDefaultRequest<PlatformInventoryStats>(
      '/api/admin/inventory/stats',
      {},
      'admin-inventory-stats'
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get platform stats:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get inventory breakdown by tenant
   */
  async getTenantBreakdown(page: number = 1, limit: number = 20): Promise<{
    tenants: TenantInventoryBreakdown[];
    total: number;
    hasMore: boolean;
  } | null> {
    const cachekey = `admin-inventory-by-tenant:${page}:${limit}`;
    const result = await this.makeDefaultRequest<{
      data: TenantInventoryBreakdown[];
      total: number;
    }>(
      `/api/admin/inventory/by-tenant?page=${page}&limit=${limit}`,
      {},
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get tenant breakdown:', { detail: result.error });
      return null;
    }

    const response = result.data;
    if (!response) {
      return null;
    }

    return {
      tenants: response.data,
      total: response.total,
      hasMore: page * limit < response.total
    };
  }

  /**
   * Get inventory by category
   */
  async getCategoryDistribution(): Promise<Array<{
    category: string;
    product_count: number;
    total_stock: number;
  }> | null> {
    const cachekey = 'admin-inventory-by-category';
    const result = await this.makeDefaultRequest<Array<{
      category: string;
      product_count: number;
      total_stock: number;
    }>>(
      '/api/admin/inventory/by-category',
      {},
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get category distribution:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get top products by adoption
   */
  async getTopProducts(limit: number = 10): Promise<Array<{
    product_slug: string;
    name: string;
    brand: string;
    adoption_count: number;
    total_stock: number;
  }> | null> {
    const cachekey = `admin-inventory-top-products:${limit}`;
    const result = await this.makeDefaultRequest<Array<{
      product_slug: string;
      name: string;
      brand: string;
      adoption_count: number;
      total_stock: number;
    }>>(
      `/api/admin/inventory/top-products?limit=${limit}`,
      {},
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to get top products:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * Bulk update inventory
   */
  async bulkUpdateInventory(tenantId: string, updates: Array<{
    locationId: string;
    sku: string;
    totalQuantity?: number;
    availableQuantity?: number;
    reservedQuantity?: number;
    inTransitQuantity?: number;
    lowStockThreshold?: number;
    reorderPoint?: number;
    reorderQuantity?: number;
  }>): Promise<{
    processed: number;
    successful: number;
    failed: number;
    results: Array<{ locationId: string; sku: string; status: string; error?: string }>;
  } | null> {
    const cachekey = 'admin-inventory-bulk-update';
    const result = await this.makeDefaultRequest<{
      processed: number;
      successful: number;
      failed: number;
      results: Array<{ locationId: string; sku: string; status: string; error?: string }>;
    }>(
      '/api/admin/inventory-transfers/inventory/bulk-update',
      {
        method: 'POST',
        body: JSON.stringify({ tenantId, updates })
      },
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to bulk update inventory:', { detail: result.error });
      return null;
    }

    await this.invalidateInventoryCache();
    return result.data || null;
  }

  /**
   * Bulk initiate transfers
   */
  async bulkInitiateTransfers(tenantId: string, transfers: Array<{
    sourceLocationId: string;
    targetLocationId: string;
    sku: string;
    quantity: number;
    notes?: string;
  }>): Promise<{
    initiated: number;
    failed: number;
    results: Array<{ sku: string; status: string; transferId?: string; error?: string }>;
  } | null> {
    const cachekey = 'admin-inventory-bulk-transfers';
    const result = await this.makeDefaultRequest<{
      initiated: number;
      failed: number;
      results: Array<{ sku: string; status: string; transferId?: string; error?: string }>;
    }>(
      '/api/admin/inventory-transfers/transfers/bulk-initiate',
      {
        method: 'POST',
        body: JSON.stringify({ tenantId, transfers })
      },
      cachekey
    );

    if (!result.success) {
      clientLogger.error('[AdminInventory] Failed to bulk initiate transfers:', { detail: result.error });
      return null;
    }

    await this.invalidateTransfersCache();
    return result.data || null;
  }

  // ========================================
  // Cache Invalidation
  // ========================================

  /**
   * Invalidate all inventory cache
   */
  public async invalidateInventoryCache(): Promise<void> {
    await this.invalidateCache('admin-inventory*');
  }

  /**
   * Invalidate transfers cache only
   */
  public async invalidateTransfersCache(): Promise<void> {
    await this.invalidateCache('admin-inventory-transfers*');
  }

  /**
   * Invalidate stats cache only
   */
  public async invalidateStatsCache(): Promise<void> {
    await this.invalidateCache('admin-inventory-stats*');
  }
}

// Export singleton instance
export const adminInventoryService = AdminInventorySingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateInventoryCache = async (): Promise<void> => {
  const service = AdminInventorySingletonService.getInstance();
  await service.invalidateInventoryCache();
};

export const invalidateTransfersCache = async (): Promise<void> => {
  const service = AdminInventorySingletonService.getInstance();
  await service.invalidateTransfersCache();
};
