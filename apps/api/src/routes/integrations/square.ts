/**
 * Square POS Integration API Routes
 * 
 * Handles OAuth flow and production sync for Square POS integration
 * Note: Square does not have a demo mode like Clover
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { authenticateToken } from '../../middleware/auth';

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
    const hasAccess = tenant.user_tenants.some((ut: any) => ut.user_id === user.id);
    if (!hasAccess && user.role !== 'PLATFORM_ADMIN') {
      return res.status(403).json({ error: 'access_denied' });
    }

    // Check if Square integration exists
    // Note: Square integration table doesn't exist yet, return disconnected status
    // TODO: Create square_integrations table when implementing full Square integration
    
    return res.json({
      enabled: false,
      status: null,
      stats: null,
      lastSyncAt: null,
      merchantId: null
    });

  } catch (error) {
    console.error('Error fetching Square status:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Get Square OAuth authorization URL
 */
router.get('/:tenantId/square/oauth/authorize', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Square OAuth not yet implemented
    return res.status(501).json({ 
      error: 'not_implemented',
      message: 'Square OAuth integration coming soon'
    });
  } catch (error) {
    console.error('Error generating Square OAuth URL:', error);
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
    console.error('Error in Square OAuth callback:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Disconnect Square integration
 */
router.post('/:tenantId/square/disconnect', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Square integration not yet implemented
    return res.status(501).json({ 
      error: 'not_implemented',
      message: 'Square integration coming soon'
    });
  } catch (error) {
    console.error('Error disconnecting Square:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * Trigger Square sync
 */
router.post('/:tenantId/square/sync', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Square sync not yet implemented
    return res.status(501).json({ 
      error: 'not_implemented',
      message: 'Square sync coming soon'
    });
  } catch (error) {
    console.error('Error syncing Square:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
