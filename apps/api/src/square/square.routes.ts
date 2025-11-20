/**
 * Square Integration Routes
 * Backend API routes for Square POS integration
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

// Lazy import Square services to avoid startup failures
let squareSyncService: any = null;

const getSquareSyncService = async () => {
  if (!squareSyncService) {
    const { squareSyncService: service } = await import('../services/square/square-sync.service');
    squareSyncService = service;
  }
  return squareSyncService;
};

// Lazy import the integration service to avoid startup failures
let squareIntegrationService: any = null;

const getSquareIntegrationService = async () => {
  if (!squareIntegrationService) {
    const { SquareIntegrationService } = await import('./square-integration.service');
    squareIntegrationService = new SquareIntegrationService();
  }
  return squareIntegrationService;
};

const router = Router();

// Validation schemas
const exchangeTokenSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  tenant_id: z.string().uuid('Invalid tenant ID'),
});

const disconnectSchema = z.object({
  tenant_id: z.string().uuid('Invalid tenant ID'),
});

const syncSchema = z.object({
  direction: z.enum(['to_square', 'from_square', 'bidirectional']).optional(),
  syncType: z.enum(['catalog', 'inventory', 'full']).optional(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /square/oauth/exchange
 * Exchange authorization code for access token
 */
router.post('/oauth/exchange', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validatedData = exchangeTokenSchema.parse(req.body);
    const { code, tenantId } = validatedData;

    // Exchange code for tokens and save to database
    const service = await getSquareIntegrationService();
    const integration = await service.connectTenant(tenantId, code);

    if (!integration) {
      return res.status(500).json({
        error: 'integration_failed',
        message: 'Failed to create Square integration',
      });
    }

    res.status(200).json({
      message: 'Square integration connected successfully',
      integration: {
        id: integration.id,
        merchantId: integration.merchantId,
        enabled: integration.enabled,
        mode: integration.mode,
        created_at: integration.created_at,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input data',
        details: error.issues,
      });
    }

    console.error('[Square OAuth] Token exchange error:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({
        error: 'exchange_failed',
        message: error.message,
      });
    }

    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to exchange authorization code',
    });
  }
});

/**
 * GET /square/integrations/:tenantId
 * Get Square integration status for a tenant
 */
router.get('/integrations/:tenantId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    const integration = await (await getSquareIntegrationService()).getIntegrationStatus(tenantId);

    if (!integration) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Square integration not found for this tenant',
        connected: false,
      });
    }

    res.status(200).json({
      connected: true,
      integration: {
        id: integration.id,
        merchantId: integration.merchantId,
        locationId: integration.locationId,
        enabled: integration.enabled,
        mode: integration.mode,
        lastSyncAt: integration.lastSyncAt,
        lastError: integration.lastError,
        created_at: integration.created_at,
        updated_at: integration.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Square Integration] Get status error:', error);
    
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve integration status',
    });
  }
});

/**
 * POST /square/integrations/:tenantId/disconnect
 * Disconnect Square integration for a tenant
 */
router.post('/integrations/:tenantId/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    await (await getSquareIntegrationService()).disconnectTenant(tenantId);

    res.status(200).json({
      message: 'Square integration disconnected successfully',
    });
  } catch (error) {
    console.error('[Square Integration] Disconnect error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'not_found',
          message: 'Square integration not found for this tenant',
        });
      }
    }

    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to disconnect integration',
    });
  }
});

/**
 * POST /square/integrations/:tenantId/sync
 * Trigger manual sync for a tenant
 */
router.post('/integrations/:tenantId/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    // TODO: Implement sync service in Phase 3
    res.status(501).json({
      error: 'not_implemented',
      message: 'Sync functionality will be available in Phase 3',
    });
  } catch (error) {
    console.error('[Square Integration] Sync error:', error);
    
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to trigger sync',
    });
  }
});

/**
 * GET /square/integrations/:tenantId/logs
 * Get sync logs for a tenant
 */
router.get('/integrations/:tenantId/logs', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    const logs = await (await getSquareIntegrationService()).getSyncLogs(tenantId, limit);

    res.status(200).json({
      logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('[Square Integration] Get logs error:', error);
    
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retrieve sync logs',
    });
  }
});

/**
 * POST /square/integrations/:tenantId/sync
 * Trigger manual sync (products and/or inventory)
 */
