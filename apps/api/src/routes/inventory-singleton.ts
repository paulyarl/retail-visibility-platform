/**
 * Inventory API Routes - UniversalSingleton Implementation
 * Integrates InventoryService with Express API
 */

import { Router } from 'express';
import InventoryService from '../services/InventoryService';

const router = Router();

// Get singleton instance
const inventoryService = InventoryService.getInstance();

/**
 * Get inventory statistics
 * GET /api/inventory-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    // Check if user has permission to view stats for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await inventoryService.getInventoryStats(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[INVENTORY SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch inventory statistics'
    });
  }
});

/**
 * Get inventory item by ID
 * GET /api/inventory-singleton/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await inventoryService.getInventoryItem(id);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check if user has permission to access this tenant's inventory
    if (req.user?.tenantIds && !req.user.tenantIds.includes(item.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    res.json({
      success: true,
      data: {
        item,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory item retrieved successfully'
    });
  } catch (error) {
    console.error('Inventory item retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve inventory item',
      error: (error as Error).message
    });
  }
});

/**
 * Get inventory item by SKU
 * GET /api/inventory-singleton/sku/:tenantId/:sku
 */
router.get('/sku/:tenantId/:sku', async (req, res) => {
  try {
    const { tenantId, sku } = req.params;
    
    // Check if user has permission to access this tenant's inventory
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const item = await inventoryService.getInventoryItemBySku(tenantId, sku);
    
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        item,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory item retrieved successfully'
    });
  } catch (error) {
    console.error('Inventory item retrieval by SKU failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve inventory item',
      error: (error as Error).message
    });
  }
});

/**
 * Create new inventory item
 * POST /api/inventory-singleton
 */
router.post('/', async (req, res) => {
  try {
    const itemData = req.body;
    
    // Check if user has permission to create inventory for this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(itemData.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const item = await inventoryService.createInventoryItem(itemData);
    
    res.status(201).json({
      success: true,
      data: {
        item,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory item created successfully'
    });
  } catch (error) {
    console.error('Inventory item creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create inventory item',
      error: (error as Error).message
    });
  }
});

/**
 * Update inventory item
 * PUT /api/inventory-singleton/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get the item first to check permissions
    const existingItem = await inventoryService.getInventoryItem(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check if user has permission to update this tenant's inventory
    if (req.user?.tenantIds && !req.user.tenantIds.includes(existingItem.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const item = await inventoryService.updateInventoryItem(id, updates);
    
    res.json({
      success: true,
      data: {
        item,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory item updated successfully'
    });
  } catch (error) {
    console.error('Inventory item update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update inventory item',
      error: (error as Error).message
    });
  }
});

/**
 * Delete inventory item
 * DELETE /api/inventory-singleton/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the item first to check permissions
    const existingItem = await inventoryService.getInventoryItem(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check if user has permission to delete this tenant's inventory
    if (req.user?.tenantIds && !req.user.tenantIds.includes(existingItem.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    await inventoryService.deleteInventoryItem(id);
    
    res.json({
      success: true,
      data: {
        itemId: id,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory item deleted successfully'
    });
  } catch (error) {
    console.error('Inventory item deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete inventory item',
      error: (error as Error).message
    });
  }
});

/**
 * List inventory items
 * GET /api/inventory-singleton
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      category: req.query.category as string,
      brand: req.query.brand as string,
      status: req.query.status as 'active' | 'inactive' | 'out_of_stock' | 'discontinued' | undefined,
      location: req.query.location as string,
      lowStock: req.query.lowStock === 'true',
      outOfStock: req.query.outOfStock === 'true',
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      sortBy: req.query.sortBy as 'sku' | 'stock' | 'name' | 'price' | 'createdAt' | 'updatedAt' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined
    };
    
    // If user has specific tenant access, filter by their tenants
    if (req.user?.tenantIds && req.user.tenantIds.length > 0) {
      // For now, we'll return all items and let the service handle filtering
      // In a real implementation, we'd pass the tenantIds to the service
    }
    
    const items = await inventoryService.listInventoryItems(filters);
    
    res.json({
      success: true,
      data: {
        items,
        count: items.length,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory items retrieved successfully'
    });
  } catch (error) {
    console.error('Inventory listing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list inventory items',
      error: (error as Error).message
    });
  }
});

/**
 * Update stock levels
 * POST /api/inventory-singleton/:id/stock
 */
router.post('/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation = 'set' } = req.body;
    
    // Get the item first to check permissions
    const existingItem = await inventoryService.getInventoryItem(id);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Inventory item not found'
      });
    }
    
    // Check if user has permission to update this tenant's inventory
    if (req.user?.tenantIds && !req.user.tenantIds.includes(existingItem.tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const updatedItem = await inventoryService.updateStock(id, quantity, operation);
    
    res.json({
      success: true,
      data: {
        item: updatedItem,
        timestamp: new Date().toISOString()
      },
      message: 'Stock levels updated successfully'
    });
  } catch (error) {
    console.error('Stock update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update stock levels',
      error: (error as Error).message
    });
  }
});

/**
 * Get inventory statistics
 * GET /api/inventory-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    // Check if user has permission to view stats for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await inventoryService.getInventoryStats(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Inventory statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Inventory statistics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve inventory statistics',
      error: (error as Error).message
    });
  }
});

/**
 * Get low stock alerts
 * GET /api/inventory-singleton/alerts/low-stock
 */
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const tenantId = req.query.tenantId as string;
    
    // Check if user has permission to view alerts for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const alerts = await inventoryService.getLowStockAlerts(tenantId);
    
    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        timestamp: new Date().toISOString()
      },
      message: 'Low stock alerts retrieved successfully'
    });
  } catch (error) {
    console.error('Low stock alerts retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve low stock alerts',
      error: (error as Error).message
    });
  }
});

export default router;
