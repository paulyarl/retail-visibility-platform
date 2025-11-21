import { Router } from 'express'
import { prisma } from '../prisma'
import { checkTenantAccess, requireTenantOwner } from '../middleware/auth'

const router = Router()

// GET /admin/tenant-flags/:tenantId - Read-only, any tenant member can view
router.get('/tenant-flags/:tenantId', checkTenantAccess, async (req, res) => {
  const { tenantId } = req.params
  
  // Get tenant-specific flags
  const tenantFlags = await prisma.tenant_feature_flags.findMany({ 
    where: { tenantId }, 
    orderBy: { flag: 'asc' } 
  })
  
  // Get platform flags that allow tenant override
  const platformFlags = await prisma.platform_feature_flags.findMany({
    where: { allowTenantOverride: true },
    orderBy: { flag: 'asc' }
  })
  
  // Merge: show platform flags with override permission, use tenant flag if exists
  const tenantFlagMap = new Map(tenantFlags.map(f => [f.flag, f]))
  
  const merged = platformFlags.map(pf => {
    const existing = tenantFlagMap.get(pf.flag)
    if (existing) {
      // Tenant has this flag, return tenant version
      tenantFlagMap.delete(pf.flag)
      return existing
    }
    // Tenant doesn't have it yet, create virtual entry from platform flag
    return {
      id: `virtual-${pf.id}`,
      tenantId,
      flag: pf.flag,
      enabled: false, // Default to disabled for tenant
      rollout: pf.rollout || `Inherited from platform (override allowed)`,
      updatedAt: pf.updatedAt,
      _isPlatformInherited: true
    }
  })
  
  // Add any remaining tenant-specific flags that aren't in platform
  const remaining = Array.from(tenantFlagMap.values())
  
  const allFlags = [...merged, ...remaining].sort((a, b) => a.flag.localeCompare(b.flag))
  
  res.json({ success: true, data: allFlags })
})

// PUT /admin/tenant-flags/:tenantId/:flag - Write operation, requires OWNER role
router.put('/tenant-flags/:tenantId/:flag', requireTenantOwner, async (req, res) => {
  const { tenantId, flag } = req.params
  const { enabled, description, rollout } = req.body || {}
  const row = await prisma.tenant_feature_flags.upsert({
    where: { tenantId_flag: { tenantId, flag } },
    update: { enabled: !!enabled, description: description ?? null, rollout: rollout ?? null },
    create: { tenantId, flag, enabled: !!enabled, description: description ?? null, rollout: rollout ?? null },
  })
  return res.json({ success: true, data: row })
})

export default router
