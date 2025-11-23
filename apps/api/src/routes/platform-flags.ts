import { Router } from 'express'
import { prisma } from '../prisma'
import { requirePlatformAdmin, requirePlatformUser } from '../middleware/auth'

const router = Router()

// GET /api/admin/platform-flags
router.get('/platform-flags', requirePlatformUser, async (_req, res) => {
  const rows = await prisma.platformFeatureFlags.findMany({ orderBy: { flag: 'asc' } })
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
  const row = await prisma.platformFeatureFlags.upsert({
    where: { flag },
    update: { 
      enabled: !!enabled,
      description: description ?? null,
      rollout: rollout ?? null,
      ...(allowTenantOverride !== undefined && { allowTenantOverride: !!allowTenantOverride })
    },
    create: { 
      flag, 
      enabled: !!enabled,
      description: description ?? null,
      rollout: rollout ?? null,
      allowTenantOverride: !!allowTenantOverride
    } as any,
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
      const row = await prisma.platformFeatureFlags.update({
        where: { flag },
        data: { enabled: false }
      })
      return res.json({ success: true, data: row, message: 'Override cleared' })
    }
    
    // Otherwise, force the flag to the specified value
    const row = await prisma.platformFeatureFlags.upsert({
      where: { flag },
      update: { enabled: !!value },
      create: { 
        flag, 
        enabled: !!value,
        description: null,
        rollout: null,
        allowTenantOverride: false
      } as any,
    })
    
    res.json({ success: true, data: row, message: `Flag forced to ${value}` })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'Flag not found' })
    }
    console.error('[platform-flags] Override error:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to override flag' })
  }
})

// DELETE /api/admin/platform-flags
router.delete('/platform-flags', requirePlatformAdmin, async (req, res) => {
  const { flag } = req.body
  
  try {
    // Check usage: count tenant overrides
    const tenantUsage = await prisma.tenantFeatureFlags.count({
      where: { flag }
    })
    
    // Delete tenant flags first (cascade)
    if (tenantUsage > 0) {
      await prisma.tenantFeatureFlags.deleteMany({
        where: { flag }
      })
    }
    
    // Delete platform flag
    const deleted = await prisma.platformFeatureFlags.delete({
      where: { flag }
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
