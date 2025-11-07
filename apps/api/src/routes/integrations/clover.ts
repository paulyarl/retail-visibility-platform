/**
 * Clover POS Integration API Routes
 * 
 * Handles demo mode, OAuth flow, and production sync for Clover POS integration
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { getDemoItems, convertDemoItemToRVPFormat } from '../../services/clover-demo-emulator';

const router = Router();

/**
 * Enable demo mode for a tenant
 * Creates a CloverIntegration record and imports demo items
 */
router.post('/:tenantId/clover/demo/enable', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const hasAccess = tenant.users.some((ut: any) => ut.userId === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Check if integration already exists
    let integration = await prisma.cloverIntegration.findUnique({
      where: { tenantId }
    });

    if (integration) {
      // If already in demo mode, just refresh the timestamp
      if (integration.mode === 'demo') {
        integration = await prisma.cloverIntegration.update({
          where: { id: integration.id },
          data: {
            demoLastActiveAt: new Date(),
            status: 'active'
          }
        });
        return res.json({
          message: 'Demo mode already enabled',
          integration
        });
      }

      // If in production mode, cannot switch back to demo
      return res.status(400).json({
        error: 'already_in_production',
        message: 'Cannot enable demo mode after migrating to production'
      });
    }

    // Create new integration in demo mode
    integration = await prisma.cloverIntegration.create({
      data: {
        tenantId,
        mode: 'demo',
        status: 'active',
        demoEnabledAt: new Date(),
        demoLastActiveAt: new Date()
      }
    });

    // Import demo items into inventory
    const demoItems = getDemoItems();
    const importedItems = [];

    for (const demoItem of demoItems) {
      const rvpItem = convertDemoItemToRVPFormat(demoItem);
      
      try {
        // Check if item with this SKU already exists
        const existingItem = await prisma.inventoryItem.findFirst({
          where: {
            tenantId,
            sku: rvpItem.sku
          }
        });

        if (existingItem) {
          // Skip if already exists (user might have manually created it)
          continue;
        }

        // Create inventory item
        const createdItem = await prisma.inventoryItem.create({
          data: {
            tenantId,
            ...rvpItem
          }
        });

        // Create mapping
        await prisma.cloverItemMapping.create({
          data: {
            integrationId: integration.id,
            cloverItemId: demoItem.id,
            cloverItemName: demoItem.name,
            cloverSku: demoItem.sku,
            rvpItemId: createdItem.id,
            rvpSku: createdItem.sku,
            mappingStatus: 'mapped',
            lastSyncedAt: new Date(),
            lastSyncStatus: 'success'
          }
        });

        importedItems.push(createdItem);
      } catch (error) {
        console.error(`Failed to import demo item ${demoItem.sku}:`, error);
        // Continue with other items
      }
    }

    // Create sync log
    await prisma.cloverSyncLog.create({
      data: {
        integrationId: integration.id,
        traceId: `demo_import_${Date.now()}`,
        operation: 'import',
        status: 'success',
        itemsProcessed: demoItems.length,
        itemsSucceeded: importedItems.length,
        itemsFailed: demoItems.length - importedItems.length,
        durationMs: 0, // Calculated later if needed
        completedAt: new Date()
      }
    });

    return res.json({
      message: 'Demo mode enabled successfully',
      integration,
      itemsImported: importedItems.length,
      totalDemoItems: demoItems.length
    });

  } catch (error: any) {
    console.error('[POST /integrations/:tenantId/clover/demo/enable] Error:', error);
    return res.status(500).json({
      error: 'failed_to_enable_demo',
      message: error.message
    });
  }
});

/**
 * Disable demo mode for a tenant
 * Removes demo items and deactivates integration
 */
router.post('/:tenantId/clover/demo/disable', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { keepItems = false } = req.body; // Option to keep demo items
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const hasAccess = tenant.users.some((ut: any) => ut.userId === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Find integration
    const integration = await prisma.cloverIntegration.findUnique({
      where: { tenantId },
      include: { itemMappings: true }
    });

    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }

    if (integration.mode !== 'demo') {
      return res.status(400).json({
        error: 'not_in_demo_mode',
        message: 'Can only disable demo mode when integration is in demo mode'
      });
    }

    let deletedItemsCount = 0;

    // Delete demo items unless user wants to keep them
    if (!keepItems) {
      for (const mapping of integration.itemMappings) {
        if (mapping.rvpItemId) {
          try {
            await prisma.inventoryItem.delete({
              where: { id: mapping.rvpItemId }
            });
            deletedItemsCount++;
          } catch (error) {
            console.error(`Failed to delete item ${mapping.rvpItemId}:`, error);
          }
        }
      }
    }

    // Delete integration (cascades to mappings, logs, snapshots)
    await prisma.cloverIntegration.delete({
      where: { id: integration.id }
    });

    return res.json({
      message: 'Demo mode disabled successfully',
      itemsDeleted: deletedItemsCount,
      itemsKept: keepItems ? integration.itemMappings.length : 0
    });

  } catch (error: any) {
    console.error('[POST /integrations/:tenantId/clover/demo/disable] Error:', error);
    return res.status(500).json({
      error: 'failed_to_disable_demo',
      message: error.message
    });
  }
});

/**
 * Get Clover integration status for a tenant
 */
router.get('/:tenantId/clover/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const hasAccess = tenant.users.some((ut: any) => ut.userId === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Find integration
    const integration = await prisma.cloverIntegration.findUnique({
      where: { tenantId },
      include: {
        itemMappings: {
          take: 10, // Limit to recent mappings
          orderBy: { updatedAt: 'desc' }
        },
        syncLogs: {
          take: 5, // Last 5 sync logs
          orderBy: { startedAt: 'desc' }
        }
      }
    });

    if (!integration) {
      return res.json({
        enabled: false,
        mode: null,
        status: null
      });
    }

    // Calculate stats
    const totalMappings = await prisma.cloverItemMapping.count({
      where: { integrationId: integration.id }
    });

    const mappedCount = await prisma.cloverItemMapping.count({
      where: {
        integrationId: integration.id,
        mappingStatus: 'mapped'
      }
    });

    const conflictCount = await prisma.cloverItemMapping.count({
      where: {
        integrationId: integration.id,
        mappingStatus: 'conflict'
      }
    });

    return res.json({
      enabled: true,
      mode: integration.mode,
      status: integration.status,
      merchantId: integration.merchantId,
      demoEnabledAt: integration.demoEnabledAt,
      demoLastActiveAt: integration.demoLastActiveAt,
      productionEnabledAt: integration.productionEnabledAt,
      lastSyncAt: integration.lastSyncAt,
      lastSyncStatus: integration.lastSyncStatus,
      stats: {
        totalItems: totalMappings,
        mappedItems: mappedCount,
        conflictItems: conflictCount
      },
      recentMappings: integration.itemMappings,
      recentSyncs: integration.syncLogs
    });

  } catch (error: any) {
    console.error('[GET /integrations/:tenantId/clover/status] Error:', error);
    return res.status(500).json({
      error: 'failed_to_get_status',
      message: error.message
    });
  }
});

export default router;
