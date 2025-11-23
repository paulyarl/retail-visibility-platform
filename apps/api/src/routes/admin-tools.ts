/**
 * Admin Tools API Routes
 * 
 * Provides API endpoints for the Admin Control Panel.
 * All routes require admin authentication and are audit logged.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createTestChain,
  deleteTestChain,
  createTestTenant,
  bulkSeedProducts,
  bulkClearProducts,
} from '../lib/admin-tools';
import { audit } from '../audit';
import { prisma } from '../prisma';
import { validateTierAssignment } from '../middleware/tier-validation';
import { validateSKULimits } from '../middleware/sku-limits';

const router = Router();

// Admin authentication is enforced at the route registration level (requireAdmin middleware)
// Audit logging is applied to all routes below

/**
 * POST /api/admin/tools/test-chains
 * Create a test organization with multiple locations
 */
const createChainSchema = z.object({
  name: z.string().min(1),
  size: z.enum(['small', 'medium', 'large']),
  scenario: z.enum(['grocery', 'fashion', 'electronics', 'general']),
  seedProducts: z.boolean().optional().default(true),
  createAsDrafts: z.boolean().optional().default(true),
});

router.post('/test-chains', async (req, res) => {
  try {
    const parsed = createChainSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    console.log('[Admin Tools] Creating test chain:', parsed.data);

    const result = await createTestChain(parsed.data);

    // Log successful creation
    console.log(`[Audit] Admin created test chain: ${result.organizationId} with ${result.tenant.length} tenants`);

    res.json({
      success: true,
      ...result,
      message: 'Test chain created successfully',
    });
  } catch (error: any) {
    console.error('[Admin Tools] Error creating test chain:', error);
    res.status(500).json({
      error: 'Failed to create test chain',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/tools/test-chains/:organizationId
 * Delete a test organization and all associated data
 */
router.delete('/test-chains/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { confirm } = req.query;

    if (confirm !== 'true') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Must include confirm=true query parameter',
      });
    }

    console.log('[Admin Tools] Deleting test chain:', organizationId);

    const result = await deleteTestChain(organizationId);

    res.json({
      success: true,
      organizationId,
      ...result,
      message: 'Test chain deleted successfully',
    });
  } catch (error: any) {
    console.error('[Admin Tools] Error deleting test chain:', error);
    res.status(500).json({
      error: 'Failed to delete test chain',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/tools/tenants
 * Create a standalone test tenant
 */
const createTenantSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  subscription_tier: z.enum(['trial', 'google_only', 'starter', 'professional', 'enterprise', 'organization']).optional().default('professional'),
  subscription_status: z.enum(['trial', 'active', 'past_due', 'canceled', 'expired']).optional().default('trial'),
  organizationId: z.string().optional(), // Required for organization tier
  ownerId: z.string().optional(), // Link to user as owner
  scenario: z.enum(['grocery', 'fashion', 'electronics', 'general']).optional().default('general'),
  productCount: z.number().int().min(0).max(100).optional().default(0),
  createAsDrafts: z.boolean().optional().default(true),
});

router.post('/tenants', validateTierAssignment, validateSKULimits, async (req, res) => {
  try {
    const parsed = createTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    console.log('[Admin Tools] Creating test tenant:', parsed.data);

    const result = await createTestTenant(parsed.data);

    res.json({
      success: true,
      ...result,
      message: 'Test tenant created successfully',
    });
  } catch (error: any) {
    console.error('[Admin Tools] Error creating test tenant:', error);
    res.status(500).json({
      error: 'Failed to create test tenant',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/tools/tenants/:tenantId
 * Delete a test tenant and all associated data
 */
router.delete('/tenants/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { confirm } = req.query;

    if (confirm !== 'true') {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Must include confirm=true query parameter',
      });
    }

    console.log('[Admin Tools] Deleting test tenant:', tenantId);

    // Delete all products for this tenant
    const deletedProducts = await prisma.InventoryItem.deleteMany({
      where: { tenantId },
    });

    // Delete all categories for this tenant
    const deletedCategories = await prisma.tenantCategory.deleteMany({
      where: { tenantId },
    });

    // Delete the tenant
    const deletedTenant = await prisma.tenant.delete({
      where: { id: tenantId },
    });

    console.log(`[Audit] Admin deleted test tenant: ${tenantId} (${deletedProducts.count} products, ${deletedCategories.count} categories)`);

    res.json({
      success: true,
      tenantId,
      deletedProducts: deletedProducts.count,
      deletedCategories: deletedCategories.count,
      message: 'Test tenant deleted successfully',
    });
  } catch (error: any) {
    console.error('[Admin Tools] Error deleting test tenant:', error);
    res.status(500).json({
      error: 'Failed to delete test tenant',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/tools/bulk-seed
 * Seed products across multiple tenants
 */
const bulkSeedSchema = z.object({
  tenantIds: z.array(z.string()).min(1),
  scenario: z.enum(['grocery', 'fashion', 'electronics', 'general']),
  productCount: z.number().int().min(1).max(100),
  createAsDrafts: z.boolean().optional().default(true),
  clearExisting: z.boolean().optional().default(false),
});

router.post('/bulk-seed', async (req, res) => {
  try {
    const parsed = bulkSeedSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    console.log('[Admin Tools] Bulk seeding products:', parsed.data);

    const result = await bulkSeedProducts(parsed.data);

    res.json({
      success: true,
      ...result,
      message: 'Bulk seed completed successfully',
    });
  } catch (error: any) {
    console.error('[Admin Tools] Error bulk seeding:', error);
    res.status(500).json({
      error: 'Failed to bulk seed products',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/tools/bulk-clear
 * Clear products from multiple tenants
 */
const bulkClearSchema = z.object({
  tenantIds: z.array(z.string()).min(1),
  confirm: z.boolean(),
});

router.delete('/bulk-clear', async (req, res) => {
  try {
    const parsed = bulkClearSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: parsed.error.issues,
      });
    }

    if (!parsed.data.confirm) {
      return res.status(400).json({
        error: 'Confirmation required',
        message: 'Must set confirm: true in request body',
      });
    }

    console.log('[Admin Tools] Bulk clearing products:', parsed.data.tenantIds);

    const result = await bulkClearProducts(parsed.data.tenantIds);

    res.json({
      success: true,
      ...result,
      message: 'Bulk clear completed successfully',
    });
  } catch (error: any) {
    console.error('[Admin Tools] Error bulk clearing:', error);
    res.status(500).json({
      error: 'Failed to bulk clear products',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/scan-sessions/stats
 * Get scan session statistics for a tenant
 */
router.get('/scan-sessions/stats', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const [active, total] = await Promise.all([
      prisma.scanSessions.count({
        where: { tenantId, status: 'active' },
      }),
      prisma.scanSessions.count({
        where: { tenantId },
      }),
    ]);

    res.json({ active, total });
  } catch (error: any) {
    console.error('[Admin Tools] Error fetching scan session stats:', error);
    res.status(500).json({
      error: 'Failed to fetch scan session stats',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/scan-sessions/cleanup
 * Close all active scan sessions for a tenant
 */
const cleanupSessionsSchema = z.object({
  tenantId: z.string().min(1),
});

router.post('/scan-sessions/cleanup', async (req: Request, res: Response) => {
  try {
    const parsed = cleanupSessionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: parsed.error.issues,
      });
    }

    const { tenantId } = parsed.data;

    // Close all active sessions for this tenant
    const result = await prisma.scanSessions.updateMany({
      where: {
        tenantId,
        status: 'active',
      },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    await audit({
      tenantId,
      actor: (req as any).user?.userId || 'system',
      action: 'admin.scan_sessions.cleanup',
      payload: { tenantId, cleaned: result.count },
    });

    res.json({
      success: true,
      cleaned: result.count,
      message: `Cleaned up ${result.count} active scan sessions`,
    });
  } catch (error: any) {
    console.error('[Admin Tools] Error cleaning up scan sessions:', error);
    res.status(500).json({
      error: 'Failed to cleanup scan sessions',
      message: error.message,
    });
  }
});

export default router;
