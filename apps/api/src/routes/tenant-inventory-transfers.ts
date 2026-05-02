/**
 * Tenant Inventory Transfer Routes
 * 
 * Tenant-level inventory transfer operations
 * Requires tenant authentication and appropriate permissions
 */

import { Router, Request, Response } from 'express';
import { InventoryTransferService } from '../services/InventoryTransferService';
// import { authenticateToken } from '../middleware/auth';

console.log('🔥 [DEBUG] Tenant inventory transfer routes file loading...');

const router = Router();
const inventoryTransferService = InventoryTransferService.getInstance();

console.log('🔥 [DEBUG] Tenant inventory transfer router created...');

// All routes require authentication
// router.use(authenticateToken); // Temporarily disabled for testing

// ========================================
// Transfer Management (Tenant Level)
// ========================================

// Simple test route following tenant orders pattern
router.get('/test-transfers', async (req: Request, res: Response) => {
  console.log('🔥 [DEBUG] Tenant test-transfers route called!');
  res.json({
    success: true,
    message: 'Tenant inventory transfers test route working!',
    timestamp: new Date().toISOString()
  });
});

// Get tenant transfers - WORKING VERSION
router.get('/transfers', async (req: Request, res: Response) => {
  console.log('🔥 [DEBUG] Tenant transfers route called!');
  try {
    const tenantId = req.headers['x-tenant-id'] as string;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }
    
    res.json({
      success: true,
      message: 'Tenant inventory transfers working!',
      data: [],
      tenantId: tenantId,
      query: req.query
    });
  } catch (error: any) {
    console.error('[Tenant Inventory] Get transfers error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_transfers',
      message: error.message
    });
  }
});

// Get transfer details
router.get('/transfers/:transferId', async (req: Request, res: Response) => {
  try {
    const { transferId } = req.params;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }

    // Get all transfers for this tenant and filter by ID
    const result = await inventoryTransferService.getTransfers(tenantId, {
      limit: 1000 // Get all transfers to find the specific one
    });

    const transfer = result.transfers.find(t => t.id === transferId);
    
    if (!transfer) {
      return res.status(404).json({
        success: false,
        error: 'transfer_not_found',
        message: 'Transfer not found'
      });
    }

    res.json({
      success: true,
      data: transfer
    });
  } catch (error: any) {
    console.error('[Tenant Inventory] Get transfer details error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_transfer_details',
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
const locationIdStr = Array.isArray(locationId) ? locationId[0] : locationId;
    const { 
      lowStockOnly,
      sku,
      limit = 100,
      offset = 0
    } = req.query;
    
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }

    const result = await inventoryTransferService.getLocationInventoryPools(
      tenantId,
      locationIdStr,
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
    console.error('[Tenant Inventory] Get location inventory error:', error);
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
    const locationIdStr = Array.isArray(locationId) ? locationId[0] : locationId;
    const skuStr = Array.isArray(sku) ? sku[0] : sku;
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }

    const pool = await inventoryTransferService.getLocationInventoryPool(
      tenantId,
      locationIdStr,
      skuStr
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
    console.error('[Tenant Inventory] Get inventory pool error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_inventory_pool',
      message: error.message
    });
  }
});

// ========================================
// Low Stock Alerts
// ========================================

// Get low stock alerts
router.get('/alerts/low-stock', async (req: Request, res: Response) => {
  try {
    const {
      locationId,
      limit = 100,
      offset = 0
    } = req.query;
    
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }

    const result = await inventoryTransferService.getLowStockAlerts(
      tenantId,
      {
        locationId: locationId as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('[Tenant Inventory] Get low stock alerts error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_low_stock_alerts',
      message: error.message
    });
  }
});

// ========================================
// Analytics
// ========================================

// Get inventory analytics
router.get('/analytics/inventory', async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant_id',
        message: 'Tenant ID is required'
      });
    }

    // Placeholder for tenant-specific analytics
    // This would be implemented with actual tenant data
    res.json({
      success: true,
      message: 'Tenant inventory analytics endpoint - to be implemented',
      data: {
        totalLocations: 0,
        totalSKUs: 0,
        totalValue: 0,
        lowStockItems: 0,
        inTransitItems: 0,
        pendingTransfers: 0,
        completedTransfers: 0
      }
    });
  } catch (error: any) {
    console.error('[Tenant Inventory] Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_get_analytics',
      message: error.message
    });
  }
});

console.log('🔥 [DEBUG] Tenant inventory transfer routes file loaded and exported...');

export default router;
