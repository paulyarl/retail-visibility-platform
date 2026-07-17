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
import { invalidateEffectiveCapabilities } from '../../services/EffectiveCapabilityResolver';
import { getBillingNotificationService } from '../../services/subscription/BillingNotificationService';
import { audit } from '../../audit';
import { signGrantToken } from '../../services/GrantTokenService';
import { unifiedConfig } from '../../config/unifiedConfig';
import { generateGrantTokenId } from '../../lib/id-generator';
import { logger } from '../../logger';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

// ====================
// Validation Schemas
// ====================

const createPurchaseSchema = z.object({
  tenant_id: z.string().min(1).max(255),
  feature_key: z.string().min(1),
  source: z.enum(['bsaas', 'promo', 'addon', 'comp', 'tier_overage', 'admin_grant', 'bsaas_bundle']).default('bsaas'),
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
    logger.error('[FeaturePurchases] Error listing:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[FeaturePurchases] Error creating:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[FeaturePurchases] Error granting complimentary access:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[FeaturePurchases] Error updating:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[FeaturePurchases] Error deleting:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete feature purchase' });
  }
});

// GET /api/admin/feature-purchases/grants — list all grant tokens with claims
router.get('/grants', async (req: Request, res: Response) => {
  try {
    const { featureKey, tenantId, status } = req.query;

    const where: any = {};
    if (featureKey) where.feature_key = featureKey as string;
    if (tenantId) where.tenant_id = tenantId as string;

    const grants = await prisma.bsaas_grant_tokens.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        bsaas_grant_token_claims: {
          orderBy: { claimed_at: 'desc' },
        },
      },
    });

    // Enrich with feature + tenant names
    const featureKeys = [...new Set(grants.map((g) => g.feature_key))];
    const tenantIds = [...new Set(grants.map((g) => g.tenant_id).filter(Boolean) as string[])];

    const [features, tenants] = await Promise.all([
      prisma.features_list.findMany({
        where: { key: { in: featureKeys } },
        select: { key: true, name: true, marketing_name: true },
      }),
      prisma.tenants.findMany({
        where: { id: { in: tenantIds } },
        select: { id: true, name: true },
      }),
    ]);

    const featureMap = new Map(features.map((f) => [f.key, f]));
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    const enriched = grants.map((g) => {
      const qrExpired = new Date(g.qr_expires_at).getTime() < Date.now();
      const claimsExhausted = g.claims_count >= g.max_claims;
      let grantStatus: 'active' | 'expired' | 'fully_claimed' | 'inactive' | 'revoked' = 'active';
      if (g.is_revoked) grantStatus = 'revoked';
      else if (qrExpired) grantStatus = 'expired';
      else if (claimsExhausted) grantStatus = 'fully_claimed';

      if (status && grantStatus !== status) return null;

      const feature = featureMap.get(g.feature_key);
      const tenant = g.tenant_id ? tenantMap.get(g.tenant_id) : null;

      return {
        id: g.id,
        feature_key: g.feature_key,
        feature_name: feature?.marketing_name || feature?.name || g.feature_key,
        tenant_id: g.tenant_id,
        tenant_name: tenant?.name || null,
        duration_days: g.duration_days,
        granted_by: g.granted_by,
        max_claims: g.max_claims,
        claims_count: g.claims_count,
        qr_expires_at: g.qr_expires_at.toISOString(),
        is_revoked: g.is_revoked,
        revoked_at: g.revoked_at?.toISOString() || null,
        revoked_by: g.revoked_by || null,
        notes: g.notes || null,
        created_at: g.created_at.toISOString(),
        updated_at: g.updated_at.toISOString(),
        status: grantStatus,
        claims: g.bsaas_grant_token_claims.map((c) => ({
          id: c.id,
          tenant_id: c.tenant_id,
          tenant_name: tenantMap.get(c.tenant_id)?.name || null,
          claimed_at: c.claimed_at.toISOString(),
        })),
      };
    }).filter(Boolean);

    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error('[FeaturePurchases] Error listing grants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list grant tokens' });
  }
});

