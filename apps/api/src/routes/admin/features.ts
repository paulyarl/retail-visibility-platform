/**
 * Features Management API Routes
 * CRUD for features_list table
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { logger } from '../../logger';

const router = Router();
// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

const requirePlatformStaff = (req: any, res: any, next: any) => {
  if (!['PLATFORM_ADMIN','PLATFORM_SUPPORT','PLATFORM_VIEWER'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  next();
};

const requirePlatformAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'PLATFORM_ADMIN') return res.status(403).json({ error: 'forbidden' });
  next();
};

function transformFeature(f: any) {
  return {
    feature_key: f.key, feature_name: f.name, description: f.description || '',
    category: f.category, marketing_name: f.marketing_name || undefined,
    icon_name: f.icon_name || undefined, sort_order: f.sort_order ?? 0,
    created_at: f.created_at?.toISOString(), updated_at: f.updated_at?.toISOString(),
  };
}

/** GET /api/admin/features */
router.get('/', requirePlatformStaff, async (req, res) => {
  try {
    const features = await prisma.features_list.findMany({
      where: { is_active: true }, orderBy: [{ category: 'asc' }, { sort_order: 'asc' }],
    });
    res.json(features.map(transformFeature));
  } catch (error) {
    logger.error('[GET /api/admin/features] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_list_features' });
  }
});

/** POST /api/admin/features */
router.post('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { feature_key, feature_name, description, category, marketing_name, icon_name, sort_order } = req.body;
    if (!feature_key || !feature_name) return res.status(400).json({ error: 'feature_key and feature_name required' });

    const existing = await prisma.features_list.findUnique({ where: { key: feature_key } });
    if (existing) return res.status(409).json({ error: 'feature_key_exists' });

    const feature = await prisma.features_list.create({
      data: { key: feature_key, name: feature_name, description: description || null,
        category: category || null, marketing_name: marketing_name || null,
        icon_name: icon_name || null, sort_order: sort_order ?? 0, is_active: true },
    });
    res.status(201).json(transformFeature(feature));
  } catch (error) {
    logger.error('[POST /api/admin/features] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_create_feature' });
  }
});

/** PUT /api/admin/features */
router.put('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { feature_key, feature_name, description, category, marketing_name, icon_name, sort_order } = req.body;
    if (!feature_key) return res.status(400).json({ error: 'feature_key required' });

    const existing = await prisma.features_list.findUnique({ where: { key: feature_key } });
    if (!existing) return res.status(404).json({ error: 'feature_not_found' });

    const data: any = { updated_at: new Date() };
    if (feature_name !== undefined) data.name = feature_name;
    if (description !== undefined) data.description = description || null;
    if (category !== undefined) data.category = category;
    if (marketing_name !== undefined) data.marketing_name = marketing_name || null;
    if (icon_name !== undefined) data.icon_name = icon_name || null;
    if (sort_order !== undefined) data.sort_order = sort_order;

    const feature = await prisma.features_list.update({ where: { key: feature_key }, data });
    res.json(transformFeature(feature));
  } catch (error) {
    logger.error('[PUT /api/admin/features] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_update_feature' });
  }
});

/** DELETE /api/admin/features?feature_key=... */
router.delete('/', requirePlatformAdmin, async (req, res) => {
  try {
    const { feature_key } = req.query;
    if (!feature_key || typeof feature_key !== 'string') return res.status(400).json({ error: 'feature_key required' });

    const existing = await prisma.features_list.findUnique({ where: { key: feature_key } });
    if (!existing) return res.status(404).json({ error: 'feature_not_found' });

    // Check if referenced by capability_features_list
    const refCount = await prisma.capability_features_list.count({ where: { feature_id: existing.id } });
    if (refCount > 0) {
      await prisma.features_list.update({ where: { key: feature_key }, data: { is_active: false, updated_at: new Date() } });
      return res.json({ success: true, deactivated: true });
    }

    await prisma.features_list.delete({ where: { key: feature_key } });
    res.json({ success: true, deleted: true });
  } catch (error) {
    logger.error('[DELETE /api/admin/features] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'failed_to_delete_feature' });
  }
});

export default router;
