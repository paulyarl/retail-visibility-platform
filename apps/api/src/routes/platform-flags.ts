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
  const { enabled, rollout, allowTenantOverride } = (req.body || {}) as { 
    enabled?: boolean; 
    rollout?: string | null;
    allowTenantOverride?: boolean;
  }
  const row = await prisma.platformFeatureFlag.upsert({
    where: { flag },
    update: { 
      enabled: !!enabled, 
      rollout: rollout ?? null,
      ...(allowTenantOverride !== undefined && { allowTenantOverride: !!allowTenantOverride })
    },
    create: { 
      flag, 
      enabled: !!enabled, 
      rollout: rollout ?? null,
      allowTenantOverride: !!allowTenantOverride
    },
  })
  res.json({ success: true, data: row })
})

export default router
