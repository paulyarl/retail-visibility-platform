import { Router } from 'express'
import { randomUUID } from 'crypto'
import { prisma } from '../prisma'
import { requirePlatformAdmin, requirePlatformUser } from '../middleware/auth'
import { audit } from '../audit'
import { invalidateEffectiveFlagCaches } from '../utils/effectiveFlags'
import { logger } from '../logger';

const router = Router()

// GET /api/admin/platform-flags
router.get('/platform-flags', requirePlatformUser, async (_req, res) => {
  const rows = await prisma.platform_feature_flags_list.findMany({ orderBy: { flag: 'asc' } })
  res.json({ success: true, data: rows })
})

// PUT /api/admin/platform-flags/:flag
router.put('/platform-flags/:flag', requirePlatformAdmin, async (req, res) => {
  const { flag } = req.params
  const { enabled, description, rollout, allowTenantOverride } = (req.body || {}) as { 
    enabled?: boolean;
    description?: string | null;
    rollout?: string | null;
    allowTenantOverride?: boolean;
  }
  const row = await prisma.platform_feature_flags_list.upsert({
    where: { flag },
    update: { 
      enabled: !!enabled,
      description: description ?? null,
      rollout: rollout ?? null,
      ...(allowTenantOverride !== undefined && { allow_tenant_override: !!allowTenantOverride })
    },
    create: { 
      id: randomUUID(),
      flag, 
      enabled: !!enabled,
      description: description ?? null,
      rollout: rollout ?? null,
      allow_tenant_override: !!allowTenantOverride,
      updated_at: new Date(),
      created_at: new Date()
    },
  })
  invalidateEffectiveFlagCaches()
  await audit({
    tenantId: 'platform',
    actor: req.user?.userId || req.user?.id || 'system',
    action: 'update',
    payload: { flag, enabled, description, rollout, allowTenantOverride, entity_type: 'other', id: flag },
  })
  res.json({ success: true, data: row })
})

// POST /api/admin/platform-flags/:flag/override
router.post('/platform-flags/:flag/override', requirePlatformAdmin, async (req, res) => {
  const { flag } = req.params
  const { value } = req.body as { value: boolean | null }
  
  try {
    // If value is null, we're clearing the override (setting to platform default)
    if (value === null) {
      // Just update the platform flag's enabled state
      const row = await prisma.platform_feature_flags_list.update({
        where: { flag },
        data: { enabled: false }
      })
      await audit({
        tenantId: 'platform',
        actor: req.user?.userId || req.user?.id || 'system',
        action: 'update',
        payload: { flag, override_cleared: true, entity_type: 'other', id: flag },
      })
      return res.json({ success: true, data: row, message: 'Override cleared' })
    }
    
    // Otherwise, force the flag to the specified value
    const row = await prisma.platform_feature_flags_list.upsert({
      where: { flag },
      update: { enabled: !!value },
      create: { 
        id: randomUUID(),
        flag, 
        enabled: !!value,
        description: null,
        rollout: null,
        allow_tenant_override: false,
        updated_at: new Date(),
        created_at: new Date()
      },
    })
    
    res.json({ success: true, data: row, message: `Flag forced to ${value}` })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Flag not found' })
    }
    logger.error('[platform-flags] Override error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: error.message || 'Failed to override flag' })
  }
})

// DELETE /api/admin/platform-flags
router.delete('/platform-flags', requirePlatformAdmin, async (req, res) => {
  const { flag } = req.body
  
  try {
    // Check usage: count tenant overrides
    const tenantUsage = await prisma.tenant_feature_flags_list.count({
      where: { flag }
    })
    
    // Delete tenant flags first (cascade)
    if (tenantUsage > 0) {
      await prisma.tenant_feature_flags_list.deleteMany({
        where: { flag }
      })
    }
    
    // Delete platform flag
    const deleted = await prisma.platform_feature_flags_list.delete({
      where: { flag }
    })
    
    await audit({
      tenantId: 'platform',
      actor: req.user?.userId || req.user?.id || 'system',
      action: 'delete',
      payload: { flag, tenantUsageCount: tenantUsage, entity_type: 'other', id: flag },
    })
    
    res.json({ 
      success: true, 
      data: deleted,
      tenantUsageCount: tenantUsage,
      message: `Deleted flag and ${tenantUsage} tenant override(s)`
    })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Flag not found' })
    }
    throw error
  }
})

export default router
