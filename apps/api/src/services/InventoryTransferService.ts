/**
 * Inventory Transfer Service
 * 
 * Handles cross-location inventory management:
 * - Real-time inventory synchronization
 * - Inter-location transfers with tracking
 * - Inventory pool management
 * - Transfer approval workflows
 * - Low stock alerts and auto-rebalancing
 */

import { prisma } from '../prisma';
import { 
  generateScheduleId,
  generateNotificationId 
} from '../lib/id-generator';

export interface InventoryTransfer {
  id: string;
  tenantId: string;
  sourceLocationId: string;
  targetLocationId: string;
  sku: string;
  quantity: number;
  status: 'pending' | 'approved' | 'shipped' | 'in_transit' | 'delivered' | 'received' | 'cancelled' | 'rejected';
  initiatedBy: string;
  initiatedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  shippedBy?: string;
  shippedAt?: Date;
  receivedBy?: string;
  receivedAt?: Date;
  cancelledBy?: string;
  cancelledAt?: Date;
  notes?: string;
  metadata?: any;
  trackingNumber?: string;
  estimatedArrival?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationInventoryPool {
  id: string;
  tenantId: string;
  locationId: string;
  sku: string;
  totalQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  inTransitQuantity: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastUpdated: Date;
  metadata?: any;
}

export interface TransferLog {
  id: string;
  transferId: string;
  tenantId: string;
  action: 'initiated' | 'approved' | 'shipped' | 'received' | 'cancelled' | 'rejected' | 'modified';
  performedBy: string;
  performedAt: Date;
  oldStatus?: string;
  newStatus?: string;
  quantityChange?: number;
  notes?: string;
  metadata?: any;
}

export interface InventorySyncEvent {
  id: string;
  tenantId: string;
  locationId: string;
  sku: string;
  eventType: 'sale' | 'transfer_out' | 'transfer_in' | 'adjustment' | 'restock' | 'return' | 'damage' | 'loss';
  quantityBefore?: number;
  quantityAfter?: number;
  sourceEventId?: string;
  triggeredBy?: string;
  triggeredAt: Date;
  processedAt?: Date;
  status: 'pending' | 'success' | 'error';
  errorMessage?: string;
  metadata?: any;
}

export class InventoryTransferService {
  private static instance: InventoryTransferService;

  static getInstance(): InventoryTransferService {
    if (!InventoryTransferService.instance) {
      InventoryTransferService.instance = new InventoryTransferService();
    }
    return InventoryTransferService.instance;
  }

  /**
   * Initiate inventory transfer between locations
   */
  async initiateTransfer(
    tenantId: string,
    sourceLocationId: string,
    targetLocationId: string,
    sku: string,
    quantity: number,
    initiatedBy: string,
    notes?: string,
    metadata?: any
  ): Promise<InventoryTransfer> {
    // Validate source location has sufficient inventory
    const sourcePool = await this.getLocationInventoryPool(tenantId, sourceLocationId, sku);
    if (!sourcePool) {
      throw new Error(`Source location ${sourceLocationId} does not have inventory for SKU ${sku}`);
    }
    if (sourcePool.availableQuantity < quantity) {
      throw new Error(`Insufficient inventory at source location. Available: ${sourcePool.availableQuantity}, Requested: ${quantity}`);
    }

    // Create transfer record
    const transfer = await prisma.inventory_transfers.create({
      data: {
        id: generateScheduleId(tenantId), // Using schedule ID generator for transfers
        tenant_id: tenantId,
        source_location_id: sourceLocationId,
        target_location_id: targetLocationId,
        sku,
        quantity,
        status: 'pending',
        initiated_by: initiatedBy,
        notes,
        metadata: metadata || {},
      },
    });

    // Reserve inventory at source location
    await this.updateLocationInventoryPool(
      tenantId, 
      sourceLocationId, 
      sku, 
      { 
        reserved_quantity: { increment: quantity },
        available_quantity: { decrement: quantity }
      }
    );

    // Create transfer log
    await this.createTransferLog(
      transfer.id,
      tenantId,
      'initiated',
      initiatedBy,
      undefined,
      'pending',
      quantity,
      notes
    );

    // Create sync event for transfer out
    await this.createSyncEvent(
      tenantId,
      sourceLocationId,
      sku,
      'transfer_out',
      sourcePool.availableQuantity,
      sourcePool.availableQuantity - quantity,
      transfer.id,
      initiatedBy
    );

    return this.formatTransfer(transfer);
  }

