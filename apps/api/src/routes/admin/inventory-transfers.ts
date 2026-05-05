/**
 * Admin Inventory Transfer Routes
 * 
 * Global catalog management and cross-location inventory operations
 * Platform admin only
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requirePlatformAdmin } from '../../middleware/auth';
import { InventoryTransferService } from '../../services/InventoryTransferService';
import { prisma } from '../../prisma';

const router = Router();
const inventoryTransferService = InventoryTransferService.getInstance();

// All routes require platform admin authentication
router.use(authenticateToken);
router.use(requirePlatformAdmin);

// ========================================
// Inventory Transfer Management
// ========================================

// Get all transfers across all tenants (platform-wide view)
router.get('/transfers', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      status,
      sourceLocationId,
      targetLocationId,
      sku,
      limit = 50,
      offset = 0,
      startDate,
      endDate
    } = req.query;

    let transfers;
    if (tenantId) {
      // Filter by specific tenant
      const result = await inventoryTransferService.getTransfers(tenantId as string, {
        status: status as string,
        sourceLocationId: sourceLocationId as string,
        targetLocationId: targetLocationId as string,
        sku: sku as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
      transfers = result;
    } else {
      // Platform-wide view - get all transfers
      transfers = await prisma.inventory_transfers.findMany({
        where: {
          ...(status && { status: status as any }),
          ...(sourceLocationId && { source_location_id: sourceLocationId as string }),
          ...(targetLocationId && { target_location_id: targetLocationId as string }),
          ...(sku && { sku: sku as string }),
          ...(startDate && { initiated_at: { gte: new Date(startDate as string) } }),
          ...(endDate && { initiated_at: { lte: new Date(endDate as string) } })
        },
        include: {
          tenants_inventory_transfers_tenant_idTotenants: {
            select: { id: true, name: true }
          }
        },
        orderBy: { initiated_at: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      });
    }

    res.json({
      success: true,
      data: transfers
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Get transfers error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_transfers',
      message: error.message
    });
  }
});

// Get incoming transfers (where tenant is target)
router.get('/transfers/incoming', async (req: Request, res: Response) => {
  try {
    const {
      targetTenantId,
      status,
      sourceLocationId,
      sku,
      limit = 50,
      offset = 0
    } = req.query;

    if (!targetTenantId) {
      return res.status(400).json({
        success: false,
        error: 'target_tenant_id_required',
        message: 'Target tenant ID is required for incoming transfers view'
      });
    }

    const result = await inventoryTransferService.getTransfers(targetTenantId as string, {
      status: status as string,
      sourceLocationId: sourceLocationId as string,
      sku: sku as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      success: true,
      data: {
        transfers: result.transfers,
        total: result.total
      }
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Get incoming transfers error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_incoming_transfers',
      message: error.message
    });
  }
});

// Create new transfer
router.post('/transfers', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const {
      sourceLocationId,
      targetLocationId,
      sku,
      quantity,
      notes
    } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenant_id_required',
        message: 'Tenant ID is required'
      });
    }

    // Validate required fields
    if (!sourceLocationId || !targetLocationId || !sku || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'missing_required_fields',
        message: 'Source location, target location, SKU, and quantity are required'
      });
    }

    // Validate quantity
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        error: 'invalid_quantity',
        message: 'Quantity must be at least 1'
      });
    }

    // Check if source and target are different
    if (sourceLocationId === targetLocationId) {
      return res.status(400).json({
        success: false,
        error: 'same_location',
        message: 'Source and target locations must be different'
      });
    }

    // Create the transfer
    const transfer = await inventoryTransferService.createTransfer({
      tenantId: tenantId as string,
      sourceLocationId,
      targetLocationId,
      sku,
      quantity,
      notes: notes || null,
      initiatedBy: req.headers['x-auth0-id'] as string
    });

    console.log('[Admin Inventory] Transfer created:', {
      id: transfer.id,
      tenantId,
      sourceLocationId,
      targetLocationId,
      sku,
      quantity
    });

    res.json({
      success: true,
      data: transfer
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Create transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_create_transfer',
      message: error.message
    });
  }
});

// Get transfer details
router.get('/transfers/:transferId', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    
    // Would need to implement getTransferById method
    // For now, return placeholder
    res.json({
      success: true,
      message: 'Transfer details endpoint - to be implemented'
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Get transfer details error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_transfer_details',
      message: error.message
    });
  }
});

// Approve transfer (platform admin override)
router.post('/transfers/:transferId/approve', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const { notes } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Admin authentication required'
      });
    }

    const transfer = await inventoryTransferService.approveTransfer(
      transferId,
      adminId,
      notes
    );

    res.json({
      success: true,
      data: transfer,
      message: 'Transfer approved successfully'
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Approve transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_approve_transfer',
      message: error.message
    });
  }
});

// Ship transfer (platform admin override)
router.post('/transfers/:transferId/ship', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const { trackingNumber, estimatedArrival, notes } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Admin authentication required'
      });
    }

    const transfer = await inventoryTransferService.shipTransfer(
      transferId,
      adminId,
      trackingNumber,
      estimatedArrival ? new Date(estimatedArrival) : undefined,
      notes
    );

    res.json({
      success: true,
      data: transfer,
      message: 'Transfer shipped successfully'
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Ship transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_ship_transfer',
      message: error.message
    });
  }
});

// Receive transfer (platform admin override)
router.post('/transfers/:transferId/receive', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const { actualQuantity, notes } = req.body;
    const adminId = req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Admin authentication required'
      });
    }

    const transfer = await inventoryTransferService.receiveTransfer(
      transferId,
      adminId,
      actualQuantity,
      notes
    );

    res.json({
      success: true,
      data: transfer,
      message: 'Transfer received successfully'
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Receive transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_receive_transfer',
      message: error.message
    });
  }
});

// Cancel transfer (platform admin override)
router.post('/transfers/:transferId/cancel', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const { notes } = req.body;
    const adminId = req.user?.id;

    // Would need to implement cancelTransfer method
    res.json({
      success: true,
      message: 'Cancel transfer endpoint - to be implemented'
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Cancel transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_cancel_transfer',
      message: error.message
    });
  }
});

// ========================================
// Location Inventory Management
// ========================================

// Get inventory pools for a location
router.get('/locations/:locationId/inventory', async (req: Request, res: Response) => {
  try {
    const { locationId } = req.params;
    const { 
      tenantId,
      lowStockOnly,
      sku,
      limit = 100,
      offset = 0
    } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }

    const result = await inventoryTransferService.getLocationInventoryPools(
      tenantId as string,
      locationId,
      {
        lowStockOnly: lowStockOnly === 'true',
        sku: sku as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Get location inventory error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_location_inventory',
      message: error.message
    });
  }
});

// Get specific inventory pool
router.get('/locations/:locationId/inventory/:sku', async (req: Request, res: Response) => {
  try {
    const { locationId, sku } = req.params;
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }

    const pool = await inventoryTransferService.getLocationInventoryPool(
      tenantId as string,
      locationId,
      sku
    );

    if (!pool) {
      return res.status(404).json({
        success: false,
        error: 'inventory_pool_not_found',
        message: 'Inventory pool not found for this SKU and location'
      });
    }

    res.json({
      success: true,
      data: pool
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Get inventory pool error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_inventory_pool',
      message: error.message
    });
  }
});

// ========================================
// Low Stock Alerts & Analytics
// ========================================

// Get low stock alerts
router.get('/alerts/low-stock', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      locationId,
      limit = 100,
      offset = 0
    } = req.query;

    let result;
    if (tenantId) {
      // Filter by specific tenant
      result = await inventoryTransferService.getLowStockAlerts(
        tenantId as string,
        {
          locationId: locationId as string,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      );
    } else {
      // Platform-wide view - get all low stock items
      result = await prisma.inventory_items.findMany({
        where: {
          item_status: 'active',
          stock: { lte: 5, gt: 0 }
        },
        select: {
          id: true,
          sku: true,
          name: true,
          stock: true,
          product_slug: true,
          tenants: {
            select: { id: true, name: true }
          }
        },
        orderBy: { stock: 'asc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_low_stock_alerts',
      message: error.message
    });
  }
});

// Get inventory analytics
router.get('/analytics/inventory', async (req: Request, res: Response) => {
  try {
    const { tenantId, locationId } = req.query;

    // Placeholder for analytics implementation
    res.json({
      success: true,
      message: 'Inventory analytics endpoint - to be implemented',
      data: {
        totalLocations: 0,
        totalSKUs: 0,
        totalValue: 0,
        lowStockItems: 0,
        inTransitItems: 0
      }
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_analytics',
      message: error.message
    });
  }
});

// ========================================
// Bulk Operations
// ========================================

// Bulk inventory update
router.post('/inventory/bulk-update', async (req: Request, res: Response) => {
  try {
    const { tenantId, updates } = req.body;
    const adminId = req.user?.id;

    if (!tenantId || !updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Tenant ID and updates array are required'
      });
    }

    const results = [];
    
    for (const update of updates) {
      const {
        locationId,
        sku,
        totalQuantity,
        availableQuantity,
        reservedQuantity,
        inTransitQuantity,
        lowStockThreshold,
        reorderPoint,
        reorderQuantity
      } = update;

      try {
        // Check if inventory pool already exists
        const existingPool = await inventoryTransferService.getLocationInventoryPool(tenantId, locationId, sku);
        
        if (existingPool) {
          // Update existing pool
          await inventoryTransferService.updateInventoryPool(tenantId, locationId, sku, {
            total_quantity: totalQuantity,
            available_quantity: availableQuantity,
            reserved_quantity: reservedQuantity,
            in_transit_quantity: inTransitQuantity,
            low_stock_threshold: lowStockThreshold,
            reorder_point: reorderPoint,
            reorder_quantity: reorderQuantity
          });
          
          results.push({
            locationId,
            sku,
            action: 'updated',
            status: 'success'
          });
        } else {
          // Create new pool
          await prisma.location_inventory_pools.create({
            data: {
              id: `pool-${tenantId}-${locationId}-${sku}`,
              tenant_id: tenantId,
              location_id: locationId,
              sku: sku,
              total_quantity: totalQuantity,
              available_quantity: availableQuantity,
              reserved_quantity: reservedQuantity,
              in_transit_quantity: inTransitQuantity,
              low_stock_threshold: lowStockThreshold,
              reorder_point: reorderPoint,
              reorder_quantity: reorderQuantity,
              last_updated: new Date()
            }
          });
          
          results.push({
            locationId,
            sku,
            action: 'created',
            status: 'success'
          });
        }
      } catch (error: any) {
        console.error(`Failed to update inventory pool for ${locationId}/${sku}:`, error);
        results.push({
          locationId,
          sku,
          action: 'failed',
          status: 'failed',
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      message: `Bulk inventory update completed`,
      processed: updates.length,
      successful,
      failed,
      results
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Bulk update error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_bulk_update',
      message: error.message
    });
  }
});

// Initiate transfer
router.post('/transfers/initiate', async (req: Request, res: Response) => {
  try {
    const {
      sourceLocationId,
      targetLocationId,
      sku,
      quantity,
      notes
    } = req.body;
    
    const adminId = req.user?.id;

    if (!sourceLocationId || !targetLocationId || !sku || !quantity) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Source location, target location, SKU, and quantity are required'
      });
    }

    // For admin, we need to determine the tenant - use source location as tenant
    const tenantId = sourceLocationId;

    const transfer = await inventoryTransferService.initiateTransfer(
      tenantId,
      sourceLocationId,
      targetLocationId,
      sku,
      quantity,
      adminId,
      notes
    );

    res.json({
      success: true,
      data: transfer
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Initiate transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_initiate_transfer',
      message: error.message
    });
  }
});

// Bulk transfer initiation
router.post('/transfers/bulk-initiate', async (req: Request, res: Response) => {
  try {
    const { tenantId, transfers } = req.body;
    const adminId = req.user?.id;

    if (!tenantId || !transfers || !Array.isArray(transfers)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Tenant ID and transfers array are required'
      });
    }

    // Placeholder for bulk transfer implementation
    res.json({
      success: true,
      message: 'Bulk transfer initiation endpoint - to be implemented',
      initiated: transfers.length
    });
  } catch (error: any) {
    console.error('[Admin Inventory] Bulk transfer error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_bulk_transfer',
      message: error.message
    });
  }
});

export default router;
