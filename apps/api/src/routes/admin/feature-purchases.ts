/**
 * Feature Purchases Admin Routes (BSaaS)
 *
 * Platform admin endpoints for managing à la carte feature purchases
 * that grant tenants features outside their tier bundle.
 *
 * Auth: authenticateToken + requireAdmin (mounted externally)
 *
 * GET    /api/admin/feature-purchases           — List all purchases (with filters)
 * POST   /api/admin/feature-purchases           — Grant a feature to a tenant
 * POST   /api/admin/feature-purchases/grant-complimentary — Grant complimentary access
 * PUT    /api/admin/feature-purchases/:id       — Update purchase status
 * DELETE /api/admin/feature-purchases/:id       — Revoke a purchase
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { invalidateEffectiveCapabilities } from '../../services/EffectiveCapabilityResolver';
import { getBillingNotificationService } from '../../services/subscription/BillingNotificationService';
import { audit } from '../../audit';

const router = Router();

router.use(authenticateToken);
router.use(requireAdmin);

// ====================
// Validation Schemas
// ====================

const createPurchaseSchema = z.object({
  tenant_id: z.string().min(1).max(255),
  feature_key: z.string().min(1),
  source: z.enum(['bsaas', 'promo', 'addon', 'comp', 'tier_overage']).default('bsaas'),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: z.any().optional(),
});

const updatePurchaseSchema = z.object({
  status: z.enum(['active', 'past_due', 'trial', 'suspended', 'expired', 'cancelled']).optional(),
  expires_at: z.string().datetime().optional().nullable(),
  metadata: z.any().optional(),
});

const grantComplimentarySchema = z.object({
  tenant_id: z.string().min(1).max(255),
  feature_key: z.string().min(1),
  duration_days: z.number().int().min(1).max(3650).optional(),
  reason: z.string().min(1).max(500),
});

// ====================
// Routes
// ====================

// GET /api/admin/feature-purchases
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, featureKey, status, source } = req.query;

    const where: any = {};
    if (tenantId) where.tenant_id = tenantId as string;
    if (featureKey) where.feature_key = featureKey as string;
    if (status) where.status = status as string;
    if (source) where.source = source as string;

    const purchases = await prisma.tenant_feature_purchases.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        tenants: { select: { id: true, name: true, subscription_tier: true } },
      },
    });

    res.json({ success: true, data: purchases });
  } catch (error) {
    console.error('[FeaturePurchases] Error listing:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list feature purchases' });
  }
});

// POST /api/admin/feature-purchases
router.post('/', async (req: Request, res: Response) => {
  try {
    const validation = createPurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid purchase data', details: validation.error.issues });
    }

    const { tenant_id, feature_key, source, expires_at, metadata } = validation.data;

    // Verify the feature key exists in features_list
    const feature = await prisma.features_list.findUnique({ where: { key: feature_key } });
    if (!feature) {
      return res.status(404).json({ error: 'not_found', message: `Feature key '${feature_key}' does not exist in features_list` });
    }

    // Verify the tenant exists
    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: 'not_found', message: 'Tenant not found' });
    }

    // Upsert: if a purchase already exists for this tenant+feature, update it
    const purchase = await prisma.tenant_feature_purchases.upsert({
      where: {
        tenant_id_feature_key: { tenant_id, feature_key },
      },
      update: {
        source,
        status: 'active',
        expires_at: expires_at ? new Date(expires_at) : null,
        metadata: metadata || undefined,
        updated_at: new Date(),
      },
      create: {
        tenant_id,
        feature_key,
        source,
        status: 'active',
        expires_at: expires_at ? new Date(expires_at) : null,
        metadata: metadata || undefined,
      },
    });

    // Invalidate capability cache so the new purchase takes effect immediately
    invalidateEffectiveCapabilities(tenant_id);

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'create',
      payload: { entity_type: 'feature_purchase', id: purchase.id, tenant_id, feature_key, source },
    });

    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error('[FeaturePurchases] Error creating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to create feature purchase' });
  }
});

// POST /api/admin/feature-purchases/grant-complimentary
router.post('/grant-complimentary', async (req: Request, res: Response) => {
  try {
    const validation = grantComplimentarySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid grant data', details: validation.error.issues });
    }

    const { tenant_id, feature_key, duration_days, reason } = validation.data;

    const feature = await prisma.features_list.findUnique({ where: { key: feature_key } });
    if (!feature) {
      return res.status(404).json({ error: 'not_found', message: `Feature key '${feature_key}' does not exist in features_list` });
    }

    const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
      return res.status(404).json({ error: 'not_found', message: 'Tenant not found' });
    }

    const expiresAt = duration_days
      ? new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000)
      : null;

    const purchase = await prisma.tenant_feature_purchases.upsert({
      where: {
        tenant_id_feature_key: { tenant_id, feature_key },
      },
      update: {
        source: 'admin_grant',
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          granted_by: (req as any).user?.userId || 'admin',
          granted_at: new Date().toISOString(),
          reason,
          complimentary: true,
        },
        updated_at: new Date(),
      },
      create: {
        tenant_id,
        feature_key,
        source: 'admin_grant',
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          granted_by: (req as any).user?.userId || 'admin',
          granted_at: new Date().toISOString(),
          reason,
          complimentary: true,
        },
      },
    });

    invalidateEffectiveCapabilities(tenant_id);

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'feature_purchase.grant_complimentary',
      payload: { entity_type: 'feature_purchase', id: purchase.id, tenant_id, feature_key, reason, duration_days },
    });

    const notificationService = getBillingNotificationService();
    notificationService.sendNotification({
      tenantId: tenant_id,
      type: 'bsaas_purchase_success',
      metadata: { featureKey: feature_key, featureName: feature.name },
    }).catch(err => console.error('[FeaturePurchases] Failed to send grant notification:', err));

    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error('[FeaturePurchases] Error granting complimentary access:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to grant complimentary access' });
  }
});

// PUT /api/admin/feature-purchases/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const validation = updatePurchaseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid update data', details: validation.error.issues });
    }

    const existing = await prisma.tenant_feature_purchases.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Feature purchase not found' });
    }

    const updateData: any = { updated_at: new Date() };
    if (validation.data.status) updateData.status = validation.data.status;
    if (validation.data.expires_at !== undefined) updateData.expires_at = validation.data.expires_at ? new Date(validation.data.expires_at) : null;
    if (validation.data.metadata !== undefined) updateData.metadata = validation.data.metadata;

    const purchase = await prisma.tenant_feature_purchases.update({
      where: { id: req.params.id },
      data: updateData,
    });

    invalidateEffectiveCapabilities(existing.tenant_id);

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'update',
      payload: { entity_type: 'feature_purchase', id: purchase.id, changes: validation.data },
    });

    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error('[FeaturePurchases] Error updating:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update feature purchase' });
  }
});

// DELETE /api/admin/feature-purchases/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.tenant_feature_purchases.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Feature purchase not found' });
    }

    await prisma.tenant_feature_purchases.delete({ where: { id: req.params.id } });

    invalidateEffectiveCapabilities(existing.tenant_id);

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'delete',
      payload: { entity_type: 'feature_purchase', id: req.params.id, tenant_id: existing.tenant_id, feature_key: existing.feature_key },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[FeaturePurchases] Error deleting:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete feature purchase' });
  }
});

export default router;