  /**
   * Approve inventory transfer
   */
  async approveTransfer(
    transferId: string,
    approvedBy: string,
    notes?: string
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }
    if (transfer.status !== 'pending') {
      throw new Error(`Cannot approve transfer in status: ${transfer.status}`);
    }

    const updatedTransfer = await prisma.inventory_transfers.update({
      where: { id: transferId },
      data: {
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date(),
        notes: notes ? notes : transfer.notes,
      },
    });

    // Create transfer log
    await this.createTransferLog(
      transferId,
      transfer.tenant_id,
      'approved',
      approvedBy,
      'pending',
      'approved',
      undefined,
      notes
    );

    return this.formatTransfer(updatedTransfer);
  }

  /**
   * Ship inventory transfer
   */
  async shipTransfer(
    transferId: string,
    shippedBy: string,
    trackingNumber?: string,
    estimatedArrival?: Date,
    notes?: string
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }
    if (transfer.status !== 'approved') {
      throw new Error(`Cannot ship transfer in status: ${transfer.status}`);
    }

    // Update source location inventory (remove from reserved, add to in-transit)
    await this.updateLocationInventoryPool(
      transfer.tenant_id,
      transfer.source_location_id,
      transfer.sku,
      {
        reserved_quantity: { decrement: transfer.quantity },
        total_quantity: { decrement: transfer.quantity }
      }
    );

    // Update target location inventory (add to in-transit)
    await this.updateOrCreateLocationInventoryPool(
      transfer.tenant_id,
      transfer.target_location_id,
      transfer.sku,
      {
        in_transit_quantity: { increment: transfer.quantity }
      }
    );

    const updatedTransfer = await prisma.inventory_transfers.update({
      where: { id: transferId },
      data: {
        status: 'shipped',
        shipped_by: shippedBy,
        shipped_at: new Date(),
        tracking_number: trackingNumber,
        estimated_arrival: estimatedArrival,
        notes: notes ? notes : transfer.notes,
      },
    });

    // Create transfer log
    await this.createTransferLog(
      transferId,
      transfer.tenant_id,
      'shipped',
      shippedBy,
      'approved',
      'shipped',
      undefined,
      notes
    );

    // Create sync events
    await this.createSyncEvent(
      transfer.tenant_id,
      transfer.source_location_id,
      transfer.sku,
      'transfer_out',
      undefined,
      undefined,
      transferId,
      shippedBy
    );

    await this.createSyncEvent(
      transfer.tenant_id,
      transfer.target_location_id,
      transfer.sku,
      'transfer_in',
      undefined,
      undefined,
      transferId,
      shippedBy
    );

