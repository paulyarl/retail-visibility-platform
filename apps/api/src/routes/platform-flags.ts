import { Router } from 'express'
import { prisma } from '../prisma'

const router = Router()

// GET /api/admin/platform-flags
router.get('/platform-flags', async (_req, res) => {
  const rows = await prisma.platformFeatureFlag.findMany({ orderBy: { flag: 'asc' } })
  res.json({ success: true, data: rows })
})

// PUT /api/admin/platform-flags/:flag
router.put('/platform-flags/:flag', async (req, res) => {
  const { flag } = req.params
  const { enabled, description, rollout, allowTenantOverride } = (req.body || {}) as { 
    enabled?: boolean;
    description?: string | null;
    rollout?: string | null;
    allowTenantOverride?: boolean;
  }
  const row = await prisma.platformFeatureFlag.upsert({
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
    },
  })
  res.json({ success: true, data: row })
})

// DELETE /api/admin/platform-flags
router.delete('/platform-flags', async (req, res) => {
  const { flag } = req.body
  
  try {
    // Check usage: count tenant overrides
    const tenantUsage = await prisma.tenantFeatureFlag.count({
      where: { flag }
    })
    
    // Delete tenant flags first (cascade)
    if (tenantUsage > 0) {
      await prisma.tenantFeatureFlag.deleteMany({
        where: { flag }
      })
    }
    
    // Delete platform flag
    const deleted = await prisma.platformFeatureFlag.delete({
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
