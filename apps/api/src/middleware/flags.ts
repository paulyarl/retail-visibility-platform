import { Request, Response, NextFunction } from 'express'
import { isTenantFlagOn } from '../utils/tenantFlags'
import { getEffectivePlatform, getEffectiveTenant } from '../utils/effectiveFlags'
import { prisma } from '../prisma'

export type FlagScope = 'platform' | 'tenant'

// Generic feature gate. Returns 404 when disabled to safely hide surface.
export function requireFlag(opts: { flag: string; scope: FlagScope; tenantParam?: string; platformEnvVar?: string }) {
  const { flag, scope, tenantParam = 'tenantId', platformEnvVar } = opts
  const envVarName = platformEnvVar || `FF_${flag.toUpperCase()}`
  const platformOn = String(process.env[envVarName] || '').toLowerCase() === 'true'

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (scope === 'platform') {
        // Platform scope: use effective platform status (overrides/env/db)
        const eff = await getEffectivePlatform(flag)
        if (eff.effectiveOn) return next()
        return res.status(404).json({ error: 'not_enabled' })
      }

      // Tenant scope: check platform settings, then tenant flag (with override support)
      const tenantId = (req.params as any)[tenantParam] || (req.query as any)[tenantParam] || (req.body as any)?.[tenantParam]
      if (!tenantId) return res.status(400).json({ error: 'tenant_id_required' })

      // Use effective tenant status (handles overrides/env/db)
      const effTenant = await getEffectiveTenant(flag, String(tenantId))
      if (!effTenant.tenantEffectiveOn) {
        const reason = effTenant.tenantEffectiveSource === 'blocked' ? 'platform_disabled' : 'tenant_not_enabled'
        return res.status(404).json({ error: reason })
      }
      return next()
    } catch (_e) {
      return res.status(500).json({ error: 'flag_check_failed' })
    }
  }
}
