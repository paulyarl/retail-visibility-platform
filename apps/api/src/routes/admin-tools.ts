/**
 * Admin Tools API Routes
 * 
 * Provides API endpoints for the Admin Control Panel.
 * All routes require admin authentication and are audit logged.
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  createTestChain,
  deleteTestChain,
  createTestTenant,
  bulkSeedProducts,
  bulkClearProducts,
} from '../lib/admin-tools';

const router = Router();

// TODO: Add requireAdmin middleware
// TODO: Add audit logging middleware

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
  subscriptionTier: z.string().optional().default('professional'),
  scenario: z.enum(['grocery', 'fashion', 'electronics', 'general']).optional().default('general'),
  productCount: z.number().int().min(0).max(100).optional().default(0),
  createAsDrafts: z.boolean().optional().default(true),
});

router.post('/tenants', async (req, res) => {
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

export default router;