// PUT /api/admin/feature-purchases/grants/:id — update grant token (max_claims, notes)
const updateGrantSchema = z.object({
  max_claims: z.number().int().min(1).max(100).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

router.put('/grants/:id', async (req: Request, res: Response) => {
  try {
    const validation = updateGrantSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid grant update data', details: validation.error.issues });
    }

    const existing = await prisma.bsaas_grant_tokens.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Grant token not found' });
    }

    if (existing.is_revoked) {
      return res.status(400).json({ error: 'revoked', message: 'Cannot update a revoked grant token' });
    }

    const updateData: any = { updated_at: new Date() };
    if (validation.data.max_claims !== undefined) {
      if (validation.data.max_claims < existing.claims_count) {
        return res.status(400).json({ error: 'invalid_max_claims', message: `max_claims cannot be less than current claims_count (${existing.claims_count})` });
      }
      updateData.max_claims = validation.data.max_claims;
    }
    if (validation.data.notes !== undefined) updateData.notes = validation.data.notes;

    const updated = await prisma.bsaas_grant_tokens.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'feature_purchase.grant_token_updated',
      payload: { entity_type: 'grant_token', id: updated.id, changes: validation.data },
    });

    res.json({ success: true, data: { id: updated.id, max_claims: updated.max_claims, notes: updated.notes } });
  } catch (error) {
    logger.error('[FeaturePurchases] Error updating grant token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update grant token' });
  }
});

// POST /api/admin/feature-purchases/grants/:id/revoke — revoke a grant token
router.post('/grants/:id/revoke', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.bsaas_grant_tokens.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Grant token not found' });
    }

    if (existing.is_revoked) {
      return res.status(400).json({ error: 'already_revoked', message: 'Grant token is already revoked' });
    }

    const updated = await prisma.bsaas_grant_tokens.update({
      where: { id: req.params.id },
      data: {
        is_revoked: true,
        revoked_at: new Date(),
        revoked_by: (req as any).user?.userId || 'admin',
        updated_at: new Date(),
      },
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'feature_purchase.grant_token_revoked',
      payload: { entity_type: 'grant_token', id: updated.id, feature_key: existing.feature_key },
    });

    res.json({ success: true, data: { id: updated.id, is_revoked: updated.is_revoked, revoked_at: updated.revoked_at?.toISOString() } });
  } catch (error) {
    logger.error('[FeaturePurchases] Error revoking grant token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to revoke grant token' });
  }
});

// POST /api/admin/feature-purchases/grants/:id/unrevoke — un-revoke a grant token
router.post('/grants/:id/unrevoke', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.bsaas_grant_tokens.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Grant token not found' });
    }

    if (!existing.is_revoked) {
      return res.status(400).json({ error: 'not_revoked', message: 'Grant token is not revoked' });
    }

    const updated = await prisma.bsaas_grant_tokens.update({
      where: { id: req.params.id },
      data: {
        is_revoked: false,
        revoked_at: null,
        revoked_by: null,
        updated_at: new Date(),
      },
    });

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'feature_purchase.grant_token_unrevoked',
      payload: { entity_type: 'grant_token', id: updated.id, feature_key: existing.feature_key },
    });

    res.json({ success: true, data: { id: updated.id, is_revoked: updated.is_revoked } });
  } catch (error) {
    logger.error('[FeaturePurchases] Error un-revoking grant token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to un-revoke grant token' });
  }
});

// GET /api/admin/feature-purchases/complimentary-grants — list all complimentary (admin_grant) purchases
router.get('/complimentary-grants', async (req: Request, res: Response) => {
  try {
    const { tenantId, featureKey, status } = req.query;

    const where: any = { source: 'admin_grant' };
    if (tenantId) where.tenant_id = tenantId as string;
    if (featureKey) where.feature_key = featureKey as string;
    if (status) where.status = status as string;

    const grants = await prisma.tenant_feature_purchases.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        tenants: { select: { id: true, name: true, subscription_tier: true } },
      },
    });

    const enriched = grants.map((g) => ({
      id: g.id,
      tenant_id: g.tenant_id,
      tenant_name: g.tenants?.name || null,
      tenant_tier: g.tenants?.subscription_tier || null,
      feature_key: g.feature_key,
      source: g.source,
      status: g.status,
      expires_at: g.expires_at?.toISOString() || null,
      metadata: g.metadata,
      reason: (g.metadata as any)?.reason || null,
      granted_by: (g.metadata as any)?.granted_by || null,
      granted_at: (g.metadata as any)?.granted_at || null,
      created_at: g.created_at.toISOString(),
      updated_at: g.updated_at.toISOString(),
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error('[FeaturePurchases] Error listing complimentary grants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list complimentary grants' });
  }
});

