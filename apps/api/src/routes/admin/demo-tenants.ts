/**
 * Admin Demo Tenant Routes
 *
 * CRUD endpoints for managing demo tenants:
 *   GET    /api/admin/demo-tenants              — list demo tenants
 *   GET    /api/admin/demo-tenants/templates     — list available templates
 *   GET    /api/admin/demo-tenants/:id           — get demo tenant details
 *   POST   /api/admin/demo-tenants              — create demo tenant
 *   POST   /api/admin/demo-tenants/convert       — convert existing tenant to demo
 *   POST   /api/admin/demo-tenants/:id/revoke-demo — revoke demo status from tenant
 *   POST   /api/admin/demo-tenants/:id/expire    — manually expire a demo tenant
 *   DELETE /api/admin/demo-tenants/:id           — permanently delete a demo tenant
 */

import { Router, Request, Response } from 'express';
import demoTenantService, { DemoTemplate } from '../../services/DemoTenantService';
import { logger } from '../../logger';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

/**
 * GET /api/admin/demo-tenants/templates
 * List available demo templates
 */
router.get('/templates', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: demoTenantService.getAvailableTemplates(),
  });
});

/**
 * GET /api/admin/demo-tenants
 * List demo tenants with optional pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeExpired = req.query.includeExpired === 'true';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await demoTenantService.listDemoTenants({ includeExpired, limit, offset });

    res.json({
      success: true,
      data: result.tenants,
      total: result.total,
    });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error listing:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/demo-tenants/:id
 * Get demo tenant details
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenant = await demoTenantService.getDemoTenant(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Demo tenant not found' });
    }
    res.json({ success: true, data: tenant });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error getting tenant:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/demo-tenants
 * Create a new demo tenant
 * Body: { template, businessName?, createdBy?, expiresAt?, subdomain? }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { template, businessName, createdBy, expiresAt, subdomain } = req.body;

    if (!template || !['grocery', 'convenience', 'specialty_retail'].includes(template)) {
      return res.status(400).json({
        success: false,
        error: 'Template is required and must be one of: grocery, convenience, specialty_retail',
      });
    }

    const result = await demoTenantService.createDemoTenant({
      template: template as DemoTemplate,
      businessName,
      createdBy: createdBy || (req.user as any)?.id,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      subdomain,
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error creating:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/demo-tenants/convert
 * Convert an existing tenant to a demo tenant
 * Body: { tenantId, template?, expiresAt?, sourceTenantId? }
 */
router.post('/convert', async (req: Request, res: Response) => {
  try {
    const { tenantId, template, expiresAt, sourceTenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'tenantId is required' });
    }

    if (template && !['grocery', 'convenience', 'specialty_retail'].includes(template)) {
      return res.status(400).json({
        success: false,
        error: 'template must be one of: grocery, convenience, specialty_retail',
      });
    }

    const result = await demoTenantService.convertToDemoTenant(tenantId, {
      template: template as DemoTemplate | undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      sourceTenantId,
    });

    if (!result.converted) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error converting to demo:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/demo-tenants/:id/revoke-demo
 * Revoke demo status from a tenant (convert back to regular tenant)
 */
router.post('/:id/revoke-demo', async (req: Request, res: Response) => {
  try {
    const result = await demoTenantService.revokeDemoStatus(req.params.id);

    if (!result.revoked) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error revoking demo status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/admin/demo-tenants/:id/tier
 * Change the subscription tier of a demo tenant
 * Body: { tier: string }
 */
router.patch('/:id/tier', async (req: Request, res: Response) => {
  try {
    const { tier } = req.body;

    if (!tier || typeof tier !== 'string') {
      return res.status(400).json({ success: false, error: 'tier is required and must be a string' });
    }

    const result = await demoTenantService.changeDemoTenantTier(req.params.id, tier);

    if (!result.changed) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error changing tier:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/demo-tenants/:id/expire
 * Manually expire a demo tenant (marks as closed, does not delete data)
 */
router.post('/:id/expire', async (req: Request, res: Response) => {
  try {
    const result = await demoTenantService.expireDemoTenant(req.params.id);
    if (!result.expired) {
      return res.status(400).json({ success: false, error: result.reason });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error expiring:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/demo-tenants/:id
 * Permanently delete a demo tenant and all its data
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await demoTenantService.deleteDemoTenant(req.params.id);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: 'Demo tenant not found or not a demo tenant' });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('[Admin Demo Tenants] Error deleting:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