router.post('/integrations/:tenantId/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const validatedData = syncSchema.parse(req.body);

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    // Create sync service
    const syncServiceObj = await getSquareSyncService();
    const syncService = await syncServiceObj.create(tenantId);

    // Perform sync based on direction
    let result;
    const direction = validatedData.direction || 'bidirectional';

    if (direction === 'from_square') {
      result = await syncService.syncFromSquare(validatedData);
    } else if (direction === 'to_square') {
      result = await syncService.syncToSquare(validatedData);
    } else {
      result = await syncService.syncBidirectional(validatedData);
    }

    res.status(200).json({
      message: 'Sync completed',
      result: {
        success: result.success,
        itemsProcessed: result.itemsProcessed,
        itemsSucceeded: result.itemsSucceeded,
        itemsFailed: result.itemsFailed,
        duration: result.duration,
        errors: result.errors.slice(0, 10), // Limit errors in response
      },
    });
  } catch (error: any) {
    console.error('[Square Integration] Sync error:', error);
    
    res.status(500).json({
      error: 'sync_failed',
      message: error.message || 'Failed to sync with Square',
    });
  }
});

/**
 * POST /square/integrations/:tenantId/sync/products
 * Sync products only
 */
router.post('/integrations/:tenantId/sync/products', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const validatedData = syncSchema.parse(req.body);

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    const syncServiceObj = await getSquareSyncService();
    const syncService = await syncServiceObj.create(tenantId);
    const direction = validatedData.direction || 'bidirectional';

    let result;
    if (direction === 'from_square') {
      result = await syncService.syncFromSquare({ ...validatedData, syncType: 'catalog' });
    } else if (direction === 'to_square') {
      result = await syncService.syncToSquare({ ...validatedData, syncType: 'catalog' });
    } else {
      result = await syncService.syncBidirectional({ ...validatedData, syncType: 'catalog' });
    }

    res.status(200).json({
      message: 'Product sync completed',
      result: {
        success: result.success,
        itemsProcessed: result.itemsProcessed,
        itemsSucceeded: result.itemsSucceeded,
        itemsFailed: result.itemsFailed,
        duration: result.duration,
      },
    });
  } catch (error: any) {
    console.error('[Square Integration] Product sync error:', error);
    
    res.status(500).json({
      error: 'sync_failed',
      message: error.message || 'Failed to sync products',
    });
  }
});

/**
 * POST /square/integrations/:tenantId/sync/inventory
 * Sync inventory only
 */
router.post('/integrations/:tenantId/sync/inventory', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const validatedData = syncSchema.parse(req.body);

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    const syncServiceObj = await getSquareSyncService();
    const syncService = await syncServiceObj.create(tenantId);
    const direction = validatedData.direction || 'bidirectional';

    let result;
    if (direction === 'from_square') {
      result = await syncService.syncFromSquare({ ...validatedData, syncType: 'inventory' });
    } else if (direction === 'to_square') {
      result = await syncService.syncToSquare({ ...validatedData, syncType: 'inventory' });
    } else {
      result = await syncService.syncBidirectional({ ...validatedData, syncType: 'inventory' });
    }

    res.status(200).json({
      message: 'Inventory sync completed',
      result: {
        success: result.success,
        itemsProcessed: result.itemsProcessed,
        itemsSucceeded: result.itemsSucceeded,
        itemsFailed: result.itemsFailed,
        duration: result.duration,
      },
    });
  } catch (error: any) {
    console.error('[Square Integration] Inventory sync error:', error);
    
    res.status(500).json({
      error: 'sync_failed',
      message: error.message || 'Failed to sync inventory',
    });
  }
});

/**
 * GET /square/integrations/:tenantId/sync/status
 * Get current sync status
 */
router.get('/integrations/:tenantId/sync/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        error: 'missing_tenant_id',
        message: 'Tenant ID is required',
      });
    }

    // Get integration status
    const integration = await (await getSquareIntegrationService()).getIntegrationStatus(tenantId);

    if (!integration) {
      return res.status(404).json({
        error: 'not_found',
        message: 'No Square integration found for this tenant',
      });
    }

    // Get recent sync logs
    const recentLogs = await (await getSquareIntegrationService()).getSyncLogs(tenantId, 5);

    res.status(200).json({
      status: 'active',
      lastSyncAt: integration.lastSyncAt,
      lastError: integration.lastError,
      recentLogs: recentLogs.map((log: any) => ({
        id: log.id,
        syncType: log.syncType,
        direction: log.direction,
        status: log.status,
        itemsAffected: log.itemsAffected,
        created_at: log.created_at,
      })),
    });
  } catch (error: any) {
    console.error('[Square Integration] Get sync status error:', error);
    
    res.status(500).json({
      error: 'internal_error',
      message: 'Failed to get sync status',
    });
  }
});

export default router;