    return this.formatTransfer(updatedTransfer);
  }

  /**
   * Receive inventory transfer
   */
  async receiveTransfer(
    transferId: string,
    receivedBy: string,
    actualQuantity?: number,
    notes?: string
  ): Promise<InventoryTransfer> {
    const transfer = await this.getTransfer(transferId);
    if (!transfer) {
      throw new Error('Transfer not found');
    }
    if (!['shipped', 'in_transit', 'delivered'].includes(transfer.status)) {
      throw new Error(`Cannot receive transfer in status: ${transfer.status}`);
    }

    const receivedQty = actualQuantity || transfer.quantity;

    // Update target location inventory (move from in-transit to available)
    await this.updateLocationInventoryPool(
      transfer.tenant_id,
      transfer.target_location_id,
      transfer.sku,
      {
        in_transit_quantity: { decrement: transfer.quantity },
        total_quantity: { increment: receivedQty },
        available_quantity: { increment: receivedQty }
      }
    );

    const updatedTransfer = await prisma.inventory_transfers.update({
      where: { id: transferId },
      data: {
        status: 'received',
        received_by: receivedBy,
        received_at: new Date(),
        notes: notes ? notes : transfer.notes,
        metadata: {
          ...transfer.metadata,
          actualQuantity: receivedQty,
          variance: receivedQty - transfer.quantity
        }
      },
    });

    // Create transfer log
    await this.createTransferLog(
      transferId,
      transfer.tenant_id,
      'received',
      receivedBy,
      transfer.status,
      'received',
      receivedQty - transfer.quantity,
      notes
    );

    // Create sync event
    await this.createSyncEvent(
      transfer.tenant_id,
      transfer.target_location_id,
      transfer.sku,
      'transfer_in',
      undefined,
      undefined,
      transferId,
      receivedBy
    );

    return this.formatTransfer(updatedTransfer);
  }

  /**
   * Get location inventory pool
   */
  async getLocationInventoryPool(
    tenantId: string,
    locationId: string,
    sku: string
  ): Promise<LocationInventoryPool | null> {
    const pool = await prisma.location_inventory_pools.findUnique({
      where: {
        tenant_id_location_id_sku: {
          tenant_id: tenantId,
          location_id: locationId,
          sku: sku
        }
      }
    });

    return pool ? this.formatLocationInventoryPool(pool) : null;
  }

  /**
   * Get all inventory pools for a location
   */
  async getLocationInventoryPools(
    tenantId: string,
    locationId: string,
    options?: {
      lowStockOnly?: boolean;
      sku?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ pools: LocationInventoryPool[], total: number }> {
    const where: any = {
      tenant_id: tenantId,
      location_id: locationId
    };

    if (options?.sku) {
      where.sku = { contains: options.sku, mode: 'insensitive' };
    }

    if (options?.lowStockOnly) {
      where.available_quantity = { lte: prisma.location_inventory_pools.fields.low_stock_threshold };
    }

    const [pools, total] = await Promise.all([
      prisma.location_inventory_pools.findMany({
        where,
        orderBy: { sku: 'asc' },
        take: options?.limit || 100,
        skip: options?.offset || 0
      }),
      prisma.location_inventory_pools.count({ where })
    ]);

    return {
      pools: pools.map(pool => this.formatLocationInventoryPool(pool)),
      total
    };
  }

  /**
   * Get transfers for tenant
   */
  async getTransfers(
    tenantId: string,
    options?: {
      status?: string;
      sourceLocationId?: string;
      targetLocationId?: string;
      sku?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ transfers: InventoryTransfer[], total: number }> {
    const where: any = { tenant_id: tenantId };

    if (options?.status) where.status = options.status;
    if (options?.sourceLocationId) where.source_location_id = options.sourceLocationId;
    if (options?.targetLocationId) where.target_location_id = options.targetLocationId;
    if (options?.sku) where.sku = { contains: options.sku, mode: 'insensitive' };

    const [transfers, total] = await Promise.all([
      prisma.inventory_transfers.findMany({
        where,
        orderBy: { initiated_at: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0
      }),
      prisma.inventory_transfers.count({ where })
    ]);

    return {
      transfers: transfers.map(transfer => this.formatTransfer(transfer)),
      total
    };
  }

  /**
   * Get low stock alerts for tenant
   */
  async getLowStockAlerts(
    tenantId: string,
    options?: {
      locationId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ alerts: LocationInventoryPool[], total: number }> {
    const where: any = {
      tenant_id: tenantId,
      available_quantity: { lte: prisma.location_inventory_pools.fields.low_stock_threshold }
    };

    if (options?.locationId) {
      where.location_id = options.locationId;
    }

    const [pools, total] = await Promise.all([
      prisma.location_inventory_pools.findMany({
        where,
        orderBy: { available_quantity: 'asc' },
        take: options?.limit || 100,
        skip: options?.offset || 0
      }),
      prisma.location_inventory_pools.count({ where })
    ]);

    return {
      alerts: pools.map(pool => this.formatLocationInventoryPool(pool)),
      total
    };
  }

  // Public helper methods

  /**
   * Update inventory pool (public method for admin operations)
   */
  async updateInventoryPool(
    tenantId: string,
    locationId: string,
    sku: string,
    updates: any
  ): Promise<void> {
    await this.updateOrCreateLocationInventoryPool(tenantId, locationId, sku, updates);
  }

  // Private helper methods

  private async getTransfer(transferId: string): Promise<any> {
    return await prisma.inventory_transfers.findUnique({
      where: { id: transferId },
      select: {
        id: true,
        tenant_id: true,
        source_location_id: true,
        target_location_id: true,
        sku: true,
        quantity: true,
        status: true,
        initiated_by: true,
        approved_by: true,
        shipped_by: true,
        received_by: true,
        notes: true,
        metadata: true,
        created_at: true,
        initiated_at: true,
        approved_at: true,
        shipped_at: true,
        received_at: true
      }
    });
  }

  private async updateLocationInventoryPool(
    tenantId: string,
    locationId: string,
    sku: string,
    updates: any
  ): Promise<void> {
    await prisma.location_inventory_pools.updateMany({
      where: {
        tenant_id: tenantId,
        location_id: locationId,
        sku: sku
      },
      data: {
        ...updates,
        last_updated: new Date()
      }
    });
  }

  private async updateOrCreateLocationInventoryPool(
    tenantId: string,
    locationId: string,
    sku: string,
    updates: any
  ): Promise<void> {
    await prisma.location_inventory_pools.upsert({
      where: {
        tenant_id_location_id_sku: {
          tenant_id: tenantId,
          location_id: locationId,
          sku: sku
        }
      },
      update: {
        ...updates,
        last_updated: new Date()
      },
      create: {
        id: generateScheduleId(tenantId),
        tenant_id: tenantId,
        location_id: locationId,
        sku: sku,
        total_quantity: 0,
        available_quantity: 0,
        reserved_quantity: 0,
        in_transit_quantity: 0,
        low_stock_threshold: 5,
        reorder_point: 10,
        reorder_quantity: 20,
        last_updated: new Date()
      }
    });
  }

  private async createTransferLog(
    transferId: string,
    tenantId: string,
    action: string,
    performedBy: string,
    oldStatus?: string,
    newStatus?: string,
    quantityChange?: number,
    notes?: string
  ): Promise<void> {
    await prisma.inventory_transfer_logs.create({
      data: {
        id: generateNotificationId(tenantId),
        transfer_id: transferId,
        tenant_id: tenantId,
        action: action as any,
        performed_by: performedBy,
        old_status: oldStatus as any,
        new_status: newStatus as any,
        quantity_change: quantityChange,
        notes
      }
    });
  }

  private async createSyncEvent(
    tenantId: string,
    locationId: string,
    sku: string,
    eventType: string,
    quantityBefore?: number,
    quantityAfter?: number,
    sourceEventId?: string,
    triggeredBy?: string
  ): Promise<void> {
    await prisma.inventory_sync_events.create({
      data: {
        id: generateNotificationId(tenantId),
        tenant_id: tenantId,
        location_id: locationId,
        sku: sku,
        event_type: eventType as any,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        source_event_id: sourceEventId,
        triggered_by: triggeredBy
      }
    });
  }

  private formatTransfer(transfer: any): InventoryTransfer {
    return {
      id: transfer.id,
      tenantId: transfer.tenant_id,
      sourceLocationId: transfer.source_location_id,
      targetLocationId: transfer.target_location_id,
      sku: transfer.sku,
      quantity: transfer.quantity,
      status: transfer.status,
      initiatedBy: transfer.initiated_by,
      initiatedAt: transfer.initiated_at,
      approvedBy: transfer.approved_by,
      approvedAt: transfer.approved_at,
      shippedBy: transfer.shipped_by,
      shippedAt: transfer.shipped_at,
      receivedBy: transfer.received_by,
      receivedAt: transfer.received_at,
      cancelledBy: transfer.cancelled_by,
      cancelledAt: transfer.cancelled_at,
      notes: transfer.notes,
      metadata: transfer.metadata,
      trackingNumber: transfer.tracking_number,
      estimatedArrival: transfer.estimated_arrival,
      createdAt: transfer.created_at,
      updatedAt: transfer.updated_at
    };
  }

  private formatLocationInventoryPool(pool: any): LocationInventoryPool {
    return {
      id: pool.id,
      tenantId: pool.tenant_id,
      locationId: pool.location_id,
      sku: pool.sku,
      totalQuantity: pool.total_quantity,
      availableQuantity: pool.available_quantity,
      reservedQuantity: pool.reserved_quantity,
      inTransitQuantity: pool.in_transit_quantity,
      lowStockThreshold: pool.low_stock_threshold,
      reorderPoint: pool.reorder_point,
      reorderQuantity: pool.reorder_quantity,
      lastUpdated: pool.last_updated,
      metadata: pool.metadata
    };
  }
}