// ====================
// Phase 4: Grant Token QR Codes for Private Features
// ====================

const createGrantTokenSchema = z.object({
  feature_key: z.string().min(1),
  tenant_id: z.string().max(255).optional(),
  duration_days: z.number().int().min(1).max(3650).optional(),
  max_claims: z.number().int().min(1).max(100).default(1),
  qr_expiry_hours: z.number().int().min(1).max(720).default(168),
});

// POST /api/admin/feature-purchases/create-grant-token
router.post('/create-grant-token', async (req: Request, res: Response) => {
  try {
    const validation = createGrantTokenSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'validation_error', message: 'Invalid grant token request', details: validation.error.issues });
    }

    const { feature_key, tenant_id, duration_days, max_claims, qr_expiry_hours } = validation.data;

    // Verify feature exists in features_list (must be active or private)
    const feature = await prisma.features_list.findUnique({ where: { key: feature_key } });
    if (!feature || !feature.is_active) {
      return res.status(404).json({ error: 'not_found', message: `Feature key '${feature_key}' does not exist or is inactive` });
    }

    // Check bsaas_catalog — feature must be in catalog (is_private allowed)
    const catalogEntry = await prisma.bsaas_catalog.findUnique({ where: { feature_key } });
    if (!catalogEntry) {
      return res.status(400).json({ error: 'not_in_catalog', message: 'Feature is not in the BSaaS catalog' });
    }

    // If tenant_id provided, verify tenant exists
    if (tenant_id) {
      const tenant = await prisma.tenants.findUnique({ where: { id: tenant_id } });
      if (!tenant) {
        return res.status(404).json({ error: 'not_found', message: 'Tenant not found' });
      }
    }

    const grantTokenId = generateGrantTokenId();
    const qrExpiresAt = new Date(Date.now() + qr_expiry_hours * 60 * 60 * 1000);

    // Create grant token record
    await prisma.bsaas_grant_tokens.create({
      data: {
        id: grantTokenId,
        feature_key,
        tenant_id: tenant_id || null,
        duration_days: duration_days || null,
        granted_by: (req as any).user?.userId || 'admin',
        max_claims,
        claims_count: 0,
        qr_expires_at: qrExpiresAt,
      },
    });

    // Sign the JWT token
    const grantToken = signGrantToken({
      grant_token_id: grantTokenId,
      feature_key,
      tenant_id: tenant_id || null,
      duration_days: duration_days || null,
      max_claims,
      qr_expires_at: qrExpiresAt,
    });

    // Construct QR URL
    const appDomain = unifiedConfig.webUrl;
    const qrUrl = `${appDomain}/settings/feature-store?grant=${encodeURIComponent(grantToken)}`;

    // Resolve feature icon for QR embedding
    const targetIcon = {
      type: 'feature' as const,
      feature_key,
      icon_name: feature.icon_name || null,
      marketing_name: feature.marketing_name || feature.name,
    };

    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'admin',
      action: 'feature_purchase.grant_token_created',
      payload: { entity_type: 'grant_token', id: grantTokenId, feature_key, tenant_id, duration_days, max_claims, qr_expires_at: qrExpiresAt.toISOString() },
    });

    res.json({
      success: true,
      data: {
        grant_token: grantToken,
        grant_token_id: grantTokenId,
        qr_url: qrUrl,
        expires_at: qrExpiresAt.toISOString(),
        feature_key,
        feature_name: feature.marketing_name || feature.name,
        target_icon: targetIcon,
      },
    });
  } catch (error: any) {
    logger.error('[FeaturePurchases] Error creating grant token:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to create grant token' });
  }
});

export default router;
