/**
 * Short Code Resolution API
 * Dedicated endpoint for resolving 4-char autoId to tenantId
 * Used by the /s/[autoId] short URL redirect page
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/short-code/:autoId
 * Resolve a 4-char autoId to a tenantId
 * Public endpoint — no auth required
 */
router.get('/:autoId', async (req, res) => {
  try {
    const { autoId } = req.params;
    const normalized = autoId.toUpperCase();

    const tenant = await prisma.tenants.findFirst({
      where: { auto_id: normalized },
      select: { id: true },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
        message: `No tenant found for autoId: ${normalized}`,
      });
    }

    return res.json({
      success: true,
      data: {
        tenantId: tenant.id,
        autoId: normalized,
      },
    });
  } catch (error) {
    logger.error('[SHORT CODE] Failed to resolve autoId:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      success: false,
      error: 'Failed to resolve short code',
    });
  }
});

export default router;
