/**
 * Inventory Transfer Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached inventory transfer operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { safeTransformToCamel } from '@/utils/case-transform';

// Types
export interface InventoryTransfer {
  id: string;
  tenantId: string;
  sourceLocationId: string;
  targetLocationId: string;
  sku: string;
  quantity: number;
  status: 'pending' | 'approved' | 'shipped' | 'received' | 'cancelled';
  initiatedBy: string;
  initiatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  shippedBy?: string;
  shippedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  notes?: string;
  metadata?: any;
  trackingNumber?: string;
  estimatedArrival?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationInventory {
  locationId: string;
  sku: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  inTransitQuantity: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastUpdated: string;
}

export interface TransferActionData {
  trackingNumber?: string;
  estimatedArrival?: string;
  actualQuantity?: number;
  notes?: string;
}

// ====================
// INVENTORY TRANSFER SINGLETON
// ====================

export class InventoryTransferService extends TenantApiSingleton {
  public getServiceCachePatterns(): string[] {
    return ['transfers-*', 'inventory-*', 'low-stock-*', 'initiate-transfer-*', 'approve-transfer-*', 'ship-transfer-*', 'receive-transfer-*', 'cancel-transfer-*'];
  }
  
  public invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    const patterns = this.getServiceCachePatterns();
    if (tenantId) {
      return this.invalidateCachePattern(`*-${tenantId}`);
    }
    return Promise.resolve();
  }

  private static instance: InventoryTransferService;

  private constructor() {
    super('inventory-transfer-service');
  }

  static getInstance(): InventoryTransferService {
    if (!InventoryTransferService.instance) {
      InventoryTransferService.instance = new InventoryTransferService();
    }
    return InventoryTransferService.instance;
  }

  /**
   * Get all inventory transfers for current tenant
   */
  async getTransfers(tenantId: string): Promise<InventoryTransfer[]> {
    try {
      console.log('[InventoryTransferService] Fetching transfers for tenant:', tenantId);
      const url = `/api/admin/inventory-transfers/transfers`;
      console.log('[InventoryTransferService] Request URL:', url);
      
      const result = await this.makeDefaultRequest<{ success: boolean; data: InventoryTransfer[] }>(
        `${url}?tenantId=${tenantId}`,
        {
          method: 'GET'
        },
        `transfers-${tenantId}`,
        undefined,
        {
          tenantId
        }
      );

      if (!result.success || !result.data) {
        console.error('[InventoryTransferService] Transfers API Response Error:', {
          success: result.success,
          data: result.data,
          error: result.error,
          status: result.status
        });
        throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch transfers');
      }

      console.log('[InventoryTransferService] Raw transfers data:', result.data);
      
      // Handle the actual API response structure: { success: true, data: { transfers: [...] } }
      let transfersData = [];
      // The actual response is nested: result.data.data contains the transfers
      const dataObj = (result.data as any)?.data;
      if (dataObj && typeof dataObj === 'object' && dataObj.transfers && Array.isArray(dataObj.transfers)) {
        transfersData = dataObj.transfers;
        console.log('[InventoryTransferService] Successfully extracted transfers array:', transfersData.length, 'items');
      } else if (Array.isArray(result.data)) {
        // Fallback if API changes to return array directly
        transfersData = result.data;
        console.log('[InventoryTransferService] Using direct array fallback:', transfersData.length, 'items');
      } else {
        console.warn('[InventoryTransferService] Unexpected transfers data structure:', result.data);
        transfersData = [];
      }

      return transfersData.map((transfer: any) => safeTransformToCamel(transfer));
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
      throw error;
    }
  }

  /**
   * Get inventory for a specific location
   */
  async getLocationInventory(tenantId: string, locationId: string): Promise<LocationInventory[]> {
    try {
      const cacheBuster = Date.now();
      const result = await this.makeDefaultRequest<{ success: boolean; data: { pools: LocationInventory[], total: number } }>(
        `/api/tenant/inventory-transfers/locations/${locationId}/inventory?_t=${cacheBuster}`,
        {
          method: 'GET'
        },
        `inventory-${locationId}-${tenantId}-${cacheBuster}`, // Add timestamp to avoid stale cache
        60000, // 1 minute TTL instead of default
        {
          tenantId: `${tenantId}`
        }
      );

      if (!result.success || !result.data) {
        console.error('[InventoryTransferService] Inventory API Response Error:', {
          success: result.success,
          data: result.data,
          error: result.error,
          status: result.status
        });
        throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch inventory');
      }

      console.log('[InventoryTransferService] Raw inventory data:', result.data);
      
      // Handle the actual API response structure: { success: true, data: { pools: [...], total: N } }
      let inventoryData = [];
      // The actual response is: result.data.pools contains the pools (not result.data.data.pools)
      const dataObj = result.data as any;
      console.log('[InventoryTransferService] dataObj type:', typeof dataObj);
      console.log('[InventoryTransferService] dataObj keys:', Object.keys(dataObj || {}));
      console.log('[InventoryTransferService] dataObj.pools exists:', !!dataObj?.pools);
      console.log('[InventoryTransferService] dataObj.pools type:', typeof dataObj?.pools);
      console.log('[InventoryTransferService] dataObj.pools isArray:', Array.isArray(dataObj?.pools));
      console.log('[InventoryTransferService] dataObj:', JSON.stringify(dataObj, null, 2));
      
      if (dataObj && typeof dataObj === 'object' && dataObj.pools && Array.isArray(dataObj.pools)) {
        inventoryData = dataObj.pools;
        console.log('[InventoryTransferService] Successfully extracted pools array:', inventoryData.length, 'items');
      } else if (Array.isArray(result.data)) {
        // Fallback if API changes to return array directly
        inventoryData = result.data;
        console.log('[InventoryTransferService] Using direct array fallback:', inventoryData.length, 'items');
      } else {
        console.warn('[InventoryTransferService] Unexpected inventory data structure:', result.data);
        inventoryData = [];
      }

      return inventoryData.map((item: any) => safeTransformToCamel(item));
    } catch (error) {
      console.error('Failed to fetch location inventory:', error);
      throw error;
    }
  }

  /**
   * Initiate a new transfer
   */
  async initiateTransfer(
    tenantId: string,
    sourceLocationId: string,
    targetLocationId: string,
    sku: string,
    quantity: number,
    notes?: string
  ): Promise<InventoryTransfer> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: InventoryTransfer }>(
        `/api/admin/inventory-transfers/transfers/initiate`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantId
          },
          body: JSON.stringify({
            sourceLocationId,
            targetLocationId,
            sku,
            quantity,
            notes
          }),
        },
        `initiate-transfer-${Date.now()}`,
        undefined,
        {
          tenantId: `${tenantId}`
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to initiate transfer');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      console.error('Failed to initiate transfer:', error);
      throw error;
    }
  }

  /**
   * Approve a transfer
   */
  async approveTransfer(transferId: string, tenantId: string, notes?: string): Promise<InventoryTransfer> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: InventoryTransfer }>(
        `/api/admin/inventory-transfers/transfers/${transferId}/approve`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantId
          },
          body: JSON.stringify({ notes })
        },
        `approve-transfer-${transferId}`,
        undefined,
        {
          tenantId: `${tenantId}`
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to approve transfer');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      console.error('Failed to approve transfer:', error);
      throw error;
    }
  }

  /**
   * Ship a transfer
   */
  async shipTransfer(
    transferId: string,
    tenantId: string,
    trackingNumber: string,
    estimatedArrival: string,
    notes?: string
  ): Promise<InventoryTransfer> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: InventoryTransfer }>(
        `/api/admin/inventory-transfers/transfers/${transferId}/ship`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantId
          },
          body: JSON.stringify({
            trackingNumber,
            estimatedArrival,
            notes
          })
        },
        `ship-transfer-${transferId}`,
        undefined,
        {
          tenantId: `${tenantId}`
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to ship transfer');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      console.error('Failed to ship transfer:', error);
      throw error;
    }
  }

  /**
   * Receive a transfer
   */
  async receiveTransfer(
    transferId: string,
    tenantId: string,
    actualQuantity: number,
    notes?: string
  ): Promise<InventoryTransfer> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: InventoryTransfer }>(
        `/api/admin/inventory-transfers/transfers/${transferId}/receive`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantId
          },
          body: JSON.stringify({
            actualQuantity,
            notes
          })
        },
        `receive-transfer-${transferId}`,
        undefined,
        {
          tenantId: `${tenantId}`
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to receive transfer');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      console.error('Failed to receive transfer:', error);
      throw error;
    }
  }

  /**
   * Cancel a transfer
   */
  async cancelTransfer(transferId: string, tenantId: string, notes?: string): Promise<InventoryTransfer> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; data: InventoryTransfer }>(
        `/api/admin/inventory-transfers/transfers/${transferId}/cancel`,
        {
          method: 'POST',
          headers: {
            'x-tenant-id': tenantId
          },
          body: JSON.stringify({ notes })
        },
        `cancel-transfer-${transferId}`,
        undefined,
        {
          tenantId: `${tenantId}`
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to cancel transfer');
      }

      return safeTransformToCamel(result.data);
    } catch (error) {
      console.error('Failed to cancel transfer:', error);
      throw error;
    }
  }

  /**
   * Get low stock alerts
   */
  async getLowStockAlerts(tenantId: string): Promise<any[]> {
    try {
      const result = await this.makeDefaultRequest<any[]>(
        `/api/tenant/inventory-transfers/inventory/low-stock-alerts`,
        {
          method: 'GET',
          headers: {
            'x-tenant-id': tenantId
          }
        },
        `low-stock-${tenantId}`,
        undefined,
        {
          tenantId: `${tenantId}`
        }
      );

      if (!result.success || !result.data) {
        throw new Error('Failed to fetch low stock alerts');
      }

      return result.data;
    } catch (error) {
      console.error('Failed to fetch low stock alerts:', error);
      throw error;
    }
  }

  /**
   * Get incoming transfers (where current tenant is target)
   */
  async getIncomingTransfers(tenantId: string): Promise<InventoryTransfer[]> {
    try {
      console.log('[InventoryTransferService] Fetching incoming transfers for tenant:', tenantId);
      
      const result = await this.makeDefaultRequest<{ success: boolean; data: { transfers: InventoryTransfer[], total: number } }>(
        `/api/admin/inventory-transfers/transfers/incoming?targetTenantId=${tenantId}`,
        {
          method: 'GET'
        },
        `incoming-transfers-${tenantId}`,
        undefined,
        {
          tenantId
        }
      );

      if (!result.success || !result.data) {
        console.error('[InventoryTransferService] Incoming transfers API Response Error:', {
          success: result.success,
          data: result.data,
          error: result.error,
          status: result.status
        });
        throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch incoming transfers');
      }

      console.log('[InventoryTransferService] Raw incoming transfers data:', result.data);
      
      // Handle the actual API response structure: { success: true, data: { transfers: [...] } }
      let transfersData = [];
      // The actual response is nested: result.data.data contains the transfers
      const dataObj = (result.data as any)?.data;
      if (dataObj && typeof dataObj === 'object' && dataObj.transfers && Array.isArray(dataObj.transfers)) {
        transfersData = dataObj.transfers;
        console.log('[InventoryTransferService] Successfully extracted incoming transfers array:', transfersData.length, 'items');
      } else if (Array.isArray(result.data)) {
        // Fallback if API changes to return array directly
        transfersData = result.data;
        console.log('[InventoryTransferService] Using direct array fallback for incoming transfers:', transfersData.length, 'items');
      } else {
        console.warn('[InventoryTransferService] Unexpected incoming transfers data structure:', result.data);
        transfersData = [];
      }

      return transfersData.map((transfer: any) => safeTransformToCamel(transfer));
    } catch (error) {
      console.error('Failed to fetch incoming transfers:', error);
      throw error;
    }
  }

  /**
   * Create a new transfer
   */
  async createTransfer(
    tenantId: string,
    transferRequest: {
      sourceLocationId: string;
      targetLocationId: string;
      sku: string;
      quantity: number;
      notes?: string;
    }
  ): Promise<InventoryTransfer> {
    try {
      console.log('[InventoryTransferService] Creating new transfer:', {
        tenantId,
        ...transferRequest
      });

      const apiResult = await this.makeDefaultRequest<{ success: boolean; data: InventoryTransfer }>(
        `/api/admin/inventory-transfers/transfers?tenantId=${tenantId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(transferRequest)
        },
        `create-transfer-${tenantId}`,
        undefined,
        {
          tenantId
        }
      );

      if (!apiResult.success || !apiResult.data) {
        console.error('[InventoryTransferService] Create transfer API Response Error:', {
          success: apiResult.success,
          data: apiResult.data,
          error: apiResult.error,
          status: apiResult.status
        });
        throw new Error(typeof apiResult.error === 'string' ? apiResult.error : apiResult.error?.message || 'Failed to create transfer');
      }

      console.log('[InventoryTransferService] Transfer created successfully:', apiResult.data);

      // Invalidate cache to refresh transfers list
      this.invalidateServiceCaches(`transfers-${tenantId}`);
      this.invalidateServiceCaches(`incoming-transfers-${tenantId}`);

      // Handle the actual API response structure
      const transferResponse = (apiResult.data as any)?.data || apiResult.data;
      return safeTransformToCamel(transferResponse);
    } catch (error) {
      console.error('Failed to create transfer:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const inventoryTransferService = InventoryTransferService.getInstance();
