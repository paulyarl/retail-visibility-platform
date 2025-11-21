import { Router } from 'express'
import { prisma } from '../prisma'
import { getEffectivePlatform, getEffectiveTenant, setPlatformOverride, setTenantOverride } from '../utils/effectiveFlags'
import { checkTenantAccess, requirePlatformUser } from '../middleware/auth'

const router = Router()

console.log('[Effective Flags Router] Initializing routes...')

// GET /api/admin/effective-flags - list effective platform flags (platform user_tenants: admin/support/viewer)
router.get('/effective-flags', requirePlatformUser, async (_req, res) => {
  try {
    const rows = await prisma.platform_feature_flags.findMany({ orderBy: { flag: 'asc' } })
    const flags: string[] = [...new Set(rows.map(r => r.flag as string))]
    const effective = await Promise.all(flags.map(f => getEffectivePlatform(f)))
    res.json({ success: true, data: effective })
  } catch (e: any) {
    console.error('[GET /effective-flags] Error:', e)
    res.status(500).json({ success: false, error: 'failed_to_get_effective_flags' })
  }
})

// GET /api/admin/effective-flags/:tenantId - list effective tenant flags (tenant access check)
router.get('/effective-flags/:tenantId', checkTenantAccess, async (req, res) => {
  try {
    console.log('[GET /effective-flags/:tenantId] Request received for tenant:', req.params.tenantId)
    const { tenantId } = req.params
    if (!tenantId) return res.status(400).json({ success: false, error: 'tenantId_required' })

    // Collect flags from platform and tenant scopes
    const [platform, tenant] = await Promise.all([
      prisma.platform_feature_flags.findMany({ orderBy: { flag: 'asc' } }),
      prisma.tenant_feature_flags.findMany({ where: { tenantId }, orderBy: { flag: 'asc' } }),
    ])
    const allFlags = new Set([...platform.map(p => p.flag as string), ...tenant.map(t => t.flag as string)])
    const effective = await Promise.all(Array.from(allFlags).sort().map(f => getEffectiveTenant(f, tenantId)))
    res.json({ success: true, data: effective })
  } catch (e: any) {
    console.error('[GET /effective-flags/:tenantId] Error:', e)
    res.status(500).json({ success: false, error: 'failed_to_get_effective_flags' })
  }
})

// POST /api/admin/flags/override/platform/:flag - set/clear platform runtime override (kill switch)
// Body: { value: true | false | null }
router.post('/flags/override/platform/:flag', async (req, res) => {
  const { flag } = req.params
  const { value } = (req.body || {}) as { value?: boolean | null }
  if (value === undefined) return res.status(400).json({ error: 'value_required' })
  setPlatformOverride(flag, value === null ? null : !!value)
  const eff = await getEffectivePlatform(flag)
  res.json({ success: true, data: eff })
})

// POST /api/admin/flags/override/tenant/:tenantId/:flag - set/clear tenant runtime override
// Body: { value: true | false | null }
router.post('/flags/override/tenant/:tenantId/:flag', async (req, res) => {
  const { tenantId, flag } = req.params
  const { value } = (req.body || {}) as { value?: boolean | null }
  if (!tenantId) return res.status(400).json({ error: 'tenantId_required' })
  if (value === undefined) return res.status(400).json({ error: 'value_required' })
  setTenantOverride(flag, tenantId, value === null ? null : !!value)
  const eff = await getEffectiveTenant(flag, tenantId)
  res.json({ success: true, data: eff })
})

export default router
