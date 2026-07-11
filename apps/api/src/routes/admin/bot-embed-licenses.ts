/**
 * Bot Embed Licenses Admin Routes
 *
 * Platform admin endpoints for managing external bot embed licenses.
 *
 * Auth: authenticateToken + requireAdmin (mounted externally)
 *
 * GET    /api/admin/bot-embed-licenses           — List all licenses (with filters)
 * POST   /api/admin/bot-embed-licenses           — Create a license for a tenant
 * PUT    /api/admin/bot-embed-licenses/:id       — Update license (status, allowed_domains, expiry)
 * DELETE /api/admin/bot-embed-licenses/:id       — Revoke a license
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAdmin } from '../../middleware/auth';
import { audit } from '../../audit';
import { generateEmbedKey } from '../../lib/id-generator';

const router = Router();

// Auth: authenticateToken applied at mount level in admin.routes.ts
// requireAdmin applied per-route below

// ====================
// Validation Schemas
// ====================

const createLicenseSchema = z.object({
  tenant_id: z.string().min(1).max(255),
  allowed_domains: z.array(z.string()).default([]),
  source: z.enum(['tier', 'bsaas', 'promo', 'addon', 'comp']).default('tier'),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: z.any().optional(),
});

const updateLicenseSchema = z.object({
  allowed_domains: z.array(z.string()).optional(),
  status: z.enum(['active', 'suspended', 'expired', 'cancelled']).optional(),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: z.any().optional(),
});

// ====================
// Routes
// ====================

// GET /api/admin/bot-embed-licenses
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { tenantId, status, source } = req.query;

    const where: any = {};
    if (tenantId) where.tenant_id = tenantId as string;
    if (status) where.status = status as string;
    if (source) where.source = source as string;

    const licenses = await prisma.tenant_bot_embed_licenses.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        tenants: { select: { id: true, name: true, subscription_tier: true } },
      },
    });

    res.json({ success: true, data: licenses });
  } catch (error) {
    console.error('[BotEmbedLicenses] Error listing:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list embed licenses' });
  }
});

// POST /api/admin/bot-embed-licenses
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const validation = createLicenseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid license data', details: validation.error.issues });
    }

    const { tenant_id, allowed_domains, source, expires_at, metadata } = validation.data;

    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: 'not_found', message: 'Tenant not found' });
    }

    const license = await prisma.tenant_bot_embed_licenses.create({
      data: {
        tenant_id,
        embed_key: generateEmbedKey(tenant_id),
        allowed_domains,
        source,
        status: 'active',
        expires_at: expires_at ? new Date(expires_at) : null,
        metadata: metadata || undefined,
      },
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'create',
      payload: { entity_type: 'other', id: license.id, tenant_id, allowed_domains, source },
    });

    res.json({ success: true, data: license });
  } catch (error) {
    console.error('[BotEmbedLicenses] Error creating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create embed license' });
  }
});

// PUT /api/admin/bot-embed-licenses/:id
router.put('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const validation = updateLicenseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid update data', details: validation.error.issues });
    }

    const existing = await prisma.tenant_bot_embed_licenses.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Embed license not found' });
    }

    const updateData: any = { updated_at: new Date() };
    if (validation.data.allowed_domains !== undefined) updateData.allowed_domains = validation.data.allowed_domains;
    if (validation.data.status) updateData.status = validation.data.status;
    if (validation.data.expires_at !== undefined) updateData.expires_at = validation.data.expires_at ? new Date(validation.data.expires_at) : null;
    if (validation.data.metadata !== undefined) updateData.metadata = validation.data.metadata;

    const license = await prisma.tenant_bot_embed_licenses.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'update',
      payload: { entity_type: 'other', id: license.id, changes: validation.data },
    });

    res.json({ success: true, data: license });
  } catch (error) {
    console.error('[BotEmbedLicenses] Error updating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update embed license' });
  }
});

// DELETE /api/admin/bot-embed-licenses/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.tenant_bot_embed_licenses.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Embed license not found' });
    }

    await prisma.tenant_bot_embed_licenses.delete({ where: { id: req.params.id } });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'delete',
      payload: { entity_type: 'other', id: req.params.id, tenant_id: existing.tenant_id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[BotEmbedLicenses] Error deleting:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete embed license' });
  }
});

export default router;
