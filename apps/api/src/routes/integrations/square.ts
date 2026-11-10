/**
 * Square POS Integration API Routes
 * 
 * Handles OAuth flow and production sync for Square POS integration
 * Note: Square does not have a demo mode like Clover
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';
import { requireTierFeature } from '../../middleware/tier-access';
import { logger } from '../../logger';

const router = Router();

/**
 * Get Square integration status for a tenant
 */
router.get('/:tenantId/square/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const user = (req as any).user;

    // Verify tenant exists and user has access
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      include: { user_tenants: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found' });
    }

    // Check if user has access to this tenant
    const userId = user.userId || user.user_id || user.id;
    const hasAccess = tenant.user_tenants.some((ut: any) => ut.user_id === userId);
    const isPlatformUser = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER'].includes(user.role);
    if (!hasAccess && !isPlatformUser) {
      return res.status(403).json({ error: 'access_denied' });
    }

    const [integration, matched, unmatched] = await Promise.all([
      prisma.square_integrations_list.findFirst({ where: { tenant_id: tenantId } }),
      prisma.square_product_mappings_list.count({
        where: { tenant_id: tenantId, sync_status: 'matched' },
      }),
      prisma.square_product_mappings_list.count({
        where: { tenant_id: tenantId, sync_status: 'unmatched' },
      }),
    ]);

    return res.json({
      enabled: integration?.enabled ?? false,
      status: integration ? (integration.last_error ? 'error' : 'connected') : null,
      stats: { matched, unmatched },
      lastSyncAt: integration?.last_sync_at ?? null,
      merchantId: integration?.merchant_id ?? null,
      locationId: integration?.location_id ?? null,
      mode: integration?.mode ?? null,
      lastError: integration?.last_error ?? null,
    });

  } catch (error) {
    logger.error('Error fetching Square status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Get Square OAuth authorization URL
 */
router.get('/:tenantId/square/oauth/authorize', authenticateToken, requireTierFeature('integration_square'), async (req: Request, res: Response) => {
  try {
    // Square OAuth not yet implemented
    return res.status(501).json({ 
      error: 'not_implemented',
      message: 'Square OAuth integration coming soon'
    });
  } catch (error) {
    logger.error('Error generating Square OAuth URL:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Square OAuth callback
 */
router.get('/:tenantId/square/oauth/callback', async (req: Request, res: Response) => {
  try {
    // Square OAuth not yet implemented
    return res.status(501).json({ 
      error: 'not_implemented',
      message: 'Square OAuth integration coming soon'
    });
  } catch (error) {
    logger.error('Error in Square OAuth callback:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Disconnect Square integration
 */
router.post('/:tenantId/square/disconnect', authenticateToken, requireTierFeature('integration_square'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { SquareOAuthService } = await import('../../services/square/SquareOAuthService');
    await new SquareOAuthService().disconnect(tenantId);
    await prisma.square_integrations_list.updateMany({
      where: { tenant_id: tenantId },
      data: { enabled: false, updated_at: new Date() },
    });
    return res.json({ success: true });
  } catch (error) {
    logger.error('Error disconnecting Square:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Trigger Square sync — manual one-shot stock pull for this tenant's
 * integration (ops use; the daily job covers the schedule).
 */
router.post('/:tenantId/square/sync', authenticateToken, requireTierFeature('integration_square'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const integration = await prisma.square_integrations_list.findFirst({
      where: { tenant_id: tenantId },
      select: { id: true, tenant_id: true, merchant_id: true, location_id: true },
    });
    if (!integration) {
      return res.status(404).json({ error: 'integration_not_found' });
    }
    const { syncSquareIntegration } = await import('../../services/square/square-stock-sync');
    const result = await syncSquareIntegration(integration);
    return res.json({ success: !result.error, ...result });
  } catch (error) {
    logger.error('Error syncing Square:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
